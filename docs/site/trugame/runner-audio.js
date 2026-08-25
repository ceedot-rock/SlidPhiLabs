let ctx = null;
function ac() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}
function beep(freq, dur, type, gain) {
  const c = ac();
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.value = gain;
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
  o.connect(g);
  g.connect(c.destination);
  o.start();
  o.stop(c.currentTime + dur);
}
export function unlock() {
  try { ac(); } catch { /* */ }
}
export function onJump() { beep(520, 0.08, "square", 0.04); }
export function onSlide() { beep(140, 0.12, "sawtooth", 0.03); }
export function onDash() { beep(180, 0.16, "sawtooth", 0.05); }
export function onDeath() { beep(70, 0.35, "square", 0.08); }
export function drone(strength) {
  const c = ac();
  if (!c._drone) {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "sine";
    o.frequency.value = 55;
    g.gain.value = 0.012;
    o.connect(g);
    g.connect(c.destination);
    o.start();
    c._drone = { o, g };
  }
  c._drone.g.gain.setTargetAtTime(0.008 + strength * 0.02, c.currentTime, 0.2);
  c._drone.o.frequency.setTargetAtTime(48 + strength * 30, c.currentTime, 0.3);
}
