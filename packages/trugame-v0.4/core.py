"""
TruGameEngine v0.4 — gated by json-chamber Black Box control plane.

Every construction and tick calls require_alive("trugame").
After 24h trial the engine stays OFF until an entitlement is applied.
"""

from __future__ import annotations

import hashlib
import struct
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List

_ROOT = Path(__file__).resolve().parent
_SDK = _ROOT.parent.parent / "json-chamber-sdk"
if _SDK.is_dir() and str(_SDK) not in sys.path:
    sys.path.insert(0, str(_SDK))
if str(_ROOT.parent) not in sys.path:
    sys.path.insert(0, str(_ROOT.parent))

try:
    from .license_bridge import LicenseError, activate, gate, status
    from .ecs import WorldECS, Transform, Mesh, RigidBody
    from .physics import PhysicsSystem
    from .scene import Scene
except ImportError:
    from license_bridge import LicenseError, activate, gate, status  # type: ignore
    from ecs import WorldECS, Transform, Mesh, RigidBody  # type: ignore
    from physics import PhysicsSystem  # type: ignore
    from scene import Scene  # type: ignore


def _undress(data: bytes) -> List[int]:
    bits: List[int] = []
    for b in data:
        for i in range(7, -1, -1):
            bits.append((b >> i) & 1)
    return bits


def _simple_mask(seed: bytes, n: int) -> List[int]:
    h = hashlib.sha256(seed).digest()
    out: List[int] = []
    i = 0
    while len(out) < n:
        b = h[i % len(h)]
        for bit in range(8):
            out.append((b >> bit) & 1)
            if len(out) >= n:
                break
        i += 1
        if i % 32 == 0:
            h = hashlib.sha256(h + seed).digest()
    return out


def _split_bits(bits: List[int], mask: List[int]) -> tuple[List[int], List[int]]:
    kept, resid = [], []
    for b, m in zip(bits, mask):
        (kept if m else resid).append(b)
    return kept, resid


@dataclass
class Entity:
    id: int
    pos: List[float]
    rot: List[float]
    meta: Dict = field(default_factory=dict)


@dataclass
class WorldState:
    entities: List[Entity]
    tick: int = 0

    def to_bitstream(self) -> List[int]:
        raw = b""
        for e in self.entities:
            if e.pos:
                raw += struct.pack(f"{len(e.pos)}f", *e.pos)
            if e.rot:
                raw += struct.pack(f"{len(e.rot)}f", *e.rot)
        return _undress(raw)


class TruGameEngine:
    def __init__(
        self,
        master: bytes = b"trugame-master-32bytes-demo-key!!!",
        gravity: List[float] | None = None,
    ):
        self._license = gate()
        if gravity is None:
            gravity = [0, -9.81, 0]
        if len(master) < 32:
            master = hashlib.sha256(master).digest()
        self.master = master
        self.world = WorldState(entities=[], tick=0)
        self.ecs = WorldECS()
        self.physics = PhysicsSystem(gravity=gravity)
        self.scene = Scene(name="main", ecs=self.ecs)
        self.separate_buffers: Dict[int, Any] = {}

    def add_entity(self, entity: Entity) -> None:
        gate()
        self.world.entities.append(entity)
        self.ecs.create_entity(
            Transform(pos=entity.pos, rot=entity.rot),
            Mesh(path=entity.meta.get("mesh", "")),
            RigidBody(),
        )

    def create_mesh_instance(
        self,
        original_path: str,
        pos: List[float],
        rot: List[float] | None = None,
        static: bool = False,
    ) -> int:
        gate()
        if rot is None:
            rot = [0, 0, 0]
        eid = self.ecs.create_entity(
            Transform(pos=pos, rot=rot),
            Mesh(
                path=original_path,
                trugamem_path=f"trugame_dist/{Path(original_path).stem}.trugamem",
            ),
            RigidBody(is_static=static),
        )
        self.scene.original_assets[original_path] = original_path
        return eid

    def tick(self, nonce: bytes = b"tick", dt: float = 1 / 60) -> dict:
        self._license = gate()
        self.physics.tick(self.ecs, dt)
        bits = self.world.to_bitstream()
        ecs_delta = self.ecs.to_bitstream_delta() if hasattr(self.ecs, "to_bitstream_delta") else b""
        seed = nonce + self.world.tick.to_bytes(8, "big") + self.master[:8]
        mask = _simple_mask(seed, max(len(bits), 1))
        kept, resid = _split_bits(bits, mask) if bits else ([], [])
        self.separate_buffers[self.world.tick] = {
            "keep": kept,
            "resid": resid,
            "ecs_delta": ecs_delta,
        }
        info = {
            "tick": self.world.tick,
            "separate": True,
            "keep_bits": len(kept),
            "ecs_entities": len(getattr(self.ecs, "entities", {})),
            "ecs_delta_bytes": len(ecs_delta) if isinstance(ecs_delta, (bytes, list)) else 0,
            "keep_ratio": (sum(mask) / len(mask)) if mask else 0.0,
            "license": self._license.get("status"),
            "product": self._license.get("product", "trugame"),
        }
        self.world.tick += 1
        return info

    def license_status(self) -> dict:
        return status()

    def activate(self, entitlement_token: dict | str) -> dict:
        result = activate(entitlement_token)
        self._license = gate()
        return result


__all__ = ["TruGameEngine", "WorldState", "Entity", "LicenseError"]
