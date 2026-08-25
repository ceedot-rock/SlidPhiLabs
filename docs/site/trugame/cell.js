/**
 * 29 sense / 36 speak cell. Canonical tissue (Colony Autonoma).
 * book[13] is fitness written by deeds — never listed on glass.
 */
export const SENSE = 29;
export const SPEAK = 36;

export function hash32(n) {
  let x = (n >>> 0) + 0x9e3779b9;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return (x ^ (x >>> 16)) >>> 0;
}

export function mean(arr) {
  let s = 0;
  for (let i = 0; i < arr.length; i++) s += arr[i];
  return s / (arr.length || 1);
}

export function makeCell(seed = 33) {
  const sense = new Float64Array(SENSE);
  const speak = new Float64Array(SPEAK);
  const book = new Float64Array(13);
  let s = seed >>> 0;
  for (let i = 0; i < SENSE; i++) sense[i] = ((s = hash32(s + i)) & 255) / 255;
  return {
    seed,
    sense,
    speak,
    book,
    alive: true,
    ticks: 0,
    identity: seed >>> 0,
    strength: 1,
    heat: 0,
  };
}

export function perceive(cell, world) {
  const g = Math.max(0, Math.min(1, (world.grant_mw || 0) / 200));
  cell.sense[0] = (world.lux ?? 0) / 200;
  cell.sense[1] = (world.noise ?? 0) / 100;
  cell.sense[2] = Math.max(0, ((world.temp_c ?? 25) - 20) / 30);
  cell.sense[3] = g;
  for (let i = 4; i < SENSE; i++) {
    const nse = ((hash32(cell.seed + cell.ticks * 17 + i) & 255) / 255 - 0.5) * 0.04;
    const drill = cell.book[(i - 4) % 13] * 0.08;
    cell.sense[i] = Math.max(0, Math.min(1, cell.sense[i] * 0.86 + cell.sense[i % 4] * 0.1 + nse + drill));
  }
}

export function speak(cell, grantMw) {
  const mouths = Math.max(4, Math.min(SPEAK, Math.round((grantMw / 200) * SPEAK)));
  for (let i = 0; i < SPEAK; i++) {
    if (i >= mouths) {
      cell.speak[i] *= 0.5;
      continue;
    }
    const a = cell.sense[i % SENSE];
    const b = cell.sense[(i * 3) % SENSE];
    const drill = cell.book[i % 13] * 0.12;
    cell.speak[i] = Math.max(0, Math.min(1, a * 0.55 + b * 0.35 + cell.speak[i] * 0.1 + drill));
  }
  return cell.speak;
}

export function leftover(cell) {
  let e = 0;
  for (let i = 0; i < SPEAK; i++) {
    const d = cell.speak[i] - cell.sense[i % SENSE];
    e += d * d;
  }
  return { energy: e / SPEAK };
}

export function tick(cell, world) {
  if (!cell.alive) return cell;
  perceive(cell, world);
  speak(cell, world.grant_mw ?? 40);
  cell.ticks += 1;
  const energy = mean(cell.sense) + mean(cell.speak);
  if (energy < 0.02 || energy > 2.4) cell.alive = false;
  cell.heat = leftover(cell).energy;
  cell.strength = Math.max(0.15, Math.min(1.7, mean(cell.speak) * 1.55 + 0.2 - (cell.heat > 0.55 ? 0.25 : 0)));
  if (cell.heat > 0.62) cell.strength *= 0.86;
  return cell;
}

/** Runner/world adapter: night/mud/heat/grant → lux/noise/temp/grant_mw */
export function tickCell(cell, world) {
  return tick(cell, {
    lux: (world.night ?? 0.4) * 200,
    noise: (world.mud ?? 0.2) * 100,
    temp_c: 20 + (world.heat ?? 0.3) * 30,
    grant_mw: world.grant ?? world.grant_mw ?? 50,
  });
}

export function imprint(cell, ch, amt = 0.08) {
  const i = ((ch | 0) + 13) % 13;
  cell.book[i] = Math.min(1, cell.book[i] + amt);
}

export function skill(cell, ch) {
  const i = ((ch | 0) + 13) % 13;
  return cell.book[i] * 0.7 + cell.sense[4 + i] * 0.3;
}
