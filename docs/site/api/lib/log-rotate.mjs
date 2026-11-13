/** Append-only log rotation policy. Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 *
 * Money ledgers are NEVER truncated: over the snapshot cap they get a dated
 * copy (a restore point aid) and keep growing. Operational logs rotate:
 * over size or age they move to a dated archive, and archives older than
 * the retention window are deleted. fs surface is injectable so tests never
 * touch disk.
 */
import { readdirSync, statSync, renameSync, copyFileSync, unlinkSync } from "node:fs";
export const LEDGER_NAMES = new Set([
  "sales.jsonl",
  "reputation.jsonl",
  "payouts.jsonl",
  "disputes.jsonl",
]);
export const ROTATE_BYTES = 10 * 1024 * 1024;
export const SNAPSHOT_BYTES = 50 * 1024 * 1024;
export const ROTATE_MAX_AGE_MS = 30 * 86400 * 1000;
export const ARCHIVE_MAX_AGE_MS = 90 * 86400 * 1000;

export function stamp(ms) {
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}-${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`;
}

/** Decide for one file. Pure: { action: "keep"|"snapshot"|"rotate", reason }. */
export function planFor({ name, size, mtimeMs, nowMs }) {
  const age = nowMs - mtimeMs;
  if (LEDGER_NAMES.has(name)) {
    if (size >= SNAPSHOT_BYTES) return { action: "snapshot", reason: "ledger_over_snapshot_cap" };
    return { action: "keep", reason: "ledger_never_truncated" };
  }
  if (size >= ROTATE_BYTES) return { action: "rotate", reason: "over_size_cap" };
  if (age >= ROTATE_MAX_AGE_MS) return { action: "rotate", reason: "over_age_cap" };
  return { action: "keep", reason: "within_caps" };
}

export function realFs() {
  return {
    readdir: (d) => readdirSync(d),
    stat: (p) => statSync(p),
    rename: (a, b) => renameSync(a, b),
    copy: (a, b) => copyFileSync(a, b),
    unlink: (p) => unlinkSync(p),
  };
}

/** Sweep one directory of *.jsonl files. Returns per-file results. */
export function sweep(dir, io, nowMs = Date.now()) {
  const out = [];
  let names = [];
  try {
    names = io.readdir(dir).filter((n) => n.endsWith(".jsonl"));
  } catch {
    return out;
  }
  for (const name of names) {
    const full = `${dir}/${name}`;
    if (/\.\d{8}(-\d{6})?(\.snapshot)?\.jsonl$/.test(name)) continue; // archives, not live logs
    let st;
    try {
      st = io.stat(full);
    } catch {
      continue;
    }
    const plan = planFor({ name, size: st.size, mtimeMs: st.mtimeMs, nowMs });
    if (plan.action === "keep") {
      out.push({ file: name, ...plan });
      continue;
    }
    const tag = stamp(nowMs);
    try {
      if (plan.action === "snapshot") {
        const dest = `${dir}/${name.replace(/\.jsonl$/, "")}.${tag.slice(0, 8)}.snapshot.jsonl`;
        io.copy(full, dest);
        out.push({ file: name, ...plan, dest });
      } else {
        const dest = `${dir}/${name.replace(/\.jsonl$/, "")}.${tag}.jsonl`;
        io.rename(full, dest);
        out.push({ file: name, ...plan, dest, pruned: pruneArchives(dir, name, io, nowMs) });
      }
    } catch (e) {
      out.push({ file: name, ...plan, error: String((e && e.message) || e) });
    }
  }
  return out;
}

/** Delete archives of `name` older than retention. Returns pruned names. */
export function pruneArchives(dir, name, io, nowMs) {
  const stem = name.replace(/\.jsonl$/, "");
  const pruned = [];
  let names = [];
  try {
    names = io.readdir(dir);
  } catch {
    return pruned;
  }
  for (const n of names) {
    if (!n.startsWith(stem + ".") || !n.endsWith(".jsonl")) continue;
    const full = `${dir}/${n}`;
    try {
      const st = io.stat(full);
      if (nowMs - st.mtimeMs >= ARCHIVE_MAX_AGE_MS) {
        io.unlink(full);
        pruned.push(n);
      }
    } catch {
      /* a racing writer wins; try next sweep */
    }
  }
  return pruned;
}
