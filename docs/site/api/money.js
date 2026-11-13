/**
 * GET|POST /api/money — grouped money-movement route.
 *
 * Dispatches by `action` (query for GET, body or query for POST):
 *   GET  payout-intent | payout-intents | dispute | disputes
 *        | refund | refunds-queued | subscription | subscriptions-due
 *        | prorate | fee-split | fiat-quote
 *   POST payout-quote | payout-claim | payout-executed
 *        | order-record | dispute-open | dispute-resolve
 *        | refund-execute | refund-claim | refund-settled
 *        | subscription-create | subscription-renew | fee-split-many
 *        | invoice
 *
 * Vercel-style default export(req, res). JSON envelope
 * { ok:true, ... } / { ok:false, error }. Fail-closed throughout.
 * Offline-safe: file stores fall back to os tmpdir (see lib defaults);
 * fiat quotes are instruction-only unless a session adapter is injected
 * server-side. No key material in code (env only).
 */
import {
  quotePayout,
  claimPayout,
  recordExecuted,
  getIntent,
  listIntents,
} from "./lib/operator-payouts.mjs";
import { logInternal } from "./lib/http-fail.mjs";
import {
  recordKnownOrder,
  openDispute,
  resolveDispute,
  getDispute,
  listDisputes,
} from "./lib/refund-disputes.mjs";
import {
  executeRefund,
  claimRefund,
  recordSettled,
  getRefund,
  listQueued,
} from "./lib/refund-executor.mjs";
import {
  createSubscription,
  getSubscription,
  dueSubs,
  recordRenewal,
  prorateUpgrade,
} from "./lib/subscriptions.mjs";
import { splitSchedule, splitScheduleMany } from "./lib/fee-split.mjs";
import { quoteFiat } from "./lib/fiat-settle.mjs";
import { buildMonthlyInvoice } from "./lib/depot-billing.mjs";

const READ = new Set([
  "payout-intent",
  "payout-intents",
  "dispute",
  "disputes",
  "refund",
  "refunds-queued",
  "subscription",
  "subscriptions-due",
  "prorate",
  "fee-split",
  "fiat-quote",
]);
const WRITE = new Set([
  "payout-quote",
  "payout-claim",
  "payout-executed",
  "order-record",
  "dispute-open",
  "dispute-resolve",
  "refund-execute",
  "refund-claim",
  "refund-settled",
  "subscription-create",
  "subscription-renew",
  "fee-split-many",
  "invoice",
]);

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function fail(res, status, error, extra) {
  send(res, status, { ok: false, error, ...(extra || {}) });
}

function statusFor(r) {
  const code = String(r.error || r.reason || "");
  if (
    code.startsWith("unknown_") ||
    code === "not_found" ||
    code === "bad_intent_id" ||
    code === "bad_dispute_id" ||
    code === "bad_sub_id"
  ) {
    return 404;
  }
  return 400;
}

function out(res, r) {
  if (r && r.ok) {
    const { ok, ...rest } = r;
    return send(res, 200, { ok: true, ...rest });
  }
  const rest = {};
  if (r) {
    for (const [k, v] of Object.entries(r)) {
      if (k !== "ok" && k !== "error" && k !== "reason") rest[k] = v;
    }
  }
  return fail(
    res,
    statusFor(r || {}),
    (r && (r.error || r.reason)) || "request_failed",
    rest,
  );
}

function readInput(req) {
  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return { __badJson: true };
    }
  }
  if (!body || typeof body !== "object") body = {};
  return { ...(req.query || {}), ...body };
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }
  const input = readInput(req);
  if (input.__badJson) return fail(res, 400, "invalid_json");
  const action = String(input.action || "").trim();
  if (!action) return fail(res, 400, "missing_action", { actions: [...READ, ...WRITE] });

  const isGet = req.method === "GET";
  const isPost = req.method === "POST";
  if (isGet && !READ.has(action)) {
    return fail(res, WRITE.has(action) ? 405 : 400,
      WRITE.has(action) ? "method_not_allowed" : "unknown_action");
  }
  if (isPost && !WRITE.has(action)) {
    return fail(res, READ.has(action) ? 405 : 400,
      READ.has(action) ? "method_not_allowed" : "unknown_action");
  }
  if (!isGet && !isPost) return fail(res, 405, "method_not_allowed");

  try {
    switch (action) {
      case "payout-quote":
        return out(res, quotePayout(input));
      case "payout-claim":
        return out(res, claimPayout(input));
      case "payout-executed":
        return out(res, recordExecuted(input));
      case "payout-intent":
        return out(res, getIntent(input.intent_id));
      case "payout-intents":
        return out(res, listIntents());
      case "order-record":
        return out(res, recordKnownOrder(input));
      case "dispute-open":
        return out(res, openDispute(input));
      case "dispute-resolve":
        return out(res, resolveDispute(input));
      case "dispute":
        return out(res, getDispute(input.dispute_id));
      case "disputes":
        return out(res, listDisputes());
      case "refund-execute":
        return out(res, executeRefund(input));
      case "refund-claim":
        return out(res, claimRefund(input));
      case "refund-settled":
        return out(res, recordSettled(input));
      case "refund":
        return out(res, getRefund(input.dispute_id));
      case "refunds-queued":
        return out(res, listQueued());
      case "subscription-create":
        return out(res, createSubscription(input));
      case "subscription-renew":
        return out(res, recordRenewal(input));
      case "subscription":
        return out(res, getSubscription(input.sub_id));
      case "subscriptions-due":
        return out(res, dueSubs(input.now_ms !== undefined ? input.now_ms : Date.now()));
      case "prorate":
        return out(res, prorateUpgrade(input));
      case "fee-split":
        return out(res, splitSchedule(input));
      case "fee-split-many":
        return out(res, splitScheduleMany(input));
      case "fiat-quote":
        return out(res, quoteFiat(input));
      case "invoice": {
        const invoice = buildMonthlyInvoice(input);
        if (!invoice) return fail(res, 400, "invalid_invoice_input");
        return send(res, 200, { ok: true, invoice });
      }
      default:
        return fail(res, 400, "unknown_action");
    }
  } catch (e) {
    return fail(res, 500, "internal", { request_id: logInternal(req, "money", e) });
  }
}
