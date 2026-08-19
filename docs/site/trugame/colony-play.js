/** Browser game engine — same stack as src/, no Node APIs. */
const SENSE = 29;
const SPEAK = 36;
const EVENTS = [
  { id: "good", title: "Clear street", blurb: "Lux 120. Quiet. Organs want to spend.", lux: 120, noise: 20, temp: 32, speed: 0 },
  { id: "bar", title: "Dark noisy bar", blurb: "Oculus blinds. Auris starves. Leftover wants a home.", lux: 3, noise: 85, temp: 34, speed: 0 },
  { id: "thermal", title: "Skin 46.5 °C", blurb: "Cor vetoes vision. Hold meaning or go black.", lux: 40, noise: 25, temp: 46.5, speed: 0 },
  { id: "run", title: "Hard run", blurb: "Gait eats the bid. Flash or lose the mile.", lux: 90, noise: 40, temp: 41, speed: 3.2 },
  { id: "upload", title: "Desk pipe starves", blurb: "Nexus wants the watt. Videns can wait.", lux: 180, noise: 15, temp: 38, speed: 0 },
  { id: "empty", title: "Range almost gone", blurb: "Pack is empty. Gait gets a sip.", lux: 70, noise: 20, temp: 36, speed: 1.1 },
];

function hash32(n) {
  let x = (n >>> 0) + 0x9e3779b9;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return (x ^ (x >>> 16)) >>> 0;
}

function makeCell(seed) {
  const sense = new Float64Array(SENSE);
  let s = seed >>> 0;
  for (let i = 0; i < SENSE; i++) sense[i] = ((s = hash32(s + i)) & 255) / 255;
  return { seed, sense, speak: new Float64Array(SPEAK), alive: true, ticks: 0 };
}

function tick(cell, world) {
  const g = Math.max(0, Math.min(1, world.grant / 80));
  cell.sense[0] = world.lux / 200;
  cell.sense[1] = world.noise / 100;
  cell.sense[2] = Math.max(0, (world.temp - 20) / 30);
  cell.sense[3] = g;
  for (let i = 4; i < SENSE; i++) {
    const nse = ((hash32(cell.seed + cell.ticks * 17 + i) & 255) / 255 - 0.5) * 0.04;
    cell.sense[i] = Math.max(0, Math.min(1, cell.sense[i] * 0.86 + cell.sense[i % 4] * 0.1 + nse));
  }
  const mouths = Math.max(4, Math.round(g * SPEAK));
  for (let i = 0; i < SPEAK; i++) {
    const a = cell.sense[i % SENSE];
    cell.speak[i] = i >= mouths ? cell.speak[i] * 0.5 : Math.max(0, Math.min(1, a * 0.7 + cell.speak[i] * 0.3));
  }
  cell.ticks++;
  const e = [...cell.sense].reduce((s, v) => s + v, 0) / SENSE;
  if (e < 0.02 || e > 2.4) cell.alive = false;
}

function leftover(cell) {
  let e = 0;
  const res = [];
  for (let i = 0; i < SPEAK; i++) {
    const d = cell.speak[i] - cell.sense[i % SENSE];
    res.push(d);
    e += d * d;
  }
  return { residual: res, energy: e / SPEAK };
}

function custos(energy, peak) {
  if (energy > 0.55) return { open: false, reason: "raw-dump" };
  if (peak > 0.97) return { open: false, reason: "identity-spike" };
  return { open: true, reason: "ok" };
}

function market(budget, bids, thermal) {
  const grants = {};
  let left = budget;
  if (thermal) grants.Oculus = 0;
  for (const b of [...bids].sort((a, c) => c.need - a.need)) {
    if (grants[b.who] === 0) continue;
    const g = Math.min(b.ask, left);
    grants[b.who] = g;
    left -= g;
  }
  return grants;
}

export function newGame() {
  return {
    turn: 0,
    max: 8,
    score: 0,
    dumps: 0,
    hops: 0,
    flashes: 0,
    hunger: 40,
    face: 1,
    hopTo: "hold",
    cell: makeCell(33),
    pack: null,
    desk: null,
    log: ["Session start. You are Colony. Cor will ask what you need."],
    over: null,
  };
}

export function resolveTurn(g) {
  if (g.over) return g;
  const ev = EVENTS[g.turn % EVENTS.length];
  const thermal = ev.temp > 45;
  const grants = market(
    200,
    [
      { who: "Oculus", ask: ev.lux < 8 ? 20 : 80, need: ev.lux < 8 ? 0.2 : 0.85 },
      { who: "Auris", ask: ev.noise > 70 ? 70 : 40, need: ev.noise > 70 ? 0.8 : 0.35 },
      { who: "Gait", ask: ev.speed > 2 ? 70 : 20, need: ev.speed > 2 ? 0.9 : 0.15 },
      { who: "Colony", ask: g.hunger, need: 0.75 },
    ],
    thermal,
  );
  const grant = grants.Colony || 8;
  tick(g.cell, { lux: ev.lux, noise: ev.noise, temp: ev.temp, grant });
  const left = leftover(g.cell);
  const peak = Math.max(...g.cell.speak);
  const cloak = custos(left.energy, peak);
  const wantFlash = ev.lux < 8 || thermal || ev.speed > 2 || ev.id === "upload" || ev.id === "empty";

  let note = `${ev.title}. Cor gave Colony ${grant} mW.`;
  if (!g.cell.alive) {
    g.over = "lose";
    note += " Colony died.";
  } else if (!cloak.open) {
    g.dumps++;
    g.score -= 8;
    note += ` Custos ${cloak.reason}.`;
    if (g.dumps >= 3) {
      g.over = "lose";
      note += " Three dumps. Session black.";
    }
  } else if (wantFlash) {
    g.flashes++;
    g.score += 10;
    note += " FLASH leftover.";
    if (g.hopTo === "pack") {
      g.pack = { energy: left.energy, face: g.face };
      g.hops++;
      g.score += 15;
      note += " Hop → Pack.";
    } else if (g.hopTo === "desk") {
      g.desk = { energy: left.energy, face: g.face };
      g.hops++;
      g.score += 15;
      note += " Hop → Desk.";
    } else {
      note += " Held in Capture.";
      g.score += 4;
    }
  } else {
    note += " Quiet tick.";
    g.score += 2;
  }

  g.turn++;
  g.last = { ev, grants, leftover: left.energy, cloak, wantFlash };
  g.log.unshift(note);
  if (g.log.length > 10) g.log.pop();
  if (!g.over && g.turn >= g.max) {
    g.over = g.hops >= 1 && g.flashes >= 1 ? "win" : "lose";
    g.score += g.cell.alive ? 20 : 0;
    g.log.unshift(g.over === "win" ? "Session held. Memory has a hop." : "Session ended with nothing to keep.");
  }
  return g;
}

export { EVENTS };
