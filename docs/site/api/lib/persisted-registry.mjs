/**
 * Persisted registry 0.1.0 — file-backed tool registry.
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 *
 * Deterministic, offline: JSONL append + in-memory index over the
 * tool-registry shapes ({ id, version, price_cents, endpoint, schema }).
 * Writes are atomic (tmp file + rename). The fs surface is an injectable
 * adapter ({ readFile, appendFile, writeFile, rename }); the default uses
 * node:fs sync calls and touches no network. All methods return
 * envelopes ({ ok:true,... } / { ok:false, reason }) and never throw
 * on bad input. Unknown lookups fail closed.
 */
import { appendFileSync, readFileSync, renameSync, writeFileSync } from "node:fs";

export const PERSISTED_REGISTRY_VERSION = "0.1.0";

function defaultFs() {
  return {
    readFile: (p) => readFileSync(p, "utf8"),
    appendFile: (p, s) => appendFileSync(p, s, "utf8"),
    writeFile: (p, s) => writeFileSync(p, s, "utf8"),
    rename: (a, b) => renameSync(a, b),
  };
}

function text(v) {
  return v == null ? "" : String(v).trim();
}

function cleanTool(t) {
  if (!t || typeof t !== "object") return null;
  const id = text(t.id);
  const version = text(t.version);
  const endpoint = text(t.endpoint);
  if (!id || !version || !endpoint) return null;
  const price = Number(t.price_cents);
  if (!Number.isSafeInteger(price) || price < 0) return null;
  return {
    id,
    version,
    price_cents: price,
    endpoint,
    schema: t.schema !== undefined ? t.schema : null,
  };
}

function fail(reason) {
  return { ok: false, reason };
}

/** Create a file-backed registry. opts: { path, fs }. */
export function createPersistedRegistry(opts = {}) {
  const path = text(opts.path);
  if (!path) throw new Error("persisted-registry: path required");
  const fs = opts.fs ?? defaultFs();
  const index = new Map(); // key `${id}@${version}` -> tool

  function parseLine(line) {
    try {
      return cleanTool(JSON.parse(line));
    } catch {
      return null;
    }
  }

  function load() {
    let raw;
    try {
      raw = fs.readFile(path);
    } catch (err) {
      if (err && (err.code === "ENOENT" || /no such file/i.test(String(err.message)))) {
        return { ok: true, loaded: 0 };
      }
      return fail("read_error");
    }
    if (typeof raw !== "string") return fail("read_error");
    let loaded = 0;
    for (const line of raw.split("\n")) {
      const t = line.trim();
      if (!t) continue;
      const clean = parseLine(t);
      if (!clean) return fail("corrupt_entry");
      index.set(`${clean.id}@${clean.version}`, clean);
      loaded += 1;
    }
    return { ok: true, loaded };
  }

  function persistAtomic() {
    const lines = [...index.values()].map((t) => JSON.stringify(t)).join("\n") + "\n";
    const tmp = `${path}.tmp`;
    try {
      fs.writeFile(tmp, lines);
      fs.rename(tmp, path);
    } catch {
      return fail("write_error");
    }
    return { ok: true };
  }

  return {
    path,
    load,
    register(tool) {
      const clean = cleanTool(tool);
      if (!clean) return fail("bad_tool");
      const key = `${clean.id}@${clean.version}`;
      if (index.has(key)) return fail("duplicate_tool");
      index.set(key, clean);
      try {
        fs.appendFile(path, JSON.stringify(clean) + "\n");
      } catch {
        index.delete(key);
        return fail("write_error");
      }
      return { ok: true, tool: { ...clean } };
    },
    get(id, version) {
      const name = text(id);
      if (!name) return fail("unknown_tool");
      const want = version == null ? null : text(version);
      const matches = [...index.values()].filter((t) => t.id === name);
      if (!matches.length) return fail("unknown_tool");
      if (want) {
        const hit = matches.find((t) => t.version === want);
        if (!hit) return fail("unknown_version");
        return { ok: true, tool: { ...hit } };
      }
      const hit = matches[matches.length - 1];
      return { ok: true, tool: { ...hit } };
    },
    list() {
      return [...index.values()]
        .map((t) => ({ ...t }))
        .sort((a, b) => a.id.localeCompare(b.id) || a.version.localeCompare(b.version));
    },
    /** Rewrite the backing file atomically from the index (compaction). */
    compact() {
      return persistAtomic();
    },
    size() {
      return index.size;
    },
  };
}
