/**
 * NCA infra coat — public-safe process reporting
 * ------------------------------------------------
 * Neural Cellular Automata governance surface for **infra points of note**
 * that report on processes (healthz, /api/process, metrics, status, duos).
 *
 * Residual-honest, public-safe:
 *   - No private residual coefficients / enclave secrets
 *   - Plane seats + cloak depth target (ZRQC public shape)
 *   - tick() advances coat when a process reports
 *
 * Full cloaked agent NCA lives in agent_nca.mjs (chamber).
 * This module is the **portable coat** for every Fly app.
 *
 * Seats (public labels):
 *   phi@p40 · grok@p100 · spl@p160 · zrw@p220 · suite@p280 · agentic@p340
 * Infra process seats:
 *   health · process · metrics · duos · mesh · teach · loadout · chamber · agent
 *
 * Cadence: 33·66·999 · Dual A∥B ±33° · In His name we code
 */
const PLANES = 360;
const DEPTH_TARGET = 12;
const PHI = (1 + Math.sqrt(5)) / 2;
const PSI = 1 / PHI;

/** Named public agent seats (plane home positions) */
export const AGENT_SEATS = Object.freeze({
  phi: 40,
  grok: 100,
  spl: 160,
  zrw: 220,
  suite: 280,
  agentic: 340,
});

/** Infra process-report points → home plane offsets */
export const INFRA_SEATS = Object.freeze({
  health: 10,
  process: 20,
  metrics: 30,
  duos: 50,
  mesh: 60,
  teach: 70,
  loadout: 80,
  chamber: 90,
  agent: 110,
  codec: 130,
  pay: 150,
  train: 180,
  status: 200,
});

const state = {
  app: process.env.FLY_APP_NAME || process.env.NCA_APP || "unknown",
  boot_at: new Date().toISOString(),
  ticks: 0,
  plane: AGENT_SEATS.phi,
  last_point: null,
  last_at: null,
  collapse: 0,
  depth: DEPTH_TARGET,
  aperiodicity: 0.5,
  residual_public: 0.25, // unit interval signal only — not private residual mass
  points: Object.create(null),
};

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function modPlane(p) {
  return ((Number(p) % PLANES) + PLANES) % PLANES;
}

/**
 * Public residual signal from process outcome (0..1).
 * mirror_error 0 → low residual; errors / slow → higher.
 */
export function residualFromProcess(obs = {}) {
  let r = 0.12;
  if (obs.mirror_error != null) r += Math.min(0.5, Math.abs(Number(obs.mirror_error)) * 0.5);
  if (obs.ok === false) r += 0.35;
  if (obs.fail) r += Math.min(0.4, Number(obs.fail) * 0.05);
  if (obs.soft) r += Math.min(0.2, Number(obs.soft) * 0.02);
  if (obs.ms != null && Number(obs.ms) > 3000) r += 0.15;
  if (obs.roundtrip === false) r += 0.25;
  if (obs.score != null) {
    const s = Number(obs.score);
    if (s < 90) r += (90 - s) / 200;
  }
  return clamp(r, 0, 1);
}

/**
 * Tick NCA coat at an infra process point.
 * @param {string} point - key from INFRA_SEATS or free-form
 * @param {object} [obs] - process observation (ok, mirror_error, ms, score, …)
 */
export function ncaTick(point = "status", obs = {}) {
  const home =
    INFRA_SEATS[point] != null
      ? INFRA_SEATS[point]
      : AGENT_SEATS[point] != null
        ? AGENT_SEATS[point]
        : state.plane;
  const residual = residualFromProcess(obs);
  // Walk plane with φ-step modulated by residual (public-safe walk)
  const step = 1 + Math.floor(residual * PHI * 3);
  state.plane = modPlane(home + step + state.ticks);
  state.ticks += 1;
  state.last_point = point;
  state.last_at = new Date().toISOString();
  state.residual_public = residual;

  // Cloak public shape: drive collapse→0, depth→12, force aperiodicity
  const aperBase = 0.35 + (state.ticks % 33) / 100 + residual * PSI * 0.2;
  state.aperiodicity = clamp(aperBase, 0.2, 0.95);
  if (state.aperiodicity < 0.28) {
    state.residual_public = clamp(state.residual_public + 0.05, 0, 1);
  }
  if (residual < 0.15 && state.aperiodicity > 0.4) {
    state.collapse = Math.max(0, state.collapse * 0.5 - 0.04);
  } else if (residual > 0.45) {
    state.collapse = clamp(state.collapse + 0.03, 0, 1);
  } else {
    state.collapse *= 0.9;
  }
  state.depth = clamp(
    DEPTH_TARGET + (state.aperiodicity - 0.5) * 2 - state.collapse * 3,
    8,
    16
  );

  const rec = {
    point,
    plane: state.plane,
    seat: seatLabel(point, state.plane),
    residual_public: +state.residual_public.toFixed(4),
    collapse: +state.collapse.toFixed(4),
    depth: +state.depth.toFixed(3),
    aperiodicity: +state.aperiodicity.toFixed(4),
    ticks: state.ticks,
    at: state.last_at,
    obs: summarizeObs(obs),
  };
  state.points[point] = rec;
  return rec;
}

