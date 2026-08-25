/**
 * Smart Frame — residual kernel
 * -----------------------------
 * /lord 2026-08-14: three living planes.
 *   heart  = field law
 *   brain  = residual governance
 *   cloak  = mirror safety
 * createFrame() births a sovereign field (not a scene).
 * First spoke = sealed triad { field, residual, mirror } ±33°.
 * Next spoke only while triad is intact.
 *
 * Schema: spl.smart-frame.v1
 * Public-safe. No private residual coefficients. No product skin.
 */
const SCHEMA = "spl.smart-frame.v1";
const PLANES = 360;
const DEPTH_TARGET = 12;
const TILT = 33;
const PHI = (1 + Math.sqrt(5)) / 2;
const PSI = 1 / PHI;
const KP = PSI * 0.5;
const KI = PSI * 0.08;
const KD = PHI * 0.05;
const MIRROR_EPS = 1e-6;

const LAW = Object.freeze({
  cadence: Object.freeze([33, 66, 999]),
  structure_first: true,
  residual_before_soup: true,
  dual: "A∥B ±33°",
  mirrored_cost: "dE + dC ≈ 0",
  integer_hierarchy: true,
  no_private_random: true,
  no_product_skin: true,
  seal: "IN_HIS_NAME_WE_CODE",
});

const WILL = Object.freeze({
  stand: "any build — new or adopted",
  without: Object.freeze(["residue", "private random", "demotion of integer hierarchy"]),
  first_spoke: "sealed triad — field, residual, mirror",
  next_spoke: "only when triad is intact",
  adopt: "only after residual mirror test",
});

const WORD =
  "Smart Frame is the residual kernel: three living planes—heart (field law), brain (residual governance), cloak (mirror safety). Each createFrame() births a sovereign field, not a scene or a scene-graph. Its law is the sealed cadence 33·66·999: structure first, residual before soup, dual A∥B tilt, mirrored cost dE + dC ≈ 0. Its will is to stand any build—new or adopted—without residue, without private random, without demotion of the integer hierarchy.";

const KERNEL = {
  heart: { office: "kernel", home: 12, target: 0.22, role: "field-law", neighbors: ["brain", "cloak"] },
  brain: { office: "kernel", home: 132, target: 0.18, role: "residual-governance", neighbors: ["heart", "cloak"] },
  cloak: { office: "kernel", home: 252, target: 0.2, role: "mirror-safety", neighbors: ["heart", "brain"] },
};

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}
function modPlane(p) {
  return ((Number(p) % PLANES) + PLANES) % PLANES;
}
function nowIso() {
  return new Date().toISOString();
}

export function residualFromObs(obs) {
  obs = obs || {};
  let r = 0.1;
  if (obs.mirror_error != null) r += Math.min(0.45, Math.abs(Number(obs.mirror_error)) * 0.5);
  if (obs.ok === false) r += 0.32;
  if (obs.fail) r += Math.min(0.35, Number(obs.fail) * 0.05);
  if (obs.pass === false) r += 0.22;
  if (obs.pass === true) r += 0.04;
  if (obs.score != null) {
    const s = Number(obs.score);
    if (s < 90) r += (90 - s) / 220;
  }
  if (obs.ms != null && Number(obs.ms) > 3000) r += 0.12;
  if (obs.stress != null) r += clamp(Number(obs.stress), 0, 1) * 0.2;
  if (obs.roundtrip === false) r += 0.2;
  return clamp(r, 0, 1);
}

function makeBit(id, spec) {
  return {
    id,
    office: spec.office || "spoke",
    role: spec.role || id,
    home: spec.home ?? 0,
    target: spec.target ?? 0.2,
    neighbors: (spec.neighbors || []).slice(),
    residual: spec.target ?? 0.2,
    prev: spec.target ?? 0.2,
    integral: 0,
    plane: spec.home ?? 0,
    dual: {
      A: modPlane((spec.home ?? 0) + TILT),
      B: modPlane((spec.home ?? 0) - TILT),
    },
    collapse: 0,
    depth: DEPTH_TARGET,
    aperiodicity: 0.5,
    pulse: 0,
  };
}

