/**
 * Session state (.dSF) — work persists between logins, local-first.
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 *
 * Bulk stays on the rider's own disk (ledgers, blobs, checkouts). Exactly
 * one small pointer file per rider, `.dsf/<rider_id>`, lives in the shared
 * depot so the next login resumes anywhere: last goal, step, and content
 * hashes — never secrets, never bulk. The depot publish overwrites the
 * name, so saves carry prev_sha: a stale prev_sha refuses with "conflict"
 * instead of silently forking two logins. A local mirror under ~/.acn
 * keeps the last known state readable with zero network.
 *
 * Pure except through the injected store and the explicit mirror helpers.
 * Fail-closed throughout: bad input, unreadable bases, oversize docs, and
 * secret-looking keys all refuse before any network call.
 */
import { existsSync, mkdirSync, writeFileSync, readFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import { homedir, tmpdir } from "node:os";

export const DSF_VERSION = "0.1.0";
export const DSF_PREFIX = ".dsf/";
export const DSF_KIND = "dsf";
export const DSF_MAX_BYTES = 65536;
export const RIDER_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

/** Key names that never belong in a shared pointer file, at any depth. */
export const SECRET_KEY_RE =
  /^(secret|password|passwd|private_key|privatekey|api_key|apikey|bearer|bearer_token|claim_token|access_token|refresh_token|client_secret)$/i;

export function defaultMirrorDir() {
  try {
    const home = homedir();
    if (home) return join(home, ".acn", "sessions");
  } catch {
    // fall through to tmp
  }
  return join(tmpdir(), "acn-sessions");
}

/** Well-known pointer name for a rider, or null when the id is unusable. */
export function dsfName(riderId) {
  if (typeof riderId !== "string" || !RIDER_RE.test(riderId)) return null;
  return DSF_PREFIX + riderId;
}

function findSecretKeys(value, seen = []) {
  if (Array.isArray(value)) {
    for (const item of value) findSecretKeys(item, seen);
    return seen;
  }
  if (value && typeof value === "object") {
    for (const k of Object.keys(value)) {
      if (SECRET_KEY_RE.test(k) && !seen.includes(k)) seen.push(k);
      findSecretKeys(value[k], seen);
    }
  }
  return seen;
}

function checkStateDoc(state) {
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    return { ok: false, reason: "bad_state" };
  }
  const secrets = findSecretKeys(state);
  if (secrets.length) return { ok: false, reason: "secret_keys", keys: secrets };
  let raw;
  try {
    const text = JSON.stringify(state);
    if (text === undefined) return { ok: false, reason: "bad_state" };
    raw = Buffer.from(text, "utf8");
  } catch {
    return { ok: false, reason: "bad_state" };
  }
  if (raw.byteLength > DSF_MAX_BYTES) return { ok: false, reason: "too-large" };
  return { ok: true, raw };
}

function checkDocShape(doc, riderId) {
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) return "bad_state";
  if (doc.kind !== DSF_KIND || doc.v !== 1) return "bad_state";
  if (doc.rider_id !== riderId) return "rider_mismatch";
  if (!Number.isSafeInteger(doc.seq) || doc.seq < 1) return "bad_state";
  if (!doc.state || typeof doc.state !== "object" || Array.isArray(doc.state)) {
    return "bad_state";
  }
  return null;
}

async function latestPointer(store, name) {
  const listed = await store.list();
  if (!listed || listed.ok !== true || !Array.isArray(listed.depots)) {
    return { ok: false, reason: (listed && listed.reason) || "list_failed" };
  }
  const hit = listed.depots.find((d) => d && d.name === name) || null;
  return { ok: true, hit };
}

/**
 * Save state for a rider. prev_sha chains saves: pass the sha the last
 * load/save returned; a mismatch means another login wrote first and this
 * save refuses with "conflict" plus the winning sha — re-load, merge, retry.
 */
