/** Runner sim. 29/36 cell + frame triad. Glass is the run. */
import { makeCell, tickCell, hash32, imprint } from "./cell.js";
import { createFrame } from "./smart-frame.js";

export const GROUND = 0.78;

function rngAt(seed, t, i) {
  return (hash32((seed + ((t * 1000) | 0) + i * 997) >>> 0) >>> 0) / 4294967296;
}

export function seedRun(seed = (Date.now() % 99991) | 0) {
  const frame = createFrame({
    app: "run",
    spokes: { host: { role: "actor" }, foe: { role: "field" }, world: { role: "sim" } },
  });
  return {
    seed,
    t: 0,
    x: 0,
    y: GROUND,
    vy: 0,
    sliding: 0,
    dash: 0,
    alive: true,
    dist: 0,
    host: makeCell(seed),
    foe: makeCell(seed ^ 0x9e3779b9),
    frame,
    hazards: [],
    sparks: [],
    shake: 0,
    night: 0.4,
    mud: 0.2,
    heat: 0.3,
    deadAt: 0,
    camLook: 0.22,
    landPunch: 0,
    hitStop: 0,
  };
}

export function jump(g) {
  if (!g.alive) return;
  if (g.y >= GROUND - 0.002) {
    g.vy = -0.018;
    g.sliding = 0;
    imprint(g.host, 5, 0.04);
    imprint(g.host, 6, 0.03);
  }
}
export function slide(g) {
  if (!g.alive) return;
  if (g.y >= GROUND - 0.002) {
    g.sliding = 18;
    imprint(g.host, 6, 0.05);
    imprint(g.host, 10, 0.03);
  }
}
export function dash(g) {
  if (!g.alive || g.dash > 0) return;
  const gate = g.frame.allowAdvance({ proved: g.host.heat < 0.55 });
  if (!gate.ok && g.host.heat > 0.55) {
    g.shake = Math.max(g.shake, 8);
    return;
  }
  g.dash = 14;
  g.host.heat += 0.08;
  imprint(g.host, 12, 0.06);
  if (g.host.heat > 0.45) imprint(g.host, 11, 0.04);
}

function spawnHazard(g) {
  const peak = Math.max(...g.foe.speak);
  const r = rngAt(g.seed, g.t, g.hazards.length + 3);
  const kind = peak > 0.72 ? "high" : g.foe.sense[1] > 0.55 ? "low" : r > 0.55 ? "gap" : "block";
  const telegraph = 0.2 + g.host.book[0] * 0.35 + g.host.book[12] * 0.2;
  g.hazards.push({
    x: g.x + 1.35 + g.foe.strength * 0.4 + telegraph,
    w: kind === "gap" ? 0.22 : 0.1,
    kind,
    hit: false,
    pulse: peak,
  });
}

function burstSparks(g, px, py, n, power) {
  for (let i = 0; i < n; i++) {
    const r = rngAt(g.seed, g.t, i + 11);
    const r2 = rngAt(g.seed, g.t + 0.01, i + 29);
    g.sparks.push({
      x: px,
      y: py,
      vx: (r - 0.5) * power,
      vy: -0.15 - r2 * 0.55,
      life: 0.5 + r * 0.7,
    });
  }
}

export function step(g, dt) {
  if (g.hitStop > 0) {
    g.hitStop -= dt;
    g.deadAt += dt;
    g.shake *= 0.92;
    return g;
  }

  if (!g.alive) {
    g.deadAt += dt;
    g.t += dt;
    if (g.shake > 0) g.shake *= 0.88;
    for (const s of g.sparks) {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy += 0.4 * dt;
      s.life -= dt * 1.2;
    }
    g.sparks = g.sparks.filter((s) => s.life > 0);
    return g;
  }

  g.t += dt;
  g.rng = rngAt(g.seed, g.t, 1);
  const speed = 0.42 + g.host.strength * 0.35 + (g.dash > 0 ? 0.55 : 0);
  g.x += speed * dt;
  g.dist = g.x * 120;
  g.camLook = 0.22 + (g.dash > 0 ? 0.08 : 0) + g.vy * -2;

  g.night = 0.25 + 0.5 * (0.5 + 0.5 * Math.sin(g.t * 0.11));
  g.mud = 0.15 + g.host.sense[1] * 0.5;
  g.heat = 0.2 + g.host.sense[2] * 0.5;
  tickCell(g.host, { night: g.night, mud: g.mud, heat: g.heat, grant: 40 + (g.dash > 0 ? 50 : 20) });
  tickCell(g.foe, { night: g.night, mud: g.mud, heat: g.heat, grant: 45 + g.t * 0.4 });
  g.frame.inject("host", { stress: g.host.heat, score: Math.max(0, 100 - g.host.heat * 80), pass: g.host.heat < 0.55 });

  const wasAir = g.y < GROUND - 0.002;
  g.vy += 0.055 * dt;
  g.y += g.vy;
  if (g.y > GROUND) {
    g.y = GROUND;
    if (wasAir) {
      g.landPunch = 1;
      imprint(g.host, 4, 0.03);
    }
    g.vy = 0;
  }
  if (g.landPunch > 0) g.landPunch *= 0.82;
  if (g.sliding > 0) g.sliding--;
  if (g.dash > 0) g.dash--;
  if (g.shake > 0) g.shake *= 0.86;

  if (g.t > 8) imprint(g.host, 2, 0.0004);
  if (g.t > 4) imprint(g.host, 9, 0.0003);

  if (g.hazards.length === 0 || g.hazards[g.hazards.length - 1].x < g.x + 1.1) {
    if (g.rng < 0.045 + Math.min(0.08, g.t * 0.002)) spawnHazard(g);
  }
  g.hazards = g.hazards.filter((h) => h.x > g.x - 0.4);
  const px = g.x + 0.12;
  const py = g.y;
  for (const h of g.hazards) {
    if (h.hit) continue;
    const overlap = px + 0.06 > h.x && px < h.x + h.w;
    if (!overlap) continue;
    let struck = false;
    if (h.kind === "low" && g.sliding <= 0 && py > GROUND - 0.08) struck = true;
    if (h.kind === "high" && py > GROUND - 0.16 && g.sliding <= 0) struck = true;
    if (h.kind === "block" && py > GROUND - 0.12) struck = true;
    if (h.kind === "gap" && py >= GROUND - 0.002) struck = true;
    if (!struck) {
      imprint(g.host, 3, 0.05);
      imprint(g.host, 8, 0.02);
    }
    if (struck) {
      h.hit = true;
      g.alive = false;
      g.shake = 18;
      g.hitStop = 0.04;
      burstSparks(g, px, py, 48, 0.95);
    }
  }
  if (g.dash > 0 || (g.t * 60 < 3)) {
    g.sparks.push({
      x: g.x,
      y: g.y - (g.sliding > 0 ? 0.04 : 0.1),
      vx: -0.4 - g.host.strength * 0.2,
      vy: (rngAt(g.seed, g.t, 77) - 0.5) * 0.15,
      life: 0.55,
    });
  }
  for (const s of g.sparks) {
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.vy += 0.4 * dt;
    s.life -= dt * 1.8;
  }
  g.sparks = g.sparks.filter((s) => s.life > 0);
  return g;
}
