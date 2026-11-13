/** Doors that share one short name. No network. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { siteRewrite, TOLL_TOOLS, TOLL_USD, CALL_TOOLS, aliasTool } from "./call-doors.mjs";
import { TOOLS } from "../mcp.js";
import seal from "../seal.js";
import open from "../open.js";
import research from "../research.js";
import fetchHandler from "../fetch.js";

function mockRes() {
  return {
    statusCode: 0,
    headers: {},
    body: "",
    setHeader(name, value) {
      this.headers[name] = value;
    },
    end(payload) {
      this.body = payload ? String(payload) : "";
    },
  };
}

test("site rewrites land on the existing handlers", () => {
  assert.equal(siteRewrite("/v1/compress"), "/api/compress");
  assert.equal(siteRewrite("/v1/zip"), "/api/archive");
  assert.equal(siteRewrite("/v1/unzip"), "/api/unarchive");
  assert.equal(siteRewrite("/v1/quote"), "/api/ppp-quote");
  assert.equal(siteRewrite("/v1/warrant/issue"), "/api/warrant/issue");
  assert.equal(siteRewrite("/v1/seal"), "/api/seal");
  assert.equal(siteRewrite("/v1/fetch"), "/api/fetch");
  assert.equal(siteRewrite("/v1/check"), null);
  assert.equal(siteRewrite("/v1/squeeze"), null);
  assert.equal(siteRewrite("/v1/pcc-compress"), null);
});

test("toll shelf keeps the published flat prices", () => {
  assert.equal(TOLL_TOOLS.length, 10);
  assert.equal(TOLL_USD["pcc-verify"], "0.02");
  assert.equal(TOLL_USD["chamber-seal"], "0.02");
  assert.equal(TOLL_USD["awlpay-quote"], "0.005");
  assert.equal(TOLL_USD["cuni-proof"], "0.10");
  assert.equal("pcc-compress" in TOLL_USD, false);
});

test("short names are aliases and the card list is unique", () => {
  assert.equal(aliasTool("compress"), "spl_compress");
  assert.equal(aliasTool("warrant_issue"), "spl_warrant_issue");
  assert.equal(aliasTool("seal"), null);
  const names = TOOLS.map((t) => t.name);
  assert.equal(new Set(names).size, names.length);
  for (const tool of CALL_TOOLS) assert.ok(names.includes(tool.name), tool.name);
  assert.ok(names.includes("check"));
  assert.ok(names.includes("spl_compress"));
});

test("seal is gated, open is free, and a key round-trips", async () => {
  const anon = mockRes();
  await seal({ method: "POST", headers: {}, body: { obj: { hello: "world!!" }, key_hex: "ab".repeat(32) } }, anon);
  assert.equal(anon.statusCode, 402);
  assert.equal(JSON.parse(anon.body).error, "tool_called_only");
  assert.equal(anon.body.includes("ab".repeat(32)), false);

  const key = "cd".repeat(32);
  const sealed = mockRes();
  await seal(
    {
      method: "POST",
      headers: { authorization: "Bearer testkey12" },
      body: { obj: { hello: "world!!" }, key_hex: key },
    },
    sealed,
  );
  assert.equal(sealed.statusCode, 200);
  const envelope = JSON.parse(sealed.body).envelope;
  assert.equal(envelope.magic, "ACNCH1");
  assert.equal(JSON.stringify(envelope).includes(key), false);

  const opened = mockRes();
  open({ method: "POST", headers: {}, body: { envelope, key_hex: key } }, opened);
  assert.equal(opened.statusCode, 200);
  assert.deepEqual(JSON.parse(opened.body).obj, { hello: "world!!" });
});

test("research and fetch refuse empty input without a network call", async () => {
  const searched = mockRes();
  await research({ method: "POST", headers: {}, body: {} }, searched);
  assert.equal(searched.statusCode, 400);
  assert.equal(JSON.parse(searched.body).error, "bad_query");

  const fetched = mockRes();
  await fetchHandler({ method: "POST", headers: {}, body: {} }, fetched);
  assert.equal(fetched.statusCode, 400);
  assert.equal(JSON.parse(fetched.body).error, "missing_url");
});
