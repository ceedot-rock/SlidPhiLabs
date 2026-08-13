/**
 * SPL Pay Per Suite — client SDK
 * Quote on the spot · Stripe pay · submit job to the lab suite.
 */
import {
  computeQuote,
  classifyBytes,
  usageFeeCents,
  STRIPE_PAYMENT_LINK,
  SITE_PPS,
  API_BASE,
  PRODUCT_BASE,
  PRODUCT_ADD_CENTS,
  DATA_MULT,
  OP_MULT,
  FREE_BYTES,
  MIN_PAID_CENTS,
  MIN_CENTS,
  MAX_CENTS,
  MAX_BYTES,
  SUITE_PRICING,
} from "./quote.mjs";

export {
  computeQuote,
  classifyBytes,
  usageFeeCents,
  STRIPE_PAYMENT_LINK,
  SITE_PPS,
  API_BASE,
  PRODUCT_BASE,
  PRODUCT_ADD_CENTS,
  DATA_MULT,
  OP_MULT,
  FREE_BYTES,
  MIN_PAID_CENTS,
  MIN_CENTS,
  MAX_CENTS,
  MAX_BYTES,
  SUITE_PRICING,
};

export const SERVICE_NAME = "SPL Pay Per Suite";

/**
 * Live quote from site API (falls back to local computeQuote).
 */
export async function quoteRemote(opts = {}) {
  try {
    const r = await fetch(`${API_BASE}/api/ppp-quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product: opts.product || "auto",
        dataClass: opts.dataClass || opts.data_class || "unknown",
        op: opts.op || "compress",
        bytes: opts.bytes || 0,
      }),
    });
    if (r.ok) {
      const data = await r.json();
      return { ...data, service: SERVICE_NAME, suite_url: SITE_PPS, source: "api" };
    }
  } catch {
    /* local fallback */
  }
  return { ...computeQuote(opts), source: "local" };
}

/**
 * Get Stripe checkout URL (session if server has secret; else payment link).
 */
export async function createCheckout(opts = {}) {
  try {
    const r = await fetch(`${API_BASE}/api/ppp-checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product: opts.product || "auto",
        dataClass: opts.dataClass || opts.data_class || "unknown",
        op: opts.op || "compress",
        bytes: opts.bytes || 0,
        email: opts.email || "",
      }),
    });
    if (r.ok) {
      const data = await r.json();
      return { ...data, service: SERVICE_NAME };
    }
  } catch {
    /* fall through */
  }
  const q = computeQuote(opts);
  const url = new URL(STRIPE_PAYMENT_LINK);
  if (opts.email) url.searchParams.set("prefilled_email", opts.email);
  return {
    ok: true,
    mode: "payment_link",
    url: url.toString(),
    quote: q,
    service: SERVICE_NAME,
    instructions: `On Stripe, enter amount $${q.amount_display} (your SPL Pay Per Suite quote).`,
  };
}

/**
 * Submit a paid (or ready) project job to the lab.
 */
export async function submitJob(opts = {}) {
  const r = await fetch(`${API_BASE}/api/ppp-job`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: opts.email,
      product: opts.product || opts.tool || "auto",
      dataClass: opts.dataClass || opts.data_class || "unknown",
      op: opts.op || "compress",
      bytes: opts.bytes || 0,
      amount_display: opts.amount_display || opts.amount || "",
      tool: opts.tool || opts.product || "auto",
      fileName: opts.fileName || opts.file_name || "",
      paidConfirm: opts.paidConfirm ?? opts.paid ?? false,
      note: opts.note || "",
      sampleHint: opts.sampleHint || opts.sample_hint || "",
    }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error(data.error || `Job submit failed (${r.status})`);
    err.data = data;
    throw err;
  }
  return { ...data, service: SERVICE_NAME };
}

/** Agentic x402 endpoints (machines). Humans use Stripe. */
export const X402_SUITE_URL = `${API_BASE}/api/x402-suite`;
export const X402_PRODUCTS_URL = `${API_BASE}/api/x402-products`;
export const AGENT_DISCOVERY_URL = `${API_BASE}/api/agent`;

/**
 * Discover agentic commerce rails (Stripe human + x402 agent).
 */
export async function agentDiscovery() {
  try {
    const r = await fetch(AGENT_DISCOVERY_URL);
    if (r.ok) return await r.json();
  } catch {
    /* fall through */
  }
  return {
    service: SERVICE_NAME,
    suite_ui: SITE_PPS,
    rails: {
      human: { stripe: true, ui: SITE_PPS },
      agent: { protocol: "x402", job: X402_SUITE_URL },
    },
    source: "local-fallback",
  };
}

/**
 * List all standing products available for agent x402 purchase.
 */
export async function x402Catalog() {
  try {
    const r = await fetch(X402_PRODUCTS_URL);
    if (r.ok) return { ...(await r.json()), source: "api" };
  } catch {
    /* fall through */
  }
  return {
    service: "Slid Phi Labs",
    buy_product: X402_PRODUCTS_URL,
    error: "catalog unreachable",
    source: "local-fallback",
  };
}

/**
 * Probe 402 requirements for a standing product SKU (no pay).
 */
