/** Log-rotation tests. Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE. */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  planFor, sweep, pruneArchives, realFs,
  ROTATE_BYTES, SNAPSHOT_BYTES, ROTATE_MAX_AGE_MS, ARCHIVE_MAX_AGE_MS,
} from "./log-rotate.mjs";

const NOW = Date.UTC(2026, 10, 10, 12, 0, 0);
const DAY = 86400 * 1000;

function memFs(files) {
  // files: { name: { size, mtimeMs } }; dirs are implicit.
  const store = { ...files };
  const calls = { renamed: [], copied: [], unlinked: [] };
  return {
    calls,
    io: {
      readdir: () => Object.keys(store),
      stat: (p) => {
        const n = p.split("/").pop();
        if (!(n in store)) throw new Error("ENOENT");
        return { size: store[n].size, mtimeMs: store[n].mtimeMs };
      },
      rename: (a, b) => {
        const na = a.split("/").pop(), nb = b.split("/").pop();
        store[nb] = store[na];
        delete store[na];
        calls.renamed.push([na, nb]);
      },
      copy: (a, b) => {
        const na = a.split("/").pop(), nb = b.split("/").pop();
        store[nb] = { ...store[na] };
        calls.copied.push([na, nb]);
      },
      unlink: (p) => {
        calls.unlinked.push(p.split("/").pop());
        delete store[p.split("/").pop()];
      },
    },
    store,
  };
}

test("ledgers are snapshotted, never truncated", () => {
  const keep = planFor({ name: "sales.jsonl", size: ROTATE_BYTES + 1, mtimeMs: NOW, nowMs: NOW });
  assert.equal(keep.action, "keep");
  const snap = planFor({ name: "sales.jsonl", size: SNAPSHOT_BYTES, mtimeMs: NOW, nowMs: NOW });
  assert.equal(snap.action, "snapshot");
});

test("ops logs rotate on size or age", () => {
  assert.equal(planFor({ name: "ops.jsonl", size: ROTATE_BYTES, mtimeMs: NOW, nowMs: NOW }).action, "rotate");
  assert.equal(planFor({ name: "ops.jsonl", size: 10, mtimeMs: NOW - ROTATE_MAX_AGE_MS, nowMs: NOW }).action, "rotate");
  assert.equal(planFor({ name: "ops.jsonl", size: 10, mtimeMs: NOW, nowMs: NOW }).action, "keep");
});

test("sweep rotates the live log and deletes the expired archive", () => {
  const { io, store, calls } = memFs({
    "ops.jsonl": { size: ROTATE_BYTES + 5, mtimeMs: NOW },
    "ops.20260101-000000.jsonl": { size: 100, mtimeMs: NOW - ARCHIVE_MAX_AGE_MS - DAY },
    "ops.20261101-000000.jsonl": { size: 100, mtimeMs: NOW - DAY },
    "sales.jsonl": { size: ROTATE_BYTES + 5, mtimeMs: NOW },
  });
  const out = sweep("/data", io, NOW);
  const byFile = Object.fromEntries(out.map((r) => [r.file, r]));
  assert.equal(byFile["ops.jsonl"].action, "rotate");
  assert.ok(byFile["ops.jsonl"].dest.endsWith(".jsonl"));
  assert.equal(byFile["sales.jsonl"].action, "keep");
  assert.ok(calls.unlinked.includes("ops.20260101-000000.jsonl"), "expired archive gone");
  assert.ok(!calls.unlinked.includes("ops.20261101-000000.jsonl"), "fresh archive kept");
  assert.ok("sales.jsonl" in store, "ledger still live");
});

test("snapshot copies the ledger and keeps it live", () => {
  const { io, store, calls } = memFs({
    "sales.jsonl": { size: SNAPSHOT_BYTES, mtimeMs: NOW },
  });
  const out = sweep("/data", io, NOW);
  assert.equal(out[0].action, "snapshot");
  assert.equal(calls.copied.length, 1);
  assert.ok("sales.jsonl" in store, "ledger untouched");
});

test("pruneArchives removes only expired archives of the same stem", () => {
  const { io, calls } = memFs({
    "ops.20260101-000000.jsonl": { size: 1, mtimeMs: 0 },
    "ops.20261109-120000.jsonl": { size: 1, mtimeMs: NOW },
    "sales.jsonl": { size: 1, mtimeMs: 0 },
  });
  const pruned = pruneArchives("/data", "ops.jsonl", io, NOW);
  assert.deepEqual(pruned, ["ops.20260101-000000.jsonl"]);
  assert.deepEqual(calls.unlinked, ["ops.20260101-000000.jsonl"]);
});

test("realFs exposes the five fs operations", () => {
  assert.deepEqual(Object.keys(realFs()).sort(), ["copy", "readdir", "rename", "stat", "unlink"]);
});
