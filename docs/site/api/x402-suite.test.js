/** x402-suite handler tests (LAB50 step 47). Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE. */
import { test } from "node:test";
import assert from "node:assert/strict";
import handler from "./x402-suite.js";

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
  method, headers: {}, query, body, url: "/api/x402-suite",
});

test("OPTIONS answers 204 with allowlisted origin rules", async () => {
  const { res } = mockRes();
  await handler(req("OPTIONS"), res);
  assert.equal(res.statusCode, 204);
});

test("GET serves x402 discovery without payment", async () => {
  const m = mockRes();
  await handler(req("GET"), m.res);
  assert.equal(m.res.statusCode, 200);
  assert.equal(m.json().protocol, "x402");
  assert.ok(m.json().endpoints.agent_job);
});

test("PUT is 405", async () => {
  const m = mockRes();
  await handler(req("PUT"), m.res);
  assert.equal(m.res.statusCode, 405);
});
