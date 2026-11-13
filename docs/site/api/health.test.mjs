import test from "node:test";
import assert from "node:assert/strict";
import handler, { statusForHealth } from "./health.js";

function fakeRes() {
  return {
    statusCode: 0,
    headers: {},
    body: "",
    setHeader(k, v) { this.headers[k] = v; },
    end(s) { this.body = s; },
  };
}

test("status mapping: healthy 200, anything else 503", () => {
  assert.equal(statusForHealth({ ok: true }), 200);
  assert.equal(statusForHealth({ ok: false }), 503);
  assert.equal(statusForHealth(null), 503);
  assert.equal(statusForHealth({}), 503);
});

test("405 on non-GET", async () => {
  const res = fakeRes();
  await handler({ method: "POST", headers: {}, body: {} }, res);
  assert.equal(res.statusCode, 405);
});

test("GET returns the checker contract", async () => {
  const res = fakeRes();
  await handler({ method: "GET", headers: {}, query: {} }, res);
  assert.ok([200, 503].includes(res.statusCode));
  const body = JSON.parse(res.body);
  assert.equal(body.ok, res.statusCode === 200);
  assert.ok(typeof body.at === "string");
  assert.ok(Array.isArray(body.stages));
});
