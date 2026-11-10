/** Paid-route CORS tests. Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { isAllowedOrigin, paidCors } from "./cors.mjs";

function resDouble() {
  const headers = {};
  return {
    headers,
    setHeader(k, v) { headers[k.toLowerCase()] = String(v); },
  };
}

const reqWith = (origin) => ({ headers: origin ? { origin } : {} });

test("site origins allowed", () => {
  assert.equal(isAllowedOrigin("https://www.slidphilabs.com"), true);
  assert.equal(isAllowedOrigin("https://slidphilabs.com"), true);
});

test("foreign origins rejected, even in dev", () => {
  assert.equal(isAllowedOrigin("https://evil.example"), false);
  assert.equal(isAllowedOrigin("https://slidphilabs.com.evil.example"), false);
  assert.equal(isAllowedOrigin(""), false);
  assert.equal(isAllowedOrigin(null), false);
});

test("localhost allowed outside production, denied in production", () => {
  assert.equal(isAllowedOrigin("http://localhost:3000", { NODE_ENV: "test" }), true);
  assert.equal(isAllowedOrigin("http://localhost:3000", { NODE_ENV: "production" }), false);
  assert.equal(isAllowedOrigin("https://www.slidphilabs.com", { NODE_ENV: "production" }), true);
});

test("paidCors echoes allowlisted origin, omits foreign", () => {
  const good = resDouble();
  paidCors(reqWith("https://www.slidphilabs.com"), good, "POST, OPTIONS, GET");
  assert.equal(good.headers["access-control-allow-origin"], "https://www.slidphilabs.com");
  assert.equal(good.headers.vary, "Origin");

  const bad = resDouble();
  paidCors(reqWith("https://evil.example"), bad, "POST, OPTIONS, GET");
  assert.ok(!("access-control-allow-origin" in bad.headers));

  const agent = resDouble();
  paidCors(reqWith(null), agent, "POST, OPTIONS, GET");
  assert.ok(!("access-control-allow-origin" in agent.headers));
});

test("checkout preflight: evil origin gets no ACAO header", async () => {
  const { default: handler } = await import("../checkout.js");
  const headers = {};
  const res = {
    statusCode: 200,
    setHeader(k, v) { headers[k.toLowerCase()] = String(v); },
    end() {},
  };
  await handler({ method: "OPTIONS", headers: { origin: "https://evil.example" } }, res);
  assert.equal(res.statusCode, 204);
  assert.ok(!("access-control-allow-origin" in headers));

  const headers2 = {};
  const res2 = {
    statusCode: 200,
    setHeader(k, v) { headers2[k.toLowerCase()] = String(v); },
    end() {},
  };
  await handler({ method: "OPTIONS", headers: { origin: "https://www.slidphilabs.com" } }, res2);
  assert.equal(headers2["access-control-allow-origin"], "https://www.slidphilabs.com");
});
