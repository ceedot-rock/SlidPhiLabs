/** decompress handler tests (LAB50 step 47). Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE. */
import { test } from "node:test";
import assert from "node:assert/strict";
import handler from "./decompress.js";

function mockRes() {
  const headers = {};
  let body = "";
  return {
    res: {
      statusCode: 200,
      setHeader(k, v) { headers[k.toLowerCase()] = String(v); },
      end(d) { if (d !== undefined) body += String(d); },
    },
    json() { return JSON.parse(body); },
  };
}

const req = (method, query = {}, body = undefined) => ({
  method, headers: {}, query, body, url: "/api/decompress",
});

test("OPTIONS answers 204", async () => {
  const { res } = mockRes();
  await handler(req("OPTIONS"), res);
  assert.equal(res.statusCode, 204);
});

test("GET describes the pair contract", async () => {
  const m = mockRes();
  await handler(req("GET"), m.res);
  assert.equal(m.res.statusCode, 200);
  assert.equal(m.json().ok, true);
  assert.match(m.json().pair, /\/api\/compress/);
});

test("PUT is 405 POST-only", async () => {
  const m = mockRes();
  await handler(req("PUT"), m.res);
  assert.equal(m.res.statusCode, 405);
});