export async function x402ProductRequirements(opts = {}) {
  const sku = opts.sku || opts.product || "cddg-split";
  const r = await fetch(X402_PRODUCTS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sku,
      email: opts.email || "",
      note: opts.note || "",
    }),
  });
  const data = await r.json().catch(() => ({}));
  return {
    service: SERVICE_NAME,
    rail: "x402",
    kind: "standing_product",
    status: r.status,
    payment_required: r.status === 402,
    endpoint: X402_PRODUCTS_URL,
    sku,
    requirements: data,
    how:
      r.status === 402
        ? "Retry POST with X-PAYMENT. Use x402-client payFetch against X402_PRODUCTS_URL."
        : data.message || data.error || "see body",
  };
}

/**
 * Buy standing product after payment (or dev bypass).
 */
export async function x402BuyProduct(opts = {}) {
  const headers = { "Content-Type": "application/json" };
  if (opts.paymentHeader || opts.xPayment) {
    headers["X-PAYMENT"] = opts.paymentHeader || opts.xPayment;
  }
  if (opts.devBypass || process.env.X402_DEV_BYPASS === "1") {
    headers["X-PAYMENT-DEV"] = "ok";
  }
  const r = await fetch(X402_PRODUCTS_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({
      sku: opts.sku || opts.product,
      email: opts.email || "",
      note: opts.note || "",
    }),
  });
  const data = await r.json().catch(() => ({}));
  if (r.status === 402) {
    const err = new Error("Payment required (x402 product)");
    err.status = 402;
    err.requirements = data;
    throw err;
  }
  if (!r.ok) {
    const err = new Error(data.error || data.detail || `x402 buy failed (${r.status})`);
    err.data = data;
    throw err;
  }
  return { ...data, service: SERVICE_NAME, rail: "x402" };
}

/**
 * Probe x402 requirements for a metered suite job (expects HTTP 402 body with accepts[]).
 * Does not pay — agents use x402-client payFetch to complete.
 */
export async function x402Requirements(opts = {}) {
  const body = {
    product: opts.product || "auto",
    dataClass: opts.dataClass || opts.data_class || "unknown",
    op: opts.op || "compress",
    bytes: opts.bytes || 0,
    email: opts.email || "",
    note: opts.note || "",
    fileName: opts.fileName || opts.file_name || "",
    tool: opts.tool || opts.product || "auto",
  };
  const r = await fetch(X402_SUITE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  return {
    service: SERVICE_NAME,
    rail: "x402",
    status: r.status,
    payment_required: r.status === 402,
    endpoint: X402_SUITE_URL,
    requirements: data,
    quote: data.quote || data.accepts?.[0]?.extra?.quote || null,
    how: r.status === 402
      ? "Retry POST with X-PAYMENT header (base64 payment proof). Use x402-client payFetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body })."
      : data.message || "Unexpected status",
  };
}

/**
 * Submit agent job with optional pre-built X-PAYMENT header, or X402_DEV_BYPASS.
 * For live pay+retry from Node, prefer: import { payFetch } from 'x402-client' against X402_SUITE_URL.
 */
export async function x402SubmitJob(opts = {}) {
  const headers = { "Content-Type": "application/json" };
  if (opts.paymentHeader || opts.xPayment) {
    headers["X-PAYMENT"] = opts.paymentHeader || opts.xPayment;
  }
  if (opts.devBypass || process.env.X402_DEV_BYPASS === "1") {
    headers["X-PAYMENT-DEV"] = "ok";
  }
  const r = await fetch(X402_SUITE_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({
      product: opts.product || opts.tool || "auto",
      dataClass: opts.dataClass || opts.data_class || "unknown",
      op: opts.op || "compress",
      bytes: opts.bytes || 0,
      email: opts.email || "",
      note: opts.note || "",
      fileName: opts.fileName || opts.file_name || "",
      tool: opts.tool || opts.product || "auto",
      sampleHint: opts.sampleHint || "",
    }),
  });
  const data = await r.json().catch(() => ({}));
  if (r.status === 402) {
    const err = new Error("Payment required (x402)");
    err.status = 402;
    err.requirements = data;
    throw err;
  }
  if (!r.ok) {
    const err = new Error(data.error || data.detail || `x402 job failed (${r.status})`);
    err.data = data;
    throw err;
  }
  return { ...data, service: SERVICE_NAME, rail: "x402" };
}

/**
 * Quote + classify from a file path (Node).
 */
export async function quoteFile(filePath, opts = {}) {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const st = await fs.stat(filePath);
  const sample = await fs.readFile(filePath);
  const head = sample.subarray(0, Math.min(sample.length, 8192));
  const cls = classifyBytes(head);
  const product = opts.product || (opts.autoTool === false ? "auto" : cls.tool) || "auto";
  const dataClass = opts.dataClass || cls.dataClass;
  const quote = computeQuote({
    product,
    dataClass,
    op: opts.op || "compress",
    bytes: st.size,
  });
  return {
    service: SERVICE_NAME,
    fileName: path.basename(filePath),
    bytes: st.size,
    classification: cls,
    quote,
    suite_url: SITE_PPS,
  };
}
