/**
 * Agent directory 0.1.0 — rider agents ranked by benchhaus score.
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 *
 * Deterministic, offline, in-memory: no disk, no network. list() sorts by
 * score desc (ties by rider_id asc) so discovery always ranks best first.
 *
 * Score verification: finite scores are clamped to 0..100 (benchhaus SiAi
 * scale; 0..1-scale callers pass through unchanged). Unknown scores
 * (missing, null, blank, or unparseable) map to AGENT_SCORE_PRIOR — a
 * neutral 50 that never outranks a measured agent. Unknown is never 1.0
 * (or 100): an unmeasured agent must not rank as perfect.
 */
export const AGENT_DIRECTORY_VERSION = "0.1.0";

/** Neutral prior for unknown scores: mid-scale, never perfect. */
export const AGENT_SCORE_PRIOR = 50;
export const AGENT_SCORE_MIN = 0;
export const AGENT_SCORE_MAX = 100;

function text(v) {
  return v == null ? "" : String(v).trim();
}

/** Verify one raw score: clamp finite values to 0..100, map unknown to the prior. */
export function verifyScore(raw) {
  if (raw === undefined || raw === null) return AGENT_SCORE_PRIOR;
  if (typeof raw === "string" && raw.trim() === "") return AGENT_SCORE_PRIOR;
  const n = Number(raw);
  if (!Number.isFinite(n)) return AGENT_SCORE_PRIOR;
  return Math.min(AGENT_SCORE_MAX, Math.max(AGENT_SCORE_MIN, n));
}

function cleanAgent(a) {
  if (!a || typeof a !== "object") return null;
  const rider_id = text(a.rider_id);
  const endpoint = text(a.endpoint);
  if (!rider_id || !endpoint) return null;
  const rawScore = a.score ?? a.benchhaus_score ?? a.benchhaus;
  const score = verifyScore(rawScore);
  const specialties = Array.isArray(a.specialties)
    ? [...new Set(a.specialties.map(text).filter(Boolean))].sort()
    : [];
  return { rider_id, score, specialties, endpoint };
}

function byRank(a, b) {
  return b.score - a.score || a.rider_id.localeCompare(b.rider_id);
}

/** Create an isolated in-memory agent directory. */
export function createAgentDirectory() {
  const agents = new Map(); // rider_id -> agent
  return {
    register(agent) {
      const clean = cleanAgent(agent);
      if (!clean) return { ok: false, reason: "bad_agent" };
      if (agents.has(clean.rider_id)) return { ok: false, reason: "duplicate_agent" };
      agents.set(clean.rider_id, clean);
      return { ok: true, agent: { ...clean, specialties: [...clean.specialties] } };
    },
    get(rider_id) {
      const id = text(rider_id);
      const hit = id ? agents.get(id) : null;
      if (!hit) return { ok: false, reason: "unknown_agent" };
      return { ok: true, agent: { ...hit, specialties: [...hit.specialties] } };
    },
    list() {
      return [...agents.values()]
        .map((a) => ({ ...a, specialties: [...a.specialties] }))
        .sort(byRank);
    },
  };
}
