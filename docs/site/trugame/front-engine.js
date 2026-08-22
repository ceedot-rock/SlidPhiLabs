/**
 * Front — war. Warriors on a field.
 * Cells train on the thirteen chapters. The glass never says the cell name.
 */
const SENSE = 29;
const SPEAK = 36;

/** Sun Tzu, thirteen chapters. Each is a drill that writes a sense channel. */
export const BOOK = [
  { id: "l1", ch: 1, name: "Estimates", line: "Measure the field before you move.", sense: 4, take: 0.1, hold: 0.2, spy: 0.4 },
  { id: "l2", ch: 2, name: "Waging War", line: "A long war empties the wagons.", sense: 5, take: 0.1, hold: 0.1, spy: 0, supply: 0.5 },
  { id: "l3", ch: 3, name: "Attack by Stratagem", line: "The best victory is to take them whole.", sense: 6, take: 0.45, hold: 0.05, spy: 0.2 },
  { id: "l4", ch: 4, name: "Tactical Dispositions", line: "First make yourself unconquerable.", sense: 7, take: 0.05, hold: 0.5, spy: 0 },
  { id: "l5", ch: 5, name: "Energy", line: "Strike as a millstone on an egg.", sense: 8, take: 0.5, hold: 0.05, spy: 0 },
  { id: "l6", ch: 6, name: "Weak Points", line: "Hit them where they are empty.", sense: 9, take: 0.55, hold: 0, spy: 0.15 },
  { id: "l7", ch: 7, name: "Maneuver", line: "The clever fight after they have already won the road.", sense: 10, take: 0.25, hold: 0.15, spy: 0.1 },
  { id: "l8", ch: 8, name: "Variation", line: "There are roads not to take, armies not to strike.", sense: 11, take: 0.15, hold: 0.35, spy: 0.1 },
  { id: "l9", ch: 9, name: "The March", line: "Read the dust. Read the birds.", sense: 12, take: 0.2, hold: 0.1, spy: 0.45 },
  { id: "l10", ch: 10, name: "Terrain", line: "Ground decides who may stand.", sense: 13, take: 0.15, hold: 0.45, spy: 0.1 },
  { id: "l11", ch: 11, name: "Nine Situations", line: "On desperate ground, fight.", sense: 14, take: 0.4, hold: 0.2, spy: 0 },
  { id: "l12", ch: 12, name: "Attack by Fire", line: "Fire when the wind is yours.", sense: 15, take: 0.5, hold: 0, spy: 0 },
  { id: "l13", ch: 13, name: "Use of Spies", line: "Foreknowledge. Nothing else wins first.", sense: 16, take: 0.1, hold: 0.1, spy: 0.7 },
];

export const SLOTS = [
  { id: 0, name: "Left wing" },
  { id: 1, name: "Left" },
  { id: 2, name: "Center" },
  { id: 3, name: "Right" },
  { id: 4, name: "Right wing" },
];

export const STRATAGEMS = [
  { id: "unprepared", name: "Strike the unprepared", need: "l6", take: 1.2, hold: 0.4, spy: 0.3 },
  { id: "unconquerable", name: "Stand unconquerable", need: "l4", take: 0.35, hold: 1.3, spy: 0.1 },
  { id: "whole", name: "Take them whole", need: "l3", take: 0.9, hold: 0.6, spy: 0.4 },
  { id: "wagons", name: "Cut the wagons", need: "l2", take: 0.5, hold: 0.4, spy: 0.2, supplyHit: 14 },
  { id: "millstone", name: "Millstone on an egg", need: "l5", take: 1.35, hold: 0.2, spy: 0 },
  { id: "dust", name: "Read the dust", need: "l9", take: 0.6, hold: 0.5, spy: 1.2 },
  { id: "desperate", name: "Desperate ground", need: "l11", take: 1.1, hold: 0.8, spy: 0 },
  { id: "fire", name: "Fire with the wind", need: "l12", take: 1.25, hold: 0.15, spy: 0 },
];

const YOU_NAMES = [
  { name: "Rook", role: "Captain" },
  { name: "Ivy", role: "Scout" },
  { name: "Hale", role: "Vanguard" },
  { name: "Moth", role: "Wing" },
  { name: "Bram", role: "Reserve" },
];
const THEM_NAMES = [
  { name: "Kestrel", role: "Captain" },
  { name: "Ash", role: "Scout" },
  { name: "Vane", role: "Vanguard" },
  { name: "Pike", role: "Wing" },
  { name: "Dorr", role: "Reserve" },
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
function mean(a) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i];
  return s / a.length;
}

