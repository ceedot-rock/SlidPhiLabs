from .ecs import WorldECS, Transform, RigidBody

class PhysicsSystem:
    def __init__(self, gravity=[0, -9.81, 0]):
        self.gravity = gravity

    def tick(self, ecs: WorldECS, dt: float):
        for _, (trans, body) in ecs.query(Transform, RigidBody):
            if body.is_static:
                continue
            body.vel[0] += self.gravity[0] * dt
            body.vel[1] += self.gravity[1] * dt
            body.vel[2] += self.gravity[2] * dt
            trans.pos[0] += body.vel[0] * dt
            trans.pos[1] += body.vel[1] * dt
            trans.pos[2] += body.vel[2] * dt
            if trans.pos[1] < 0:
                trans.pos[1] = 0
                body.vel[1] = 0
