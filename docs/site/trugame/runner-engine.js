/** Runner host. Same 29/36 cell as Front. Glass is the run. */
const SENSE = 29;
const SPEAK = 36;

function hash32(n) {
  let x = (n >>> 0) + 0x9e3779b9;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return (x ^ (x >>> 16)) >>> 0;
}
function mean(a) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i];
  return s / (a.length || 1);
}

function makeCell(seed) {
  const sense = new Float64Array(SENSE);
  const speak = new Float64Array(SPEAK);
  let s = seed >>> 0;
  for (let i = 0; i < SENSE; i++) sense[i] = ((s = hash32(s + i)) & 255) / 255;
  return { seed, sense, speak, alive: true, ticks: 0, strength: 1, heat: 0 };
}

function tickCell(cell, world) {
  if (!cell.alive) return;
  const g = Math.max(0, Math.min(1, (world.grant || 50) / 160));
  cell.sense[0] = world.night;
  cell.sense[1] = world.mud;
  cell.sense[2] = world.heat;
  cell.sense[3] = g;
  for (let i = 4; i < SENSE; i++) {
    const nse = ((hash32(cell.seed + cell.ticks * 19 + i) & 255) / 255 - 0.5) * 0.06;
    cell.sense[i] = Math.max(0, Math.min(1, cell.sense[i] * 0.82 + cell.sense[i % 4] * 0.14 + nse));
  }
  const mouths = Math.max(6, Math.round(g * SPEAK));
  for (let i = 0; i < SPEAK; i++) {
    const a = cell.sense[i % SENSE];
    const b = cell.sense[(i * 3) % SENSE];
    cell.speak[i] = i >= mouths ? cell.speak[i] * 0.4 : Math.max(0, Math.min(1, a * 0.45 + b * 0.35 + cell.speak[i] * 0.2));
  }
  cell.ticks++;
  cell.strength = Math.max(0.15, Math.min(1.7, mean(cell.speak) * 1.55 + 0.2));
  let leftover = 0;
  for (let i = 0; i < SPEAK; i++) {
    const d = cell.speak[i] - cell.sense[i % SENSE];
    leftover += d * d;
  }
  cell.heat = leftover / SPEAK;
  if (cell.heat > 0.62) cell.strength *= 0.86;
}

const GROUND = 0.78;

export function seedRun(seed = (Date.now() % 99991) | 0) {
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
    hazards: [],
    sparks: [],
    shake: 0,
    night: 0.4,
    mud: 0.2,
    heat: 0.3,
    deadAt: 0,
  };
}

export function jump(g) {
  if (!g.alive) return;
  if (g.y >= GROUND - 0.002) {
    g.vy = -0.018;
    g.sliding = 0;
  }
}
export function slide(g) {
  if (!g.alive) return;
  if (g.y >= GROUND - 0.002) g.sliding = 18;
}
export function dash(g) {
  if (!g.alive || g.dash > 0) return;
  g.dash = 14;
  g.host.heat += 0.08;
}

function spawnHazard(g) {
  const peak = Math.max(...g.foe.speak);
  const kind = peak > 0.72 ? "high" : g.foe.sense[1] > 0.55 ? "low" : g.rng > 0.55 ? "gap" : "block";
  g.hazards.push({
    x: g.x + 1.35 + g.foe.strength * 0.4,
    w: kind === "gap" ? 0.22 : 0.1,
    kind,
    hit: false,
  });
}

