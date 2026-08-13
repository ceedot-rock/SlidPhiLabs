#!/usr/bin/env node
/**
 * slid_watch_pulse.mjs — continuous metrics watcher
 * Usage: node slid_watch_pulse.mjs [base_url]
 * Env: SLID_BASE, SLID_INTERVAL_MS (default 15000)
 */
const base = process.argv[2] || process.env.SLID_BASE || "https://www.slidphilabs.com";
const interval = Number(process.env.SLID_INTERVAL_MS || 15000);
console.log(`Slid Phi Labs watcher locked on ${base} (every ${interval}ms)`);
async function tick() {
  const ts = new Date().toISOString().slice(11, 19);
  try {
    const r = await fetch(`${base}/api/phi/metrics`, { cache: "no-store" });
    if (!r.ok) {
      console.log(`[${ts}] HTTP ${r.status}`);
      return;
    }
    const m = await r.json();
    console.log(
      `[${ts}] ALIVE=${m.alive} cycles=${m.cycles} tunes=${m.self_tune_count} ratio=${m.ratio} path=${m.last_path} | ${m.flagship || ""}`
    );
  } catch (e) {
    console.log(`[${ts}] ERR ${e.message || e}`);
  }
}
await tick();
setInterval(tick, interval);