function seatLabel(point, plane) {
  // Prefer named agent seat if close
  for (const [name, home] of Object.entries(AGENT_SEATS)) {
    if (Math.abs(modPlane(plane - home)) <= 2 || plane === home) {
      return `${name}@p${plane}`;
    }
  }
  return `${point}@p${plane}`;
}

function summarizeObs(obs) {
  if (!obs || typeof obs !== "object") return null;
  const out = {};
  for (const k of [
    "ok",
    "mirror_error",
    "roundtrip",
    "ms",
    "score",
    "letter",
    "fail",
    "soft",
    "path",
    "engine",
  ]) {
    if (obs[k] !== undefined) out[k] = obs[k];
  }
  return Object.keys(out).length ? out : null;
}

/**
 * Full coat report for embedding in process-report JSON.
 */
export function ncaReport(opts = {}) {
  const app = opts.app || state.app;
  const point = opts.point || state.last_point || "status";
  // Optional tick on report
  if (opts.tick !== false) {
    ncaTick(point, opts.obs || {});
  }
  const seats = {};
  for (const [k, p] of Object.entries(AGENT_SEATS)) seats[k] = `${k}@p${p}`;
  const infra = {};
  for (const [k, p] of Object.entries(INFRA_SEATS)) infra[k] = `${k}@p${p}`;

  return {
    schema: "spl.nca.infra.v1",
    ok: true,
    name: "NCA",
    full: "Neural Cellular Automata · process coat",
    public_safe: true,
    private_engine: "chamber agent_nca only — not on public rails",
    app,
    plane: state.plane,
    planes: PLANES,
    degree: 1,
    seat: seatLabel(point, state.plane),
    point: state.last_point,
    ticks: state.ticks,
    cloak: {
      on: true,
      collapse: +state.collapse.toFixed(4),
      depth: +state.depth.toFixed(3),
      depth_target: DEPTH_TARGET,
      aperiodicity: +state.aperiodicity.toFixed(4),
    },
    residual_public: +state.residual_public.toFixed(4),
    cadence: [33, 66, 999],
    dual: "A∥B ±33°",
    agent_seats: seats,
    infra_seats: infra,
    recent_points: Object.values(state.points).slice(-8),
    boot_at: state.boot_at,
    at: new Date().toISOString(),
    motto: "In His name we code · through it we live",
  };
}

/**
 * Attach NCA coat onto any process-report body.
 * Mutates and returns body.
 */
export function attachNca(body, point = "status", obs = {}) {
  if (!body || typeof body !== "object") return body;
  const report = ncaReport({ point, obs, app: body.app || body.name || state.app });
  body.nca = report;
  // Header-friendly short stamp
  body.nca_seat = report.seat;
  body.nca_plane = report.plane;
  return body;
}

/** Configure app name once at boot */
export function ncaBindApp(appName) {
  if (appName) state.app = String(appName);
  return state.app;
}

export function ncaHeaders() {
  const r = ncaReport({ tick: false });
  return {
    "X-SPL-NCA": "infra.v1",
    "X-SPL-NCA-Plane": String(r.plane),
    "X-SPL-NCA-Seat": r.seat,
    "X-SPL-NCA-Depth": String(r.cloak.depth),
  };
}

export default {
  ncaTick,
  ncaReport,
  attachNca,
  ncaBindApp,
  ncaHeaders,
  residualFromProcess,
  AGENT_SEATS,
  INFRA_SEATS,
  PLANES,
  DEPTH_TARGET,
};
