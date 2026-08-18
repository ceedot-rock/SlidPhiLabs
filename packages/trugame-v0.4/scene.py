from dataclasses import dataclass, field
from typing import Dict
from pathlib import Path
from .ecs import WorldECS, Transform, Mesh

@dataclass
class Scene:
    name: str
    ecs: WorldECS = field(default_factory=WorldECS)
    original_assets: Dict[str, str] = field(default_factory=dict)

    def add_mesh_instance(self, original_path: str, pos, rot=None, lod=0):
        if rot is None:
            rot = [0, 0, 0]
        eid = self.ecs.create_entity(
            Transform(pos=pos, rot=rot),
            Mesh(
                path=original_path,
                trugamem_path=f"trugame_dist/{Path(original_path).stem}.trugamem",
                lod=lod,
            ),
        )
        self.original_assets[original_path] = original_path
        return eid

    def to_manifest(self):
        data = {
            "scene": self.name,
            "entities": len(self.ecs.entities),
            "original_assets_kept": True,
            "instances": [],
        }
        for eid, (trans, mesh) in self.ecs.query(Transform, Mesh):
            data["instances"].append({
                "id": eid,
                "pos": trans.pos,
                "original": mesh.path,
                "separate": mesh.trugamem_path,
                "lod": mesh.lod,
            })
        return data