function makeCell(seed) {
  const sense = new Float64Array(SENSE);
  const book = new Float64Array(13);
  let s = seed >>> 0;
  for (let i = 0; i < SENSE; i++) sense[i] = ((s = hash32(s + i)) & 255) / 255 * 0.25;
  return {
    seed,
    sense,
    speak: new Float64Array(SPEAK),
    book,
    alive: true,
    ticks: 0,
    strength: 0.55,
    wounds: 0,
  };
}

function tickCell(cell, world) {
  if (!cell.alive) return;
  const g = Math.max(0, Math.min(1, (world.grant || 50) / 160));
  cell.sense[0] = world.night ?? 0.4;
  cell.sense[1] = world.mud ?? 0.3;
  cell.sense[2] = world.heat ?? 0.4;
  cell.sense[3] = g;
  for (let i = 0; i < 13; i++) {
    const idx = 4 + i;
    const trained = cell.book[i];
    const nse = ((hash32(cell.seed + cell.ticks * 19 + i) & 255) / 255 - 0.5) * 0.04;
    cell.sense[idx] = Math.max(0, Math.min(1, cell.sense[idx] * 0.72 + trained * 0.22 + nse));
  }
  for (let i = 17; i < SENSE; i++) {
    cell.sense[i] = cell.sense[i] * 0.9 + cell.sense[i % 13 + 4] * 0.08;
  }
  const mouths = Math.max(6, Math.round(8 + g * 20 + mean(cell.book) * 12));
  for (let i = 0; i < SPEAK; i++) {
    const a = cell.sense[i % SENSE];
    const b = cell.sense[(i * 3) % SENSE];
    const drill = cell.book[i % 13];
    cell.speak[i] =
      i >= mouths
        ? cell.speak[i] * 0.5
        : Math.max(0, Math.min(1, a * 0.35 + b * 0.25 + drill * 0.25 + cell.speak[i] * 0.15));
  }
  cell.ticks++;
  const e = mean(cell.sense) + mean(cell.speak);
  if (e < 0.02 || cell.wounds >= 3) cell.alive = false;
  cell.strength = Math.max(0.08, Math.min(1.6, mean(cell.speak) * 1.4 + mean(cell.book) * 0.5 - cell.wounds * 0.18));
}

function leftover(cell) {
  let e = 0;
  for (let i = 0; i < SPEAK; i++) {
    const d = cell.speak[i] - cell.sense[i % SENSE];
    e += d * d;
  }
  return e / SPEAK;
}

function skill(cell, maximId) {
  const m = BOOK.find((b) => b.id === maximId);
  if (!m) return 0;
  return cell.book[m.ch - 1] * 0.7 + cell.sense[m.sense] * 0.3;
}

function makeWarrior(seed, spec, foe) {
  return {
    name: spec.name,
    role: spec.role,
    foe,
    cell: makeCell(seed),
    drills: [],
    slot: null,
  };
}

export function seedWar(seed = 27) {
  const rng = mulberry(seed);
  const you = YOU_NAMES.map((n, i) => makeWarrior((seed * 19 + i * 97) >>> 0, n, false));
  const them = THEM_NAMES.map((n, i) => makeWarrior((seed * 31 + i * 53 + 7) >>> 0, n, true));
  for (const w of them) {
    const picks = [...BOOK].sort(() => rng() - 0.5).slice(0, 3 + Math.floor(rng() * 3));
    for (const m of picks) drillWarrior(w, m.id);
  }
  return {
    seed,
    rng,
    day: 1,
    supply: 100,
    you,
    them,
    field: [null, null, null, null, null],
    enemyField: [null, null, null, null, null],
    phase: "drill",
    round: 0,
    log: ["Five warriors. The book is open. Drill them, then take the field."],
    last: null,
    over: null,
    selected: 0,
  };
}

export function drillWarrior(w, maximId) {
  const m = BOOK.find((b) => b.id === maximId);
  if (!m || !w.cell.alive) return w;
  w.cell.book[m.ch - 1] = Math.min(1, w.cell.book[m.ch - 1] + 0.34);
  tickCell(w.cell, { night: 0.3, mud: 0.2, heat: 0.3, grant: 90 });
  if (!w.drills.includes(m.id)) w.drills.push(m.id);
  return w;
}

export function drill(g, warriorIndex, maximId) {
  if (g.phase !== "drill" || g.over) return g;
  const w = g.you[warriorIndex];
  if (!w) return g;
  drillWarrior(w, maximId);
  const m = BOOK.find((b) => b.id === maximId);
  g.supply = Math.max(40, g.supply - 4);
  g.log.unshift(`${w.name} drills ${m.name}. “${m.line}”`);
  g.selected = warriorIndex;
  return g;
}

