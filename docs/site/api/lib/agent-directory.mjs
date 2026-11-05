/**
 * Agent directory 0.1.0 — rider agents ranked by benchhaus score.
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 *
 * Deterministic, offline, in-memory: no disk, no network. list() sorts by
 * score desc (ties by rider_id asc) so discovery always ranks best first.
 */
export const AGENT_DIRECTORY_VERSION = "0.1.0";

function text(v) {
  return v == null ? "" : String(v).trim();
}

function cleanAgent(a) {
  if (!a || typeof a !== "object") return null;
  const rider_id = text(a.rider_id);
  const endpoint = text(a.endpoint);
  if (!rider_id || !endpoint) return null;
  const rawScore = a.score ?? a.benchhaus_score ?? a.benchhaus;
  const score = Number(rawScore);
  if (!Number.isFinite(score) || score < 0) return null;
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
