/** livekit-token + tru8-chat smoke test. Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 *
 * Covers the LiveKit/Grok-free voice wiring with mock req/res (no network):
 *   livekit-token.js — GET descriptor, 503 stub without env, minted JWT shape with env
 *   tru8-chat.js    — GET descriptor names Nebius, POST fail-closes without NEBIUS_API_KEY
 */
import assert from "node:assert/strict";
import tokenHandler from "./livekit-token.js";
import tru8Handler from "./tru8-chat.js";

function mockReq({ method = "GET", body = undefined } = {}) {
  return { method, body, headers: {}, socket: { remoteAddress: "127.0.0.1" } };
}
function mockRes() {
  const chunks = [];
  return {
    statusCode: 200,
    headers: {},
    setHeader(k, v) {
      this.headers[String(k).toLowerCase()] = v;
    },
    end(c) {
      if (c !== undefined) chunks.push(String(c));
      this.body = chunks.join("");
      this.ended = true;
      return this;
    },
  };
}
async function call(handler, opts) {
  const req = mockReq(opts);
  const res = mockRes();
  await handler(req, res);
  let json = null;
  try {
    json = JSON.parse(res.body);
  } catch {
    json = null;
  }
  return { status: res.statusCode, json };
}

function b64urlJson(seg) {
  const b64 = seg.replace(/-/g, "+").replace(/_/g, "/");
  return JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
}

// Neutralize host env so the stub-status paths are deterministic.
for (const k of ["LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET", "NEBIUS_API_KEY"]) {
  delete process.env[k];
}

{
  const t = await call(tokenHandler, { method: "GET" });
  assert.equal(t.status, 200);
  assert.equal(t.json.service, "livekit-token");
  assert.equal(t.json.status, "unconfigured");
}

{
  const t = await call(tokenHandler, { method: "POST", body: { identity: "probe" } });
  assert.equal(t.status, 503);
  assert.equal(t.json.error, "livekit_unconfigured");
}

{
  process.env.LIVEKIT_URL = "wss://example.livekit.cloud";
  process.env.LIVEKIT_API_KEY = "APItestkey";
  process.env.LIVEKIT_API_SECRET = "testsecret0123456789testsecret01";
  const t = await call(tokenHandler, { method: "POST", body: { identity: "probe", room: "tru8-guide" } });
  assert.equal(t.status, 200);
  assert.ok(t.json.ok);
  assert.equal(t.json.identity, "probe");
  assert.equal(t.json.room, "tru8-guide");
  const parts = String(t.json.token).split(".");
  assert.equal(parts.length, 3);
  const payload = b64urlJson(parts[1]);
  assert.equal(payload.iss, "APItestkey");
  assert.equal(payload.sub, "probe");
  assert.equal(payload.video.room, "tru8-guide");
  assert.equal(payload.video.roomJoin, true);
  assert.equal(payload.exp - payload.iat, 6 * 3600);
  delete process.env.LIVEKIT_URL;
  delete process.env.LIVEKIT_API_KEY;
  delete process.env.LIVEKIT_API_SECRET;
}

{
  process.env.LIVEKIT_URL = "wss://example.livekit.cloud";
  process.env.LIVEKIT_API_KEY = "APItestkey";
  process.env.LIVEKIT_API_SECRET = "testsecret0123456789testsecret01";
  const t = await call(tokenHandler, { method: "POST", body: { identity: "no spaces allowed!!" } });
  assert.equal(t.status, 400);
  assert.equal(t.json.error, "bad_name");
  delete process.env.LIVEKIT_URL;
  delete process.env.LIVEKIT_API_KEY;
  delete process.env.LIVEKIT_API_SECRET;
}

{
  const t = await call(tru8Handler, { method: "GET" });
  assert.equal(t.status, 200);
  assert.equal(t.json.provider, "Nebius");
  assert.ok(!JSON.stringify(t.json).match(/xai|grok|spacexai/i));
}

{
  const t = await call(tru8Handler, { method: "POST", body: { message: "hello" } });
  assert.equal(t.status, 503);
  assert.equal(t.json.error, "llm_unconfigured");
}

console.log("livekit-token+tru8 smoke ok");