export function step(g, dt) {
  if (!g.alive) {
    g.deadAt += dt;
    return g;
  }
  g.t += dt;
  g.rng = (hash32((g.seed + g.t * 1000) | 0) >>> 0) / 4294967296;
  const speed = 0.42 + g.host.strength * 0.35 + (g.dash > 0 ? 0.55 : 0);
  g.x += speed * dt;
  g.dist = g.x * 120;

  g.night = 0.25 + 0.5 * (0.5 + 0.5 * Math.sin(g.t * 0.11));
  g.mud = 0.15 + g.host.sense[1] * 0.5;
  g.heat = 0.2 + g.host.sense[2] * 0.5;
  tickCell(g.host, { night: g.night, mud: g.mud, heat: g.heat, grant: 40 + (g.dash > 0 ? 50 : 20) });
  tickCell(g.foe, { night: g.night, mud: g.mud, heat: g.heat, grant: 45 + g.t * 0.4 });

  g.vy += 0.055 * dt;
  g.y += g.vy;
  if (g.y > GROUND) {
    g.y = GROUND;
    g.vy = 0;
  }
  if (g.sliding > 0) g.sliding--;
  if (g.dash > 0) g.dash--;
  if (g.shake > 0) g.shake *= 0.86;

  if (g.hazards.length === 0 || g.hazards[g.hazards.length - 1].x < g.x + 1.1) {
    if (g.rng < 0.045 + Math.min(0.08, g.t * 0.002)) spawnHazard(g);
  }
  g.hazards = g.hazards.filter((h) => h.x > g.x - 0.4);
  const px = g.x + 0.12;
  const py = g.y;
  const ph = g.sliding > 0 ? 0.07 : 0.14;
  for (const h of g.hazards) {
    if (h.hit) continue;
    const overlap = px + 0.06 > h.x && px < h.x + h.w;
    if (!overlap) continue;
    let struck = false;
    if (h.kind === "low" && g.sliding <= 0 && py > GROUND - 0.08) struck = true;
    if (h.kind === "high" && py > GROUND - 0.16 && g.sliding <= 0) struck = true;
    if (h.kind === "block" && py > GROUND - 0.12) struck = true;
    if (h.kind === "gap" && py >= GROUND - 0.002) struck = true;
    if (struck) {
      h.hit = true;
      g.alive = false;
      g.shake = 18;
      for (let i = 0; i < 40; i++) {
        g.sparks.push({
          x: px,
          y: py,
          vx: (g.rng - 0.5) * 0.8,
          vy: -0.2 - g.rng * 0.5,
          life: 1,
        });
      }
    }
  }
  if (g.t * 60 < 3 || g.dash > 0) {
    g.sparks.push({
      x: g.x,
      y: g.y - (g.sliding > 0 ? 0.04 : 0.1),
      vx: -0.4 - g.host.strength * 0.2,
      vy: (g.rng - 0.5) * 0.15,
      life: 0.6,
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

export function draw(ctx, g, w, h) {
  const cam = g.x - 0.22;
  const shakeX = (g.shake && (hash32(g.t * 90) / 0xffffffff - 0.5) * g.shake) || 0;
  const shakeY = (g.shake && (hash32(g.t * 77) / 0xffffffff - 0.5) * g.shake) || 0;
  ctx.save();
  ctx.translate(shakeX, shakeY);
  const sky = g.night;
  ctx.fillStyle = `rgb(${8 + sky * 10},${6 + (1 - sky) * 8},${12 + sky * 18})`;
  ctx.fillRect(0, 0, w, h);
  const grd = ctx.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, `rgba(196,163,90,${0.04 + g.heat * 0.12})`);
  grd.addColorStop(0.55, "rgba(0,0,0,0)");
  grd.addColorStop(1, `rgba(20,40,24,${0.35 + g.mud * 0.3})`);
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, w, h);

  const gy = GROUND * h;
  ctx.strokeStyle = `rgba(196,211,106,${0.35 + g.host.strength * 0.25})`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, gy);
  ctx.lineTo(w, gy);
  ctx.stroke();

  for (let i = 0; i < 18; i++) {
    const px = ((i * 97 - cam * w * 0.9) % (w + 80)) - 40;
    const tall = 40 + ((hash32(i + g.seed) >> 8) % 120);
    ctx.fillStyle = `rgba(30,38,28,${0.25 + sky * 0.3})`;
    ctx.fillRect(px, gy - tall, 18 + (i % 5) * 4, tall);
  }

  const sx = (x) => (x - cam) * w * 0.72;
  for (const hz of g.hazards) {
    const x = sx(hz.x);
    ctx.fillStyle = hz.hit ? "#a34538" : "#c45a4a";
    if (hz.kind === "gap") {
      ctx.fillStyle = "#05060a";
      ctx.fillRect(x, gy - 2, hz.w * w * 0.72, h - gy + 2);
    } else if (hz.kind === "low") {
      ctx.fillRect(x, gy - 18, 28, 18);
    } else if (hz.kind === "high") {
      ctx.fillRect(x, gy - 92, 22, 52);
    } else {
      ctx.fillRect(x, gy - 46, 24, 46);
    }
  }

  const px = sx(g.x + 0.12);
  const py = g.y * h;
  const run = Math.sin(g.t * 18 + g.x * 40);
  ctx.save();
  ctx.translate(px, py);
  ctx.fillStyle = `rgba(196,211,106,${0.15 + g.dash * 0.04})`;
  ctx.beginPath();
  ctx.ellipse(0, 8, 28 + g.dash, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#e8f6a8";
  if (g.sliding > 0) {
    ctx.fillRect(-22, -12, 44, 14);
    ctx.fillStyle = "#c4d36a";
    ctx.fillRect(12, -18, 16, 10);
  } else {
    ctx.fillRect(-10, -42, 20, 36);
    ctx.fillStyle = "#c4d36a";
    ctx.fillRect(-6, -56, 14, 14);
    ctx.strokeStyle = "#e8f6a8";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-8, -8);
    ctx.lineTo(-8 + run * 16, 10);
    ctx.moveTo(8, -8);
    ctx.lineTo(8 - run * 16, 10);
    ctx.stroke();
  }
  ctx.restore();

  for (const s of g.sparks) {
    ctx.globalAlpha = Math.max(0, s.life);
    ctx.fillStyle = "#c4d36a";
    ctx.fillRect(sx(s.x), s.y * h, 3, 3);
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = "#e8dfc8";
  ctx.font = "700 22px Georgia, serif";
  ctx.fillText(String(g.dist | 0) + " m", 18, 36);
  ctx.fillStyle = "#8a806c";
  ctx.font = "13px sans-serif";
  ctx.fillText("SPACE jump · ↓ slide · SHIFT burst", 18, 56);
  if (!g.alive) {
    ctx.fillStyle = "rgba(10,8,6,0.55)";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#c4a35a";
    ctx.font = "700 42px Georgia, serif";
    ctx.fillText("Down.", w / 2 - 70, h / 2 - 10);
    ctx.fillStyle = "#e8dfc8";
    ctx.font = "16px sans-serif";
    ctx.fillText((g.dist | 0) + " m  ·  click to run again", w / 2 - 110, h / 2 + 28);
  }
  ctx.restore();
}
