/**
 * Front — campaign engine.
 * Internally: Autonoma tick + leftover + Cor market + Custos + Capture/Route/Memory.
 * Externally: desk → card → camp → fight → residual → desk. /webber law.
 */
const SENSE = 29;
const SPEAK = 36;
const THEATERS = [
  { id: "ridge", name: "The Ridge", night: 0.8, mud: 0.2, heat: 0.3 },
  { id: "river", name: "The River", night: 0.3, mud: 0.9, heat: 0.2 },
  { id: "rail", name: "The Rail", night: 0.4, mud: 0.3, heat: 0.5 },
  { id: "city", name: "The City", night: 0.6, mud: 0.4, heat: 0.7 },
];

function hash32(n) {
  let x = (n >>> 0) + 0x9e3779b9;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return (x ^ (x >>> 16)) >>> 0;
}
function mulberry(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCell(seed) {
  const sense = new Float64Array(SENSE);
  let s = seed >>> 0;
  for (let i = 0; i < SENSE; i++) sense[i] = ((s = hash32(s + i)) & 255) / 255;
  return { seed, sense, speak: new Float64Array(SPEAK), alive: true, ticks: 0, strength: 1 };
}

function tickCell(cell, world) {
  if (!cell.alive) return;
  const g = Math.max(0, Math.min(1, (world.grant || 40) / 200));
  cell.sense[0] = world.night;
  cell.sense[1] = world.mud;
  cell.sense[2] = world.heat;
  cell.sense[3] = g;
  for (let i = 4; i < SENSE; i++) {
    const nse = ((hash32(cell.seed + cell.ticks * 19 + i) & 255) / 255 - 0.5) * 0.05;
    cell.sense[i] = Math.max(0, Math.min(1, cell.sense[i] * 0.84 + cell.sense[i % 4] * 0.12 + nse));
  }
  const mouths = Math.max(4, Math.round(g * SPEAK));
  for (let i = 0; i < SPEAK; i++) {
    const a = cell.sense[i % SENSE];
    const b = cell.sense[(i * 3) % SENSE];
    cell.speak[i] = i >= mouths ? cell.speak[i] * 0.45 : Math.max(0, Math.min(1, a * 0.5 + b * 0.35 + cell.speak[i] * 0.15));
  }
  cell.ticks++;
  const e = mean(cell.sense) + mean(cell.speak);
  if (e < 0.02 || e > 2.5) cell.alive = false;
  cell.strength = Math.max(0.05, Math.min(1.4, mean(cell.speak) * 1.6 * cell.strength ** 0.5 + 0.2));
}

function leftoverEnergy(cell) {
  let e = 0;
  for (let i = 0; i < SPEAK; i++) {
    const d = cell.speak[i] - cell.sense[i % SENSE];
    e += d * d;
  }
  return e / SPEAK;
}

function mean(a) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i];
  return s / a.length;
}

function grantBudget(supply, asks) {
  let left = supply;
  const out = {};
  for (const a of [...asks].sort((x, y) => y.need - x.need)) {
    const g = Math.min(a.ask, left);
    out[a.who] = g;
    left -= g;
  }
  return out;
}

function illegal(energy, peak) {
  if (energy > 0.55) return "overreach";
  if (peak > 0.97) return "broke-contact";
  return null;
}

export function seedWorld(seed = 27) {
  const rng = mulberry(seed);
  const units = (tag, n0) =>
    [0, 1, 2].map((i) => ({
      who: tag,
      cell: makeCell((seed * 17 + tag.charCodeAt(0) * 13 + i) >>> 0),
    }));
  return {
    seed,
    week: 1,
    supply: 100,
    cash: 12,
    held: [],
    losses: 0,
    wins: 0,
    streak: 0,
    lastLine: "No action yet.",
    card: null,
    accepted: null,
    needRead: false,
    atDesk: true,
    camp: { take: 0, supply: 0, hold: 0, weeks: 0 },
    you: { take: units("t"), supply: units("s"), hold: units("h") },
    them: { take: units("T"), supply: units("S"), hold: units("H") },
    log: [],
    rng,
    over: null,
  };
}

export function buildCard(w) {
  const open = THEATERS.filter((t) => !w.held.includes(t.id));
  const pool = open.length ? open : THEATERS;
  const pick = pool[Math.floor(w.rng() * pool.length)];
  w.card = {
    week: w.week,
    theater: pick,
    night: pick.night,
    mud: pick.mud,
    heat: pick.heat,
  };
  return w;
}

export function acceptCard(w, yes) {
  if (!w.card) buildCard(w);
  w.accepted = !!yes;
  if (!yes) {
    w.streak = 0;
    w.lastLine = "You sat. The line moved without you.";
  }
  return w;
}

