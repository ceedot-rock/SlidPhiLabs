/**
 * OFA machine loop: seed → accept/decline → camp/fight → next.
 * Embeds tissue cell; leftover recorded each tick.
 */
import { imprint, makeTissue, tickTissue } from "./cell.mjs";
import { assertTg8Magic, tg8Compress, tg8Decompress } from "./tg8.mjs";

const FOCI = ["strike", "wrestle", "ground", "stamina", "rest"];
const FOCUS_BOOK = { strike: 0, wrestle: 1, ground: 2, stamina: 3, rest: 4 };

function mulberry32(a) {
  return function next() {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clone(o) {
  return JSON.parse(JSON.stringify(o));
}

function fighter(id, name, style, seed, rng) {
  const attrs = {
    strike: 40 + Math.floor(rng() * 40),
    wrestle: 40 + Math.floor(rng() * 40),
    ground: 40 + Math.floor(rng() * 40),
    stamina: 40 + Math.floor(rng() * 40),
    chin: 40 + Math.floor(rng() * 40),
  };
  return {
    id,
    name,
    style,
    seed,
    attrs,
    record: { w: 0, l: 0, d: 0 },
  };
}

function lineFor(phase, week, extra = "") {
  const base = {
    card: `Week ${week}: card on the table.`,
    camp: `Week ${week}: camp open.`,
    post: `Week ${week}: fight in the books.`,
  };
  return (base[phase] || `Week ${week}.`) + (extra ? ` ${extra}` : "");
}

function makeOffer(world, rng) {
  const you = world.fighters[0];
  const pool = world.fighters.slice(1);
  const opp = pool[Math.floor(rng() * pool.length)];
  const focusHint = FOCI[Math.floor(rng() * (FOCI.length - 1))]; // not rest
  return {
    opponentId: opp.id,
    opponentName: opp.name,
    focusHint,
    youId: you.id,
  };
}

export function seedWorld(seed = 27) {
  const s = Number(seed) || 27;
  let rngState = s >>> 0;
  const rng = mulberry32(rngState);
  const names = [
    ["You", "balanced"],
    ["River Kane", "striker"],
    ["Milo Voss", "wrestler"],
    ["Ash Ortega", "grappler"],
    ["Quinn Hale", "brawler"],
  ];
  const fighters = names.map((n, i) => fighter(i + 1, n[0], n[1], (s + i * 97) >>> 0, rng));
  const tissue = makeTissue(s);
  tickTissue(tissue, { grant_mw: 60, lux: 90, noise: 15, temp_c: 24 });
  const world = {
    engine: "sim-ofa",
    cell: "ofa",
    seed: s,
    phase: "card",
    promotion: {
      name: "OFA",
      week: 1,
      year: 2026,
      budget: 1_000_000,
      reputation: 50,
      lastLine: "",
    },
    fighters,
    offer: null,
    lastFight: null,
    tissue,
    rngState: (s + 1) >>> 0,
  };
  // re-seed rng from stored state for offer
  const rng2 = mulberry32(world.rngState);
  world.offer = makeOffer(world, rng2);
  world.rngState = (world.rngState + 0x9e3779b9) >>> 0;
  world.promotion.lastLine = lineFor("card", 1, `vs ${world.offer.opponentName}`);
  return world;
}

export function acceptCard(world, accept = true) {
  const w = clone(world);
  if (w.phase !== "card") throw new Error("accept only in card phase");
  if (!w.offer) throw new Error("no offer");
  if (!accept) {
    const r = mulberry32(w.rngState);
    w.offer = makeOffer(w, r);
    w.rngState = (w.rngState + 0x9e3779b9) >>> 0;
    w.promotion.lastLine = lineFor("card", w.promotion.week, `declined; now vs ${w.offer.opponentName}`);
    return w;
  }
  w.phase = "camp";
  w.promotion.lastLine = lineFor("camp", w.promotion.week, `accepted ${w.offer.opponentName}`);
  return w;
}

function scoreOf(f, focus) {
  const a = f.attrs;
  const primary = a[focus] ?? a.strike;
  return primary * 0.45 + a.stamina * 0.2 + a.chin * 0.15 + a.strike * 0.1 + a.wrestle * 0.05 + a.ground * 0.05;
}

export function doCamp(world, focus = "strike") {
  const w = clone(world);
  if (w.phase === "card") {
    // implicit accept when door posts camp/fight
    if (!w.offer) throw new Error("no offer");
    w.phase = "camp";
  } else if (w.phase !== "camp") {
    throw new Error("camp/fight only after accept");
  }
  const f = FOCI.includes(focus) ? focus : "strike";
  const you = w.fighters[0];
  const bookCh = FOCUS_BOOK[f] ?? 0;
  imprint(w.tissue, bookCh, f === "rest" ? 0.04 : 0.1);
  if (f === "rest") {
    you.attrs.stamina = Math.min(99, you.attrs.stamina + 2);
  } else {
    you.attrs[f] = Math.min(99, (you.attrs[f] ?? 50) + 3);
    you.attrs.stamina = Math.max(20, you.attrs.stamina - 1);
  }
  tickTissue(w.tissue, {
    grant_mw: 40 + you.attrs.stamina * 0.5,
    lux: 70 + (f === "strike" ? 20 : 0),
    noise: 10 + (f === "wrestle" ? 25 : 0),
    temp_c: 22 + (f === "ground" ? 6 : 0),
  });

  // fight resolves inside camp/fight action (machine door)
  const opp = w.fighters.find((x) => x.id === w.offer.opponentId);
  if (!opp) throw new Error("opponent missing");
  const r = mulberry32(w.rngState);
  w.rngState = (w.rngState + 0x85ebca6b) >>> 0;
  const ticks = 8 + Math.floor(r() * 7);
  let scoreA = 0;
  let scoreB = 0;
  for (let t = 0; t < ticks; t++) {
    scoreA += scoreOf(you, f) * (0.85 + r() * 0.3);
    scoreB += scoreOf(opp, w.offer.focusHint || "strike") * (0.85 + r() * 0.3);
    tickTissue(w.tissue, { grant_mw: 55, lux: 100, noise: 40, temp_c: 28 });
  }
  scoreA = Math.round(scoreA);
  scoreB = Math.round(scoreB);
  let method = "decision";
  let winnerId = scoreA === scoreB ? 0 : scoreA > scoreB ? you.id : opp.id;
  const margin = Math.abs(scoreA - scoreB);
  if (margin > 120) method = f === "ground" || f === "wrestle" ? "submission" : "ko";
  if (winnerId === you.id) you.record.w += 1;
  else if (winnerId === opp.id) you.record.l += 1;
  else you.record.d += 1;
  if (winnerId === opp.id) opp.record.w += 1;
  else if (winnerId === you.id) opp.record.l += 1;
  else opp.record.d += 1;

  w.lastFight = {
    method,
    winnerId,
    scoreA,
    scoreB,
    ticks,
    focus: f,
    leftover: w.tissue.leftover,
  };
  w.phase = "post";
  w.promotion.reputation = Math.max(
    0,
    Math.min(100, w.promotion.reputation + (winnerId === you.id ? 2 : winnerId === 0 ? 0 : -1)),
  );
  w.promotion.lastLine = lineFor(
    "post",
    w.promotion.week,
    `${method} ${scoreA}-${scoreB}; leftover ${w.tissue.leftover.toFixed(6)}`,
  );
  return w;
}

export function nextCycle(world) {
  const w = clone(world);
  if (w.phase !== "post") throw new Error("next only after fight");
  w.promotion.week += 1;
  w.phase = "card";
  w.lastFight = null;
  const r = mulberry32(w.rngState);
  w.offer = makeOffer(w, r);
  w.rngState = (w.rngState + 0x9e3779b9) >>> 0;
  tickTissue(w.tissue, { grant_mw: 45, lux: 85, noise: 12, temp_c: 23 });
  w.promotion.lastLine = lineFor("card", w.promotion.week, `vs ${w.offer.opponentName}`);
  return w;
}

export function identity(world) {
  return {
    cell: "ofa",
    engine: "sim-ofa",
    seed: world.seed,
    week: world.promotion?.week,
    phase: world.phase,
    tissueTicks: world.tissue?.ticks ?? 0,
    leftover: world.tissue?.leftover ?? 0,
  };
}

/** Canonical JSON bytes for bit-exact pack (no floating savedAt). */
export function worldBytes(world) {
  return new TextEncoder().encode(JSON.stringify(world));
}

export function packWorld(world) {
  const raw = worldBytes(world);
  const packed = tg8Compress(raw);
  assertTg8Magic(packed);
  return {
    engine: "sim-ofa",
    format: "trugame-tg8",
    rawBytes: raw.length,
    packedBytes: packed.length,
    packed,
    /** base64 for API / JSON doors */
    tg8: Buffer.from(packed).toString("base64"),
  };
}

export function unpackWorld(tg8orBlob) {
  let packed;
  if (typeof tg8orBlob === "string") {
    packed = new Uint8Array(Buffer.from(tg8orBlob, "base64"));
  } else if (tg8orBlob?.tg8 && typeof tg8orBlob.tg8 === "string") {
    packed = new Uint8Array(Buffer.from(tg8orBlob.tg8, "base64"));
  } else if (tg8orBlob?.packed) {
    packed =
      tg8orBlob.packed instanceof Uint8Array
        ? tg8orBlob.packed
        : new Uint8Array(Object.values(tg8orBlob.packed));
  } else if (tg8orBlob instanceof Uint8Array) {
    packed = tg8orBlob;
  } else {
    throw new Error("unpackWorld: need tg8 string or packed blob");
  }
  assertTg8Magic(packed);
  const raw = tg8Decompress(packed);
  const world = JSON.parse(new TextDecoder().decode(raw));
  if (world.engine !== "sim-ofa") throw new Error("not an OFA TG8 world");
  return world;
}

export { FOCI };
