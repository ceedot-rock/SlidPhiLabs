import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const SECRET = "whsec_test_step19";
process.env.STRIPE_WEBHOOK_SECRET = SECRET;
const LEDGER = join(await mkdtemp(join(tmpdir(), "wh-")), "sales.jsonl");
process.env.SALES_LEDGER_PATH = LEDGER;
const handler = (await import("./stripe-webhook.js")).default;

function sign(raw) {
  const t = Math.floor(Date.now() / 1000);
  const sig = createHmac("sha256", SECRET).update(`${t}.${raw}`).digest("hex");
  return `t=${t},v1=${sig}`;
}

function fakeRes() {
  return {
    statusCode: 0,
    headers: {},
    body: "",
    setHeader(k, v) { this.headers[k] = v; },
    end(s) { this.body = s; },
  };
}

async function post(event, { sig, secret = true } = {}) {
  if (!secret) delete process.env.STRIPE_WEBHOOK_SECRET;
  else process.env.STRIPE_WEBHOOK_SECRET = SECRET;
  const raw = Buffer.from(JSON.stringify(event));
  const req = {
    method: "POST",
    headers: { "stripe-signature": sig === undefined ? sign(raw) : sig },
    rawBody: raw,
    body: event,
  };
  const res = fakeRes();
  await handler(req, res);
  return { status: res.statusCode, body: JSON.parse(res.body) };
}

const completed = (id) => ({
  id: "evt_1",
  type: "checkout.session.completed",
  data: { object: { id, payment_status: "paid", amount_total: 900, currency: "usd", metadata: { sku: "try-gate" } } },
});

test("405 on GET, 503 without secret, 400 on bad signature", async () => {
  const res = fakeRes();
  await handler({ method: "GET", headers: {}, body: {} }, res);
  assert.equal(res.statusCode, 405);
  const r = await post(completed("cs_x"), { secret: false });
  assert.equal(r.status, 503);
  const bad = await post(completed("cs_x"), { sig: "t=1,v1=00" });
  assert.equal(bad.status, 400);
});

test("records once, replays dedupe, ledger holds one line", async () => {
  const first = await post(completed("cs_dup1"));
  assert.equal(first.status, 200);
  assert.equal(first.body.recorded, true);
  const replay = await post(completed("cs_dup1"));
  assert.equal(replay.status, 200);
  assert.equal(replay.body.duplicate, true);
  const lines = (await readFile(LEDGER, "utf8")).trim().split("\n");
  assert.equal(lines.length, 1);
  assert.equal(JSON.parse(lines[0]).order_id, "cs_dup1");
});

test("unreadable ledger answers 500 and writes nothing", async () => {
  const dir = await mkdtemp(join(tmpdir(), "whdir-"));
  process.env.SALES_LEDGER_PATH = dir;
  try {
    const r = await post(completed("cs_broken"));
    assert.equal(r.status, 500);
    assert.equal(r.body.error, "ledger_unreadable");
  } finally {
    process.env.SALES_LEDGER_PATH = LEDGER;
  }
});

test("ignored events ack 200 and leave an audit line outside the ledger", async () => {
  const before = await readFile(LEDGER, "utf8");
  const r = await post({ id: "evt_9", type: "charge.refunded", data: {} });
  assert.equal(r.status, 200);
  assert.equal(r.body.ignored, true);
  assert.equal(await readFile(LEDGER, "utf8"), before);
  const audit = await readFile(join(dirname(LEDGER), "webhook-audit.jsonl"), "utf8");
  const last = JSON.parse(audit.trim().split("\n").pop());
  assert.equal(last.kind, "webhook_ignored");
  assert.equal(last.reason, "unhandled_type");
});