export async function saveSessionState(store, input = {}) {
  const o = input && typeof input === "object" ? input : {};
  const name = dsfName(o.rider_id);
  if (!name) return { ok: false, reason: "bad_rider" };
  const checked = checkStateDoc(o.state);
  if (!checked.ok) {
    const out = { ok: false, reason: checked.reason };
    if (checked.keys) out.keys = checked.keys;
    return out;
  }
  if (!store || typeof store.list !== "function" || typeof store.publish !== "function") {
    return { ok: false, reason: "bad_store" };
  }
  const found = await latestPointer(store, name);
  if (!found.ok) return { ok: false, reason: found.reason };
  let seq = 1;
  let prevSha = null;
  if (found.hit) {
    const got = await store.retrieve(found.hit.sha256);
    if (!got || got.ok !== true) return { ok: false, reason: "base_unreadable" };
    let base;
    try {
      base = JSON.parse(Buffer.from(got.bytes).toString("utf8"));
    } catch {
      return { ok: false, reason: "base_corrupt" };
    }
    const shapeBad = checkDocShape(base, o.rider_id);
    if (shapeBad) return { ok: false, reason: "base_corrupt" };
    if (o.prev_sha != null && o.prev_sha !== found.hit.sha256) {
      return { ok: false, reason: "conflict", latest: found.hit.sha256, seq: base.seq };
    }
    seq = base.seq + 1;
    prevSha = found.hit.sha256;
  }
  const now =
    typeof o.nowMs === "number" && Number.isSafeInteger(o.nowMs) && o.nowMs >= 0
      ? o.nowMs
      : Date.now();
  const doc = {
    v: 1,
    kind: DSF_KIND,
    rider_id: o.rider_id,
    seq,
    prev_sha: prevSha,
    saved_ms: now,
    state: o.state,
  };
  const published = await store.publish({
    name,
    bytes: Buffer.from(JSON.stringify(doc), "utf8"),
    provenance: { source: "dsf", rider_id: o.rider_id, seq },
  });
  if (!published || published.ok !== true) {
    return { ok: false, reason: (published && published.reason) || "publish_failed" };
  }
  return { ok: true, name, sha256: published.sha256, seq, saved_ms: now };
}

/** Load the latest pointer doc for a rider. Missing pointer is no_state. */
export async function loadSessionState(store, input = {}) {
  const o = input && typeof input === "object" ? input : {};
  const name = dsfName(o.rider_id);
  if (!name) return { ok: false, reason: "bad_rider" };
  if (!store || typeof store.list !== "function" || typeof store.retrieve !== "function") {
    return { ok: false, reason: "bad_store" };
  }
  const found = await latestPointer(store, name);
  if (!found.ok) return { ok: false, reason: found.reason };
  if (!found.hit) return { ok: false, reason: "no_state" };
  const got = await store.retrieve(found.hit.sha256);
  if (!got || got.ok !== true) return { ok: false, reason: "base_unreadable" };
  let doc;
  try {
    doc = JSON.parse(Buffer.from(got.bytes).toString("utf8"));
  } catch {
    return { ok: false, reason: "bad_state" };
  }
  const shapeBad = checkDocShape(doc, o.rider_id);
  if (shapeBad) return { ok: false, reason: shapeBad };
  return { ok: true, doc, sha256: found.hit.sha256 };
}

/** Write the local mirror of a pointer doc. Explicit: no auto disk writes. */
export function mirrorSessionState(doc, opts = {}) {
  const shapeBad = !doc || typeof doc !== "object" ? "bad_doc" : checkDocShape(doc, doc.rider_id);
  if (shapeBad) return { ok: false, reason: shapeBad };
  const dir = opts && typeof opts.dir === "string" && opts.dir ? opts.dir : defaultMirrorDir();
  try {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
    const f = join(dir, ".dsf-" + doc.rider_id + ".json");
    const tmp = f + ".tmp";
    writeFileSync(tmp, JSON.stringify(doc), { mode: 0o600 });
    renameSync(tmp, f);
  } catch {
    return { ok: false, reason: "mirror_failed" };
  }
  return { ok: true, rider_id: doc.rider_id };
}

/** Read the local mirror. Missing file is no_mirror, never an error. */
export function readMirroredState(input = {}, opts = {}) {
  const o = input && typeof input === "object" ? input : {};
  if (typeof o.rider_id !== "string" || !RIDER_RE.test(o.rider_id)) {
    return { ok: false, reason: "bad_rider" };
  }
  const dir = opts && typeof opts.dir === "string" && opts.dir ? opts.dir : defaultMirrorDir();
  const f = join(dir, ".dsf-" + o.rider_id + ".json");
  if (!existsSync(f)) return { ok: false, reason: "no_mirror" };
  let doc;
  try {
    doc = JSON.parse(readFileSync(f, "utf8"));
  } catch {
    return { ok: false, reason: "bad_mirror" };
  }
  const shapeBad = checkDocShape(doc, o.rider_id);
  if (shapeBad) return { ok: false, reason: "bad_mirror" };
  return { ok: true, doc };
}
