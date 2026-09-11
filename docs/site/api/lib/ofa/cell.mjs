/**
 * OFA tissue cell — same leftover contract as TruGame cell tissue
 * (sense/speak residual energy). Kept local so Front/Runner/Colony skins stay untouched.
 */
export const SENSE = 29;
export const SPEAK = 36;

export function hash32(n) {
  let x = (n >>> 0) + 0x9e3779b9;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return (x ^ (x >>> 16)) >>> 0;
}

function mean(arr) {
  let s = 0;
  for (let i = 0; i < arr.length; i++) s += arr[i];
  return s / (arr.length || 1);
}

/** Plain arrays only — JSON-stable for TG8 bit-exact. */
export function makeTissue(seed = 33) {
  const sense = new Array(SENSE);
  const speak = new Array(SPEAK).fill(0);
  const book = new Array(13).fill(0);
  let s = seed >>> 0;
  for (let i = 0; i < SENSE; i++) sense[i] = ((s = hash32(s + i)) & 255) / 255;
  return {
    seed: seed >>> 0,
    sense,
    speak,
    book,
    alive: true,
    ticks: 0,
    heat: 0,
    leftover: 0,
    strength: 1,
  };
}

export function leftover(tissue) {
  let e = 0;
  for (let i = 0; i < SPEAK; i++) {
    const d = tissue.speak[i] - tissue.sense[i % SENSE];
    e += d * d;
  }
  return { energy: e / SPEAK };
}

export function tickTissue(tissue, worldFeel = {}) {
  if (!tissue.alive) return tissue;
  const grantMw = worldFeel.grant_mw ?? 50;
  const lux = (worldFeel.lux ?? 80) / 200;
  const noise = (worldFeel.noise ?? 20) / 100;
  const temp = Math.max(0, ((worldFeel.temp_c ?? 25) - 20) / 30);
  const g = Math.max(0, Math.min(1, grantMw / 200));
  tissue.sense[0] = lux;
  tissue.sense[1] = noise;
  tissue.sense[2] = temp;
  tissue.sense[3] = g;
  for (let i = 4; i < SENSE; i++) {
    const nse = ((hash32(tissue.seed + tissue.ticks * 17 + i) & 255) / 255 - 0.5) * 0.04;
    const drill = tissue.book[(i - 4) % 13] * 0.08;
    tissue.sense[i] = Math.max(0, Math.min(1, tissue.sense[i] * 0.86 + tissue.sense[i % 4] * 0.1 + nse + drill));
  }
  const mouths = Math.max(4, Math.min(SPEAK, Math.round((grantMw / 200) * SPEAK)));
  for (let i = 0; i < SPEAK; i++) {
    if (i >= mouths) {
      tissue.speak[i] *= 0.5;
      continue;
    }
    const a = tissue.sense[i % SENSE];
    const b = tissue.sense[(i * 3) % SENSE];
    const drill = tissue.book[i % 13] * 0.12;
    tissue.speak[i] = Math.max(0, Math.min(1, a * 0.55 + b * 0.35 + tissue.speak[i] * 0.1 + drill));
  }
  tissue.ticks += 1;
  const energy = mean(tissue.sense) + mean(tissue.speak);
  if (energy < 0.02 || energy > 2.4) tissue.alive = false;
  const left = leftover(tissue);
  tissue.leftover = left.energy;
  tissue.heat = left.energy;
  tissue.strength = Math.max(
    0.15,
    Math.min(1.7, mean(tissue.speak) * 1.55 + 0.2 - (tissue.heat > 0.55 ? 0.25 : 0)),
  );
  if (tissue.heat > 0.62) tissue.strength *= 0.86;
  return tissue;
}

export function imprint(tissue, ch, amt = 0.08) {
  const i = ((ch | 0) + 13) % 13;
  tissue.book[i] = Math.min(1, tissue.book[i] + amt);
}