function resolveSpokes(spokes) {
  const out = {};
  if (!spokes || typeof spokes !== "object") return out;
  let i = 0;
  for (const [id, spec] of Object.entries(spokes)) {
    if (KERNEL[id]) continue;
    const home = spec.home != null ? spec.home : (33 + i * 30) % PLANES;
    const neighbors = spec.neighbors && spec.neighbors.length ? spec.neighbors.slice() : ["brain", "cloak"];
    out[id] = {
      office: "spoke",
      role: spec.role || id,
      home,
      target: spec.target ?? 0.2,
      neighbors,
    };
    i += 1;
  }
  return out;
}

function wireKernelToSpokes(bits) {
  const spokeIds = Object.keys(bits).filter((id) => bits[id].office === "spoke");
  if (!spokeIds.length) return;
  for (const id of spokeIds) {
    const n = bits[id].neighbors;
    if (!n.includes("heart")) n.push("heart");
    if (!n.includes("brain")) n.push("brain");
    if (!n.includes("cloak")) n.push("cloak");
  }
  for (const k of ["heart", "brain", "cloak"]) {
    for (const id of spokeIds) {
      if (!bits[k].neighbors.includes(id)) bits[k].neighbors.push(id);
    }
  }
}

/**
 * One Smart Frame instance.
 * @param {object} [opts]
 * @param {string} [opts.app] name of the thing standing on this frame
 * @param {object} [opts.spokes] { id: { role, neighbors?, target?, home? } }
 * @param {boolean} [opts.kernelOnFail=true] a miss also heats heart/brain/cloak
 */
