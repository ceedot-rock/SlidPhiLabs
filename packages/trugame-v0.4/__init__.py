"""
TruGame v0.4 — Full engine
Gated by json-chamber Black Box control plane (require_alive).
"""
from .core import TruGameEngine, WorldState, Entity, LicenseError
from .streamer import TruGameStreamer
from .renderer import TruGameRenderer
from .netcode import PhiNetcode
from .ecs import WorldECS, Transform, Mesh, RigidBody
from .physics import PhysicsSystem
from .scene import Scene
from .assets import AssetPipeline
from .compression import TruGameCompressor
from .loader import TruGameLoader
from .license_bridge import gate, status, activate

__version__ = "0.4.1"
__all__ = [
    "TruGameEngine",
    "WorldState",
    "Entity",
    "LicenseError",
    "TruGameStreamer",
    "TruGameRenderer",
    "PhiNetcode",
    "WorldECS",
    "Transform",
    "Mesh",
    "RigidBody",
    "PhysicsSystem",
    "Scene",
    "AssetPipeline",
    "TruGameCompressor",
    "TruGameLoader",
    "gate",
    "status",
    "activate",
]
