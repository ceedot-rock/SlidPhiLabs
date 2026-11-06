/** Token budget tests. Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE. */
import test from "node:test";
import assert from "node:assert/strict";
import {
  TOKEN_BUDGET_VERSION, BUDGET_WARN_FRACTION, MEMO_MAX_ENTRIES,
  createTokenBudget, createMemoryUsageStore, createMemoryMemoStore,
  memoizedCompress, truncateToBudget,
} from "./token-budget.mjs";

test("version pinned", () => assert.equal(TOKEN_BUDGET_VERSION, "0.1.0"));

test("charge accumulates and warns at 0.8", () => {
  const b = createTokenBudget({ capTokens: 100 });
  const first = b.charge("r1", 79);
  assert.equal(first.ok, true);
  assert.equal(first.warn, false);
  const second = b.charge("r1", 1);
  assert.equal(second.ok, true);
  assert.equal(second.warn, true);
  assert.equal(second.used_tokens, 80);
  assert.equal(second.remaining_tokens, 20);
});

test("charge fails closed over cap, bytes unchanged", () => {
  const b = createTokenBudget({ capTokens: 10 });
  assert.equal(b.charge("r1", 10).ok, true);
  const over = b.charge("r1", 1);
  assert.equal(over.ok, false);
  assert.equal(over.error, "budget_exceeded");
  assert.equal(b.status("r1").used_tokens, 10);
});

test("keys are isolated, anon fallback", () => {
  const b = createTokenBudget({ capTokens: 5 });
  assert.equal(b.charge("a", 5).ok, true);
  assert.equal(b.charge("b", 5).ok, true);
  assert.equal(b.charge("", 1).key, "anon");
});

test("zero cap means unmetered", () => {
  const b = createTokenBudget({});
  assert.equal(b.charge("r1", 1e9).ok, true);
});

test("custom usage store adapter", () => {
  const backing = new Map([["r1", 3]]);
  const b = createTokenBudget({ capTokens: 10, store: { load: (k) => backing.get(k) || 0, save: (k, v) => backing.set(k, v) } });
  assert.equal(b.status("r1").used_tokens, 3);
  assert.equal(b.charge("r1", 4).used_tokens, 7);
});

test("memo hit spends zero recompute tokens", () => {
  const memo = createMemoryMemoStore();
  let calls = 0;
  const compressFn = ({ text }) => { calls += 1; return { ok: true, output: text.slice(0, 2) }; };
  const first = memoizedCompress({ text: "hello world", query: "q" }, { memo, compressFn });
  assert.equal(first.ok, true);
  assert.equal(first.hit, false);
  assert.equal(calls, 1);
  const second = memoizedCompress({ text: "hello world", query: "q" }, { memo, compressFn });
  assert.equal(second.ok, true);
  assert.equal(second.hit, true);
  assert.equal(second.recompute_tokens, 0);
  assert.equal(calls, 1);
  assert.deepEqual(second.receipt, first.receipt);
});

test("memo miss without adapter fails closed", () => {
  const r = memoizedCompress({ text: "x" }, { memo: createMemoryMemoStore() });
  assert.equal(r.ok, false);
  assert.equal(r.error, "adapter_required");
});

test("memo miss with failing adapter fails closed", () => {
  const r = memoizedCompress({ text: "x" }, { memo: createMemoryMemoStore(), compressFn: () => { throw new Error("boom"); } });
  assert.equal(r.ok, false);
  assert.equal(r.error, "compress_failed");
});

test("memo evicts past cap", () => {
  const memo = createMemoryMemoStore();
  for (let i = 0; i < MEMO_MAX_ENTRIES + 5; i++) memo.record("d" + i, { ok: true, n: i });
  assert.equal(memo.lookup("d0"), null);
  assert.equal(memo.lookup("d" + (MEMO_MAX_ENTRIES + 4)).n, MEMO_MAX_ENTRIES + 4);
});

test("truncate keeps best inside budget, deterministic ties", () => {
  const chunks = [
    { text: "a b", score: 1 },
    { text: "c d e f", score: 9 },
    { text: "g h", score: 9 },
  ];
  const r = truncateToBudget(chunks, 6);
  assert.equal(r.ok, true);
  assert.deepEqual(r.kept, ["c d e f", "g h"]);
  assert.deepEqual(r.dropped, ["a b"]);
  assert.equal(r.kept_tokens, 6);
});

test("truncate rejects non-array", () => {
  assert.equal(truncateToBudget(null, 10).error, "bad_chunks");
});

test("warn fraction tunable", () => {
  const b = createTokenBudget({ capTokens: 100, warnFraction: 0.5 });
  assert.equal(BUDGET_WARN_FRACTION, 0.8);
  assert.equal(b.charge("r1", 50).warn, true);
});

test("usage store defaults isolated per budget", () => {
  const a = createTokenBudget({ capTokens: 10 });
  const b = createTokenBudget({ capTokens: 10 });
  a.charge("r1", 10);
  assert.equal(b.status("r1").used_tokens, 0);
  assert.equal(createMemoryUsageStore().load("r1"), 0);
});