export function campWeek(w, focus) {
  const f = ["take", "supply", "hold", "rest"].includes(focus) ? focus : "rest";
  if (f !== "rest") w.camp[f] = (w.camp[f] || 0) + 1;
  w.camp.weeks = (w.camp.weeks || 0) + 1;
  const world = {
    night: w.card?.night ?? 0.4,
    mud: w.card?.mud ?? 0.3,
    heat: w.card?.heat ?? 0.3,
    grant: f === "rest" ? 30 : 70,
  };
  const side = w.you[f === "rest" ? "hold" : f] || w.you.hold;
  for (const u of side) tickCell(u.cell, world);
  for (const k of ["take", "supply", "hold"]) {
    for (const u of w.them[k]) tickCell(u.cell, { ...world, grant: 55 });
  }
  w.supply = Math.max(20, Math.min(140, w.supply + (f === "supply" ? 12 : f === "rest" ? 6 : -4)));
  w.week += 1;
  return w;
}

/** One battle: 16 ticks, 5 sectors. Take pushes, supply feeds, hold keeps. */
export function fight(w) {
  if (!w.accepted || !w.card) return w;
  const th = w.card.theater;
  const grants = grantBudget(w.supply, [
    { who: "take", ask: 40 + w.camp.take * 10, need: 0.5 + w.camp.take * 0.15 },
    { who: "supply", ask: 30 + w.camp.supply * 8, need: 0.4 + w.camp.supply * 0.1 },
    { who: "hold", ask: 30 + w.camp.hold * 8, need: 0.45 + w.camp.hold * 0.12 },
  ]);
  const hex = [0, 0, 0, 0, 0];
  const ticks = [];
  for (let t = 0; t < 16; t++) {
    const env = { night: th.night, mud: th.mud, heat: th.heat + t * 0.01, grant: grants.take };
    for (const u of w.you.take) tickCell(u.cell, { ...env, grant: grants.take });
    for (const u of w.you.supply) tickCell(u.cell, { ...env, grant: grants.supply });
    for (const u of w.you.hold) tickCell(u.cell, { ...env, grant: grants.hold });
    for (const k of ["take", "supply", "hold"]) {
      for (const u of w.them[k]) tickCell(u.cell, { ...env, grant: 50 });
    }
    const push =
      mean(w.you.take.map((u) => u.cell.strength)) +
      mean(w.you.supply.map((u) => u.cell.strength)) * 0.35;
    const hold =
      mean(w.them.take.map((u) => u.cell.strength)) +
      mean(w.them.hold.map((u) => u.cell.strength)) * 0.4;
    const edge = push - hold + (w.rng() - 0.5) * 0.55;
    const i = Math.min(4, Math.max(0, 2 + Math.round(edge * 4)));
    hex[i] += edge > 0 ? 1 : -1;
    const energy = leftoverEnergy(w.you.take[0].cell);
    const peak = Math.max(...w.you.take[0].cell.speak);
    const foul = illegal(energy, peak);
    ticks.push({ t, edge, hex: i, foul });
    if (foul === "overreach") {
      hex[i] -= 2;
      w.supply -= 8;
    }
  }
  const score = hex.reduce((s, v) => s + v, 0);
  const won = score > 0;
  if (won) {
    if (!w.held.includes(th.id)) w.held.push(th.id);
    w.wins += 1;
    w.streak = Math.max(0, w.streak) + 1;
    w.cash += 4;
    w.lastLine = `${th.name} held. Line moved.`;
  } else {
    w.losses += 1;
    w.streak = Math.min(0, w.streak) - 1;
    w.cash -= 2;
    w.supply = Math.max(16, w.supply - 10);
    w.lastLine = `${th.name} lost. You fall back.`;
  }
  w.lastFight = { theater: th, hex, score, won, ticks: ticks.length, grants };
  w.needRead = true;
  w.card = null;
  w.accepted = null;
  w.camp = { take: 0, supply: 0, hold: 0, weeks: 0 };
  w.week += 1;
  if (w.losses >= 3 && w.wins === 0) w.over = "lose";
  if (w.held.length >= 4) w.over = "win";
  if (w.cash < 0) w.over = "lose";
  return w;
}

export function readResidual(w) {
  w.needRead = false;
  w.atDesk = true;
  return w;
}

export function leaveDesk(w) {
  w.atDesk = false;
  if (!w.card && (w.week % 4 === 1 || w.week === 1)) buildCard(w);
  return w;
}

export function beat(w) {
  if (w.over) return "desk";
  if (w.needRead) return "residual";
  if (w.atDesk) return "desk";
  if (!w.card && (w.week % 4 === 1 || w.week === 1)) return "card";
  if (w.card && w.accepted === null) return "card";
  if (w.card && w.accepted === true) {
    return (w.camp.weeks || 0) < 3 ? "camp" : "fight";
  }
  return "desk";
}

export { THEATERS };
