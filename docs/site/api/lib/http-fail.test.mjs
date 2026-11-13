/** Generic-500 tests. Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { logInternal, requestId } from "./http-fail.mjs";

test("requestId honors caller id, mints otherwise", () => {
  assert.equal(requestId({ headers: { "x-request-id": "abc-123" } }), "abc-123");
  const minted = requestId({ headers: {} });
  assert.match(minted, /^[0-9a-f-]{36}$/);
});

test("logInternal returns id and never leaks the error", () => {
  const lines = [];
  const orig = console.error;
  console.error = (s) => lines.push(String(s));
  try {
    const id = logInternal({ headers: {} }, "probe", new Error("secret-db-down"));
    assert.match(id, /^[0-9a-f-]{36}$/);
    assert.equal(lines.length, 1);
    const logged = JSON.parse(lines[0]);
    assert.equal(logged.request_id, id);
    assert.match(logged.error, /secret-db-down/);
  } finally {
    console.error = orig;
  }
});