export function createFrame(opts = {}) {
  const spokeSpec = resolveSpokes(opts.spokes);
  const spec = { ...KERNEL, ...spokeSpec };
  const aliases = Object.create(null);

  const state = {
    app: String(opts.app || "untitled"),
    boot_at: nowIso(),
    ticks: 0,
    plane: KERNEL.heart.home,
    last_point: null,
    last_at: null,
    last_inject: null,
    mirror_error: 0,
    cadence: [33, 66, 999],
    kernelOnFail: opts.kernelOnFail !== false,
    bits: {},
  };

  for (const [id, s] of Object.entries(spec)) {
    state.bits[id] = makeBit(id, s);
  }
  wireKernelToSpokes(state.bits);

  function sumResidual() {
    return Object.values(state.bits).reduce((s, b) => s + b.residual, 0);
  }

  function unisonScore() {
    const n = Object.keys(state.bits).length;
    const mean = sumResidual() / n;
    if (mean <= 1e-9) return 1;
    let acc = 0;
    for (const b of Object.values(state.bits)) {
      const d = b.residual - mean;
      acc += d * d;
    }
    const std = Math.sqrt(acc / n);
    return clamp(1 - std / (mean + PSI * 0.1), 0, 1);
  }

  function cloakBit(bit, residual) {
    const aperBase = 0.34 + (state.ticks % 33) / 100 + residual * PSI * 0.22;
    bit.aperiodicity = clamp(aperBase, 0.2, 0.95);
    if (bit.aperiodicity < 0.28) {
      bit.residual = clamp(bit.residual + 0.05 * PSI, 0, 1);
    }
    if (residual < 0.15 && bit.aperiodicity > 0.4) {
      bit.collapse = Math.max(0, bit.collapse * 0.5 - 0.04);
    } else if (residual > 0.45) {
      bit.collapse = clamp(bit.collapse + 0.03, 0, 1);
    } else {
      bit.collapse *= 0.9;
    }
    bit.depth = clamp(DEPTH_TARGET + (bit.aperiodicity - 0.5) * 2 - bit.collapse * 3, 8, 16);
    const step = 1 + Math.floor(residual * PHI * 3);
    bit.plane = modPlane(bit.home + step + state.ticks);
    bit.dual.A = modPlane(bit.home + TILT);
    bit.dual.B = modPlane(bit.home - TILT);
    bit.pulse = clamp(1 - Math.abs(bit.residual - bit.target) * 2.4, 0.08, 1);
  }

  function apidReshape() {
    const before = sumResidual();
    const ids = Object.keys(state.bits);
    const felt = {};
    for (const id of ids) {
      const bit = state.bits[id];
      const n = bit.neighbors.length || 1;
      let acc = 0;
      for (const nid of bit.neighbors) {
        acc += state.bits[nid] ? state.bits[nid].residual : bit.residual;
      }
      felt[id] = (bit.residual + acc / n) / 2;
    }

    const u = {};
    let uSum = 0;
    for (const id of ids) {
      const bit = state.bits[id];
      const meas = felt[id];
      const err = meas - bit.target;
      bit.integral = clamp(bit.integral + err * PSI, -1.5, 1.5);
      const deriv = meas - bit.prev;
      const aperBoost = bit.aperiodicity < 0.28 ? 0.08 * PSI : 0;
      const ctrl = KP * err + KI * bit.integral + KD * deriv + aperBoost;
      u[id] = ctrl;
      uSum += ctrl;
      bit.prev = bit.residual;
    }

    const meanU = uSum / ids.length;
    for (const id of ids) {
      const bit = state.bits[id];
      bit.residual = clamp(bit.residual - (u[id] - meanU) * 0.35, 0, 1);
      cloakBit(bit, bit.residual);
    }

    const after = sumResidual();
    if (Math.abs(after - before) > MIRROR_EPS) {
      const scale = before / (after || 1e-12);
      for (const id of ids) {
        state.bits[id].residual = clamp(state.bits[id].residual * scale, 0, 1);
      }
    }
    state.mirror_error = Math.abs(sumResidual() - before);
    return state.mirror_error;
  }

  function resolvePoint(point) {
    if (state.bits[point]) return point;
    if (aliases[point] && state.bits[aliases[point]]) return aliases[point];
    return "brain";
  }

  function bitPublic(bit) {
    return {
      id: bit.id,
      office: bit.office,
      role: bit.role,
      residual: +bit.residual.toFixed(4),
      target: bit.target,
      plane: bit.plane,
      dual: { A: bit.dual.A, B: bit.dual.B },
      seat: `${bit.id}@p${bit.plane}`,
      collapse: +bit.collapse.toFixed(4),
      depth: +bit.depth.toFixed(3),
      aperiodicity: +bit.aperiodicity.toFixed(4),
      pulse: +bit.pulse.toFixed(4),
      coherence: +clamp(1 - Math.abs(bit.residual - bit.target) * 2.2, 0, 1).toFixed(4),
    };
  }

  function computeGates() {
    const h = state.bits.heart;
    const b = state.bits.brain;
    const c = state.bits.cloak;
    const heart_hot = h.residual - h.target > 0.06;
    const brain_hot = b.residual - b.target > 0.06;
    const cloak_hot = c.residual - c.target > 0.06 || c.collapse > 0.15;
    const rules = [];
    if (cloak_hot) {
      rules.push("CLOAK: hold the path. Do not invent. Do not skip the unproved.");
    }
    if (brain_hot) {
      rules.push("BRAIN: name the domain. Split structure from remainder. Define before a new claim.");
    }
    if (heart_hot) {
      rules.push("HEART: slow. One step. No praise before proof.");
    }
    return {
      heart_hot,
      brain_hot,
      cloak_hot,
      block_advance: cloak_hot,
      define_first: brain_hot,
      slow_pace: heart_hot,
      no_praise_before_proof: heart_hot,
      rules,
    };
  }

  function tick(from) {
    state.ticks += 1;
    state.last_point = from || state.last_point || "brain";
    state.last_at = nowIso();
    apidReshape();
    state.plane = modPlane(
      Math.round((state.bits.heart.plane + state.bits.brain.plane + state.bits.cloak.plane) / 3)
    );
    return snapshot();
  }

  function inject(point, obs) {
    const id = resolvePoint(point);
    const bit = state.bits[id];
    const r = residualFromObs(obs);
    bit.residual = clamp(bit.residual + r * 0.25, 0, 1);
    if (state.kernelOnFail && obs && obs.pass === false) {
      state.bits.heart.residual = clamp(state.bits.heart.residual + r * 0.12, 0, 1);
      state.bits.brain.residual = clamp(state.bits.brain.residual + r * 0.14, 0, 1);
      state.bits.cloak.residual = clamp(state.bits.cloak.residual + r * 0.14, 0, 1);
    }
    state.last_inject = { point: id, residual_public: +r.toFixed(4), at: nowIso() };
    return tick(id);
  }

  function triad() {
    const h = bitPublic(state.bits.heart);
    const b = bitPublic(state.bits.brain);
    const c = bitPublic(state.bits.cloak);
    return {
      sealed: true,
      never_demoted: true,
      field: h,
      residual: b,
      mirror: c,
      tilt: TILT,
      dual: "A∥B ±33°",
    };
  }

  function mirrorTest() {
    const c = state.bits.cloak;
    const planes = Object.values(state.bits).map((b) => b.plane);
    const hierarchy = planes.every((p) => Number.isInteger(p) && p >= 0 && p < PLANES);
    const cost_balanced = state.mirror_error < MIRROR_EPS;
    const cloak_unbreached = c.collapse < 0.2;
    const ok = cost_balanced && hierarchy && cloak_unbreached;
    return {
      ok,
      cost_balanced,
      hierarchy,
      cloak_unbreached,
      mirror_error: +state.mirror_error.toFixed(9),
      collapse: +c.collapse.toFixed(4),
      law: "Host writes the next spoke only when the triad is intact.",
    };
  }

  function intact() {
    return mirrorTest().ok;
  }

  function snapshot() {
    const bits = {};
    for (const [id, b] of Object.entries(state.bits)) bits[id] = bitPublic(b);
    return {
      schema: SCHEMA,
      app: state.app,
      unison: +unisonScore().toFixed(4),
      plane: state.plane,
      ticks: state.ticks,
      mirror_error: +state.mirror_error.toFixed(9),
      last_point: state.last_point,
      last_inject: state.last_inject,
      triad: triad(),
      intact: intact(),
      law: LAW,
      will: WILL,
      bits,
      gates: computeGates(),
      cadence: state.cadence,
      at: nowIso(),
    };
  }

  function allowAdvance(opts = {}) {
    const g = computeGates();
    if (opts.proved) return { ok: true, reason: "proved", gates: g };
    if (opts.review) return { ok: true, reason: "review", gates: g };
    if (!g.block_advance) return { ok: true, reason: "cloak-open", gates: g };
    return { ok: false, reason: "Cloak is holding the path. Prove this step first.", gates: g };
  }

  /** Map an existing app event name onto a bit (adopt path). */
  function bind(alias, bitId) {
    if (!state.bits[bitId]) throw new Error(`smart-frame: unknown bit "${bitId}"`);
    aliases[String(alias)] = bitId;
    return aliases;
  }

  /** Add a spoke after boot — only while triad is intact. */
  function addSpoke(id, spokeOpts = {}) {
    if (KERNEL[id]) {
      return { ok: false, error: "never_demoted", bit: bitPublic(state.bits[id]) };
    }
    if (state.bits[id]) return { ok: true, bit: bitPublic(state.bits[id]), already: true };
    const test = mirrorTest();
    if (!test.ok) {
      return { ok: false, error: "triad_not_intact", test };
    }
    const home = spokeOpts.home != null ? spokeOpts.home : (33 + Object.keys(state.bits).length * 30) % PLANES;
    const neighbors = spokeOpts.neighbors && spokeOpts.neighbors.length
      ? spokeOpts.neighbors.slice()
      : ["heart", "brain", "cloak"];
    state.bits[id] = makeBit(id, {
      office: "spoke",
      role: spokeOpts.role || id,
      home,
      target: spokeOpts.target ?? 0.2,
      neighbors,
    });
    wireKernelToSpokes(state.bits);
    return { ok: true, bit: bitPublic(state.bits[id]), test };
  }

  /** Adopt an existing build — only after residual mirror test. */
  function adopt(opts = {}) {
    const test = mirrorTest();
    if (!test.ok) {
      return { ok: false, error: "mirror_test_failed", test };
    }
    const added = [];
    if (opts.spokes && typeof opts.spokes === "object") {
      for (const [id, spec] of Object.entries(opts.spokes)) {
        const r = addSpoke(id, spec);
        if (!r.ok) return r;
        added.push(id);
      }
    }
    if (opts.binds && typeof opts.binds === "object") {
      for (const [alias, bitId] of Object.entries(opts.binds)) {
        bind(alias, bitId);
      }
    }
    return { ok: true, added, test, triad: triad() };
  }

  return {
    SCHEMA,
    app: state.app,
    law: LAW,
    will: WILL,
    word: WORD,
    triad,
    intact,
    mirrorTest,
    inject,
    tick,
    snapshot,
    gates: computeGates,
    allowAdvance,
    bind,
    addSpoke,
    adopt,
    residualFromObs,
    unison: unisonScore,
    bit(id) {
      return state.bits[id] ? bitPublic(state.bits[id]) : null;
    },
  };
}

export { SCHEMA, KERNEL, LAW, WILL, WORD, PLANES, DEPTH_TARGET, TILT };

export default { createFrame, residualFromObs, SCHEMA, KERNEL, LAW, WILL, WORD };