export function deploy(g, slots) {
  if (g.phase !== "drill" || g.over) return g;
  const used = new Set();
  for (let i = 0; i < 5; i++) {
    const idx = slots[i];
    if (idx == null || idx < 0 || used.has(idx) || !g.you[idx]) return g;
    used.add(idx);
  }
  g.field = slots.map((idx, slot) => {
    g.you[idx].slot = slot;
    return g.you[idx];
  });
  const order = [0, 1, 2, 3, 4].sort(() => g.rng() - 0.5);
  g.enemyField = order.map((idx, slot) => {
    g.them[idx].slot = slot;
    return g.them[idx];
  });
  g.phase = "fight";
  g.round = 1;
  g.log.unshift("The field is set. Five against five. Command a blow.");
  return g;
}

function enemyStratagem(g, foe) {
  const scored = STRATAGEMS.map((s) => ({ s, v: skill(foe.cell, s.need) + g.rng() * 0.2 }));
  scored.sort((a, b) => b.v - a.v);
  return scored[0].s;
}

export function command(g, stratagemId, slot) {
  if (g.phase !== "fight" || g.over) return g;
  const s = STRATAGEMS.find((x) => x.id === stratagemId);
  const us = g.field[slot];
  const them = g.enemyField[slot];
  if (!s || !us || !them) return g;

  const night = 0.35 + g.round * 0.04;
  const env = { night, mud: 0.25 + (slot % 2) * 0.2, heat: 0.3 + slot * 0.05, grant: 55 + g.supply * 0.2 };
  tickCell(us.cell, { ...env, grant: env.grant + skill(us.cell, s.need) * 40 });
  const es = enemyStratagem(g, them);
  tickCell(them.cell, { ...env, grant: 50 + skill(them.cell, es.need) * 36 });

  const our =
    us.cell.strength * (0.5 + s.take * skill(us.cell, s.need)) +
    skill(us.cell, "l10") * 0.2 +
    skill(us.cell, "l13") * 0.15;
  const his =
    them.cell.strength * (0.5 + es.hold * 0.5 + es.take * 0.3) +
    skill(them.cell, "l4") * 0.25;
  let edge = our - his + (g.rng() - 0.5) * 0.22;
  if (leftover(us.cell) > 0.55) {
    edge -= 0.35;
    g.supply -= 6;
    g.log.unshift(`${us.name} overreached. The line broke contact.`);
  }
  if (s.supplyHit) {
    g.supply = Math.max(20, g.supply - 3);
  }

  let line;
  if (edge > 0.12) {
    them.cell.wounds += 1;
    tickCell(them.cell, env);
    line = `${us.name} (${s.name}) drives ${them.name} on the ${SLOTS[slot].name}.`;
    if (!them.cell.alive) line = `${us.name} breaks ${them.name}. The ${SLOTS[slot].name} is yours.`;
  } else if (edge < -0.12) {
    us.cell.wounds += 1;
    tickCell(us.cell, env);
    line = `${them.name} answers ${us.name}. ${es.name}.`;
    if (!us.cell.alive) line = `${us.name} falls on the ${SLOTS[slot].name}.`;
  } else {
    line = `Dust on the ${SLOTS[slot].name}. Neither yields.`;
  }

  g.last = { slot, stratagem: s, enemy: es, edge, line };
  g.log.unshift(line);
  g.round += 1;
  g.supply = Math.max(12, g.supply - 5);
  g.day += 1;

  const livingYou = g.field.filter((w) => w.cell.alive).length;
  const livingThem = g.enemyField.filter((w) => w.cell.alive).length;
  const capYou = g.you[0].cell.alive;
  const capThem = g.them[0].cell.alive;
  if (!capYou || livingYou === 0) {
    g.over = "lose";
    g.log.unshift("The host is broken.");
  } else if (!capThem || livingThem === 0) {
    g.over = "win";
    g.log.unshift("Their captain is down. The field is yours.");
  } else if (g.round > 9) {
    g.over = livingYou > livingThem ? "win" : "lose";
    g.log.unshift(g.over === "win" ? "Night ends. You hold." : "Night ends. You are driven off.");
  }
  return g;
}

export function portrait(w) {
  return {
    name: w.name,
    role: w.role,
    alive: w.cell.alive,
    strength: +w.cell.strength.toFixed(2),
    wounds: w.cell.wounds,
    drills: w.drills.map((id) => BOOK.find((b) => b.id === id)?.name).filter(Boolean),
    trained: +mean(w.cell.book).toFixed(2),
  };
}

export function restart(seed) {
  return seedWar(seed ?? (Date.now() % 99991));
}
