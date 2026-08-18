"""TruGame ECS — license-gated world storage."""

from __future__ import annotations

import struct
from dataclasses import dataclass, field
from typing import Dict, List, Type


@dataclass
class Component:
    pass


@dataclass
class Transform(Component):
    pos: List[float] = field(default_factory=lambda: [0.0, 0.0, 0.0])
    rot: List[float] = field(default_factory=lambda: [0.0, 0.0, 0.0])
    scale: List[float] = field(default_factory=lambda: [1.0, 1.0, 1.0])


@dataclass
class Mesh(Component):
    path: str = ""
    verts: int = 0
    trugamem_path: str = ""
    lod: int = 0


@dataclass
class RigidBody(Component):
    mass: float = 1.0
    vel: List[float] = field(default_factory=lambda: [0.0, 0.0, 0.0])
    is_static: bool = False


def _delta_positions(positions: List[float]) -> bytes:
    if not positions:
        return b""
    raw = struct.pack(f"{len(positions)}f", *positions)
    out = bytearray(len(raw))
    prev = 0
    for i, b in enumerate(raw):
        out[i] = b ^ prev
        prev = b
    return bytes(out)


class WorldECS:
    def __init__(self) -> None:
        self.next_id = 1
        self.entities: Dict[int, Dict[Type, Component]] = {}

    def create_entity(self, *components: Component) -> int:
        eid = self.next_id
        self.next_id += 1
        self.entities[eid] = {}
        for c in components:
            self.entities[eid][type(c)] = c
        return eid

    def query(self, *comp_types: Type):
        for eid, comps in self.entities.items():
            if all(t in comps for t in comp_types):
                yield eid, [comps[t] for t in comp_types]

    def to_bitstream_delta(self) -> bytes:
        all_pos: List[float] = []
        for comps in self.entities.values():
            t = comps.get(Transform)
            if t:
                all_pos.extend(t.pos)
        return _delta_positions(all_pos)
