/** tru8-chat handler tests (LAB50 step 47). Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE. */
import { test } from "node:test";
import assert from "node:assert/strict";
import handler from "./tru8-chat.js";

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
  method, headers: {}, query, body, url: "/api/tru8-chat",
});

test("OPTIONS answers 204", async () => {
  const { res } = mockRes();
  await handler(req("OPTIONS"), res);
  assert.equal(res.statusCode, 204);
});

test("GET serves the service descriptor without secrets", async () => {
  const m = mockRes();
  await handler(req("GET"), m.res);
  assert.equal(m.res.statusCode, 200);
  assert.equal(m.json().service, "tru8-chat");
  assert.match(m.json().endpoint, /POST \/api\/tru8-chat/);
});
