/**
 * Tool versions 0.1.0 — version lifecycle + pinned resolution.
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 *
 * Deterministic, offline, pure: no disk, no network. Each entry carries
 * lifecycle { deprecated, sunset_at }; resolveVersion supports "latest",
 * exact ("1.2.3"), and range pins ("^1.0.0", "~1.0.0", ">=1.0.0").
 * Deprecated or sunset matches resolve fine but carry warnings in the
 * receipt. Unknown tools/versions and bad specs fail closed.
 */
export const TOOL_VERSIONS_VERSION = "0.1.0";

function text(v) {
  return v == null ? "" : String(v).trim();
}

function parseSemver(v) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(text(v));
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function cmpSemver(a, b) {
  for (let i = 0; i < 3; i += 1) {
    if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  }
  return 0;
}

function cleanEntry(e) {
  if (!e || typeof e !== "object") return null;
  const id = text(e.id);
  const version = text(e.version);
  if (!id || !parseSemver(version)) return null;
  return {
    id,
    version,
    semver: parseSemver(version),
    deprecated: e.deprecated === true,
    sunset_at: text(e.sunset_at) || null,
    meta: e.meta !== undefined ? e.meta : null,
  };
}

function matchRange(semver, spec) {
  const s = text(spec);
  let m;
  if ((m = /^\^(\d+\.\d+\.\d+)$/.exec(s))) {
    const base = parseSemver(m[1]);
    return base && semver[0] === base[0] && cmpSemver(semver, base) >= 0;
  }
  if ((m = /^~(\d+\.\d+\.\d+)$/.exec(s))) {
    const base = parseSemver(m[1]);
    return (
      base && semver[0] === base[0] && semver[1] === base[1] && cmpSemver(semver, base) >= 0
    );
  }
  if ((m = /^>=(\d+\.\d+\.\d+)$/.exec(s))) {
    const base = parseSemver(m[1]);
    return base && cmpSemver(semver, base) >= 0;
  }
  return null; // not a range shape
}

/** Create an isolated version catalog. */
export function createVersionCatalog(opts = {}) {
  const nowFn = typeof opts.nowFn === "function" ? opts.nowFn : () => Date.now();
  const entries = []; // insertion order = recency for "latest"

  return {
    register(entry) {
      const clean = cleanEntry(entry);
      if (!clean) return { ok: false, reason: "bad_tool" };
      if (entries.some((e) => e.id === clean.id && e.version === clean.version)) {
        return { ok: false, reason: "duplicate_tool" };
      }
      entries.push(clean);
      const { semver, ...pub } = clean;
      return { ok: true, tool: { ...pub } };
    },
    resolveVersion(id, spec = "latest") {
      const name = text(id);
      if (!name) return { ok: false, reason: "unknown_tool" };
      const want = text(spec) || "latest";
      const pool = entries.filter((e) => e.id === name);
      if (!pool.length) return { ok: false, reason: "unknown_tool" };
      let hit = null;
      if (want === "latest") {
        hit = pool[pool.length - 1];
      } else if (parseSemver(want)) {
        hit = pool.find((e) => e.version === want) ?? null;
        if (!hit) return { ok: false, reason: "unknown_version" };
      } else {
        const matched = pool.filter((e) => matchRange(e.semver, want) === true);
        if (!matched.length) {
          const anyRange = /^\^|^~|^>=/.test(want);
          return { ok: false, reason: anyRange ? "unknown_version" : "bad_spec" };
        }
        matched.sort((a, b) => cmpSemver(a.semver, b.semver));
        hit = matched[matched.length - 1];
      }
      const warnings = [];
      if (hit.deprecated) warnings.push("deprecated");
      if (hit.sunset_at) {
        const t = Date.parse(hit.sunset_at);
        if (Number.isNaN(t)) warnings.push("bad_sunset_at");
        else if (nowFn() >= t) warnings.push("sunset_passed");
        else warnings.push("sunset_scheduled");
      }
      const { semver, ...tool } = hit;
      return { ok: true, tool: { ...tool }, receipt: { warnings } };
    },
    list(id) {
      const name = text(id);
      if (!name) return { ok: false, reason: "unknown_tool" };
      const pool = entries
        .filter((e) => e.id === name)
        .map(({ semver, ...rest }) => ({ ...rest }))
        .sort((a, b) => (a.version < b.version ? -1 : a.version > b.version ? 1 : 0));
      if (!pool.length) return { ok: false, reason: "unknown_tool" };
      return { ok: true, tools: pool };
    },
  };
}
