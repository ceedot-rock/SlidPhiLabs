/** duos handler tests (LAB50 step 47). Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE. */
import { test } from "node:test";
import assert from "node:assert/strict";
import handler from "./duos.js";

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
  method, headers: {}, query, body, url: "/api/duos",
});

test("OPTIONS answers 204", async () => {
  const { res } = mockRes();
  await handler(req("OPTIONS"), res);
  assert.equal(res.statusCode, 204);
});

test("GET answers report-or-404 with an ok flag", async () => {
  const m = mockRes();
  await handler(req("GET"), m.res);
  assert.ok([200, 404].includes(m.res.statusCode), `status ${m.res.statusCode}`);
  assert.equal(typeof m.json().ok, "boolean");
});
