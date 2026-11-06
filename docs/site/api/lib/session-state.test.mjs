/** Session state (.dSF): local-first continuity with one shared pointer file.
 *  Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import {
  saveSessionState,
  loadSessionState,
  mirrorSessionState,
  readMirroredState,
  dsfName,
  DSF_PREFIX,
  DSF_MAX_BYTES,
  DSF_VERSION,
} from "./session-state.mjs";

function memStore() {
  const entries = new Map();
  const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
  return {
    calls: [],
    async publish(input = {}) {
      this.calls.push({ op: "publish", name: input.name });
      const name = String(input.name || "");
      if (!name) return { ok: false, reason: "bad-name" };
      const bytes = Buffer.isBuffer(input.bytes)
        ? input.bytes
        : Buffer.from(String(input.blob_b64 || ""), "base64");
      if (!bytes.byteLength) return { ok: false, reason: "bad-bytes" };
      const sha = digest(bytes);
      entries.set(name, { sha256: sha, size: bytes.byteLength, bytes });
      return { ok: true, name, sha256: sha, size: bytes.byteLength, team: "lab" };
    },
    async retrieve(sha256) {
      this.calls.push({ op: "retrieve" });
      for (const e of entries.values()) {
        if (e.sha256 === sha256) {
          return { ok: true, sha256, size: e.size, bytes: e.bytes };
        }
      }
      return { ok: false, reason: "no_blob" };
    },
    async list() {
      this.calls.push({ op: "list" });
      return {
        ok: true,
        team: "lab",
        depots: [...entries].map(([name, e]) => ({
          name,
          sha256: e.sha256,
          size: e.size,
          has_blob: true,
        })),
      };
    },
  };
}

test("dsf names are namespaced per rider", () => {
  assert.equal(dsfName("rider-1"), ".dsf/rider-1");
  assert.equal(dsfName(""), null);
  assert.equal(dsfName("../x"), null);
  assert.equal(DSF_PREFIX, ".dsf/");
  assert.match(DSF_VERSION, /^\d+\.\d+\.\d+$/);
  assert.ok(DSF_MAX_BYTES <= 65536);
});

test("save then load round-trips small state", async () => {
  const store = memStore();
  const saved = await saveSessionState(store, {
    rider_id: "rider-1",
    state: { goal: "ship acn", step: 3 },
  });
  assert.equal(saved.ok, true);
  assert.equal(saved.name, ".dsf/rider-1");
  assert.equal(saved.seq, 1);
  const loaded = await loadSessionState(store, { rider_id: "rider-1" });
  assert.equal(loaded.ok, true);
  assert.deepEqual(loaded.doc.state, { goal: "ship acn", step: 3 });
  assert.equal(loaded.doc.seq, 1);
  assert.equal(loaded.doc.prev_sha, null);
});

test("second save chains prev_sha and bumps seq", async () => {
  const store = memStore();
  const first = await saveSessionState(store, { rider_id: "r2", state: { a: 1 } });
  const second = await saveSessionState(store, {
    rider_id: "r2",
    state: { a: 2 },
    prev_sha: first.sha256,
  });
  assert.equal(second.ok, true);
  assert.equal(second.seq, 2);
  const loaded = await loadSessionState(store, { rider_id: "r2" });
  assert.equal(loaded.doc.seq, 2);
  assert.equal(loaded.doc.prev_sha, first.sha256);
});

test("stale prev_sha refuses without publishing", async () => {
  const store = memStore();
  const first = await saveSessionState(store, { rider_id: "r3", state: { a: 1 } });
  await saveSessionState(store, { rider_id: "r3", state: { a: 2 }, prev_sha: first.sha256 });
  const publishesBefore = store.calls.filter((c) => c.op === "publish").length;
  const clash = await saveSessionState(store, {
    rider_id: "r3",
    state: { a: 3 },
    prev_sha: first.sha256,
  });
  assert.equal(clash.ok, false);
  assert.equal(clash.reason, "conflict");
  assert.ok(clash.latest);
  assert.equal(store.calls.filter((c) => c.op === "publish").length, publishesBefore);
});

test("oversize state and secret keys refuse before any network", async () => {
  const store = memStore();
  const big = await saveSessionState(store, {
    rider_id: "r4",
    state: { blob: "x".repeat(DSF_MAX_BYTES + 1) },
  });
  assert.equal(big.ok, false);
  assert.equal(big.reason, "too-large");
  const sneaky = await saveSessionState(store, {
    rider_id: "r4",
    state: { nested: { api_key: "live-secret-value" } },
  });
  assert.equal(sneaky.ok, false);
  assert.equal(sneaky.reason, "secret_keys");
  assert.deepEqual(store.calls, []);
});

test("load of a missing pointer reports no_state", async () => {
  const store = memStore();
  const r = await loadSessionState(store, { rider_id: "ghost" });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "no_state");
});

test("local mirror round-trips without the depot", async () => {
  const dir = mkdtempSync(join(tmpdir(), "dsf-mirror-"));
  const doc = { v: 1, kind: "dsf", rider_id: "r5", seq: 1, prev_sha: null, saved_ms: 7, state: { a: 1 } };
  const saved = mirrorSessionState(doc, { dir });
  assert.equal(saved.ok, true);
  const back = readMirroredState({ rider_id: "r5" }, { dir });
  assert.equal(back.ok, true);
  assert.deepEqual(back.doc.state, { a: 1 });
  assert.equal(readMirroredState({ rider_id: "nobody" }, { dir }).reason, "no_mirror");
});
