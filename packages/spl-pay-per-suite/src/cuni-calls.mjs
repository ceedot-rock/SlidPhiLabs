/**
 * Nine CuNi calls. Same names on the CLI, POST /v1, MCP, and the Python SDK.
 * The lab bills these. The AGPL binary does not.
 */
const STORE = () =>
  (process.env.LAB_AGENT_URL || "https://spl-lab-agent.fly.dev").replace(/\/$/, "");

export const CUNI_VERBS = [
  "check",
  "translate",
  "ingest",
  "audit",
  "money",
  "time",
  "chain",
  "ship",
  "parity",
];

const ALIAS = {
  cuni_bank: "translate",
  bank_paste: "translate",
  cuni_check: "check",
};

const BLURB = {
  check:
    "CuNi check. Exact stdout or refuse. POST /v1/check. SKU lab-check $0.05, first 100 a month free. Pass payment or the lab returns 402.",
  translate:
    "CuNi translate. Paste N, get X, or refuse. POST /v1/translate. SKU lab-translate $0.10. Pass payment or the lab returns 402.",
  ingest:
    "CuNi ingest. Foreign source to .cuni, or refuse. POST /v1/ingest. SKU lab-ingest $0.10. Pass payment or the lab returns 402.",
  audit:
    "CuNi audit. A money law against a foreign implementation. POST /v1/audit. SKU lab-audit $1.00. Pass payment or the lab returns 402.",
  money:
    "CuNi money. Decimal seats py, rs, go, java, sql. POST /v1/money. SKU lab-money $0.25. Pass payment or the lab returns 402.",
  time:
    "CuNi time. Time law. POST /v1/time. SKU lab-time $0.25. Pass payment or the lab returns 402.",
  chain:
    "CuNi chain. Solidity, Solana, ink!, Move, Vyper, Cairo, Clarity, Cadence, then the Python seat. POST /v1/chain. SKU lab-chain $0.50. Pass payment or the lab returns 402.",
  ship:
    "CuNi ship. Firmware gate on C and Rust, or nothing ships. POST /v1/ship. SKU lab-ship $0.50. Pass payment or the lab returns 402.",
  parity:
    "CuNi parity. One kernel across py, rs, c, go, sql. POST /v1/parity. SKU lab-parity $0.25. Pass payment or the lab returns 402.",
};

function schema(extra, required) {
  return {
    type: "object",
    properties: {
      source: { type: "string", description: "Program text. CuNi source, except ingest which takes the foreign source." },
      payment: { type: "string", description: "x402 payment header (X-PAYMENT). Omit it and the lab answers 402." },
      ...extra,
    },
    required,
  };
}

const EXTRA = {
  translate: {
    props: {
      from: { type: "string", description: "py or cuni. Default py." },
      to: { type: "string", description: "Catalog id. Default js." },
    },
    required: ["source"],
  },
  ingest: {
    props: {
      from: { type: "string", description: "py, go, js, ts, c, cpp, rs, awk, pl, sh, sql, wat. Default py." },
    },
    required: ["source"],
  },
  audit: {
    props: {
      against: { type: "string", description: "Foreign implementation source." },
      against_ext: { type: "string", description: "py, js, mjs, go, rs, java, sql. Default py." },
    },
    required: ["source", "against"],
  },
  chain: {
    props: {
      to: { type: "string", description: "Comma list: sol,solana,ink,move,vyper,cairo,clarity,cadence. Default all." },
    },
    required: ["source"],
  },
};

export const CUNI_TOOLS = CUNI_VERBS.map((name) => {
  const extra = EXTRA[name] || { props: {}, required: ["source"] };
  return {
    name,
    description: BLURB[name],
    inputSchema: schema(extra.props, extra.required),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  };
});

export function cuniVerb(name) {
  if (CUNI_VERBS.includes(name)) return name;
  return ALIAS[name] || null;
}

export async function dispatchCuni(name, args = {}) {
  const verb = cuniVerb(name);
  if (!verb) return null;
  const body = { source: String(args.source || "") };
  if (verb === "translate") {
    body.from = String(args.from || "py");
    body.to = String(args.to || "js");
  } else if (verb === "ingest") {
    body.from = String(args.from || "py");
  } else if (verb === "audit") {
    body.against = String(args.against || "");
    body.against_ext = String(args.against_ext || args.ext || "py");
  } else if (verb === "chain" && args.to) {
    body.to = String(args.to);
  }
  const headers = { "content-type": "application/json" };
  const payment = String(args.payment || args.paymentHeader || "");
  if (payment) {
    headers["X-PAYMENT"] = payment;
    headers["payment-signature"] = payment;
  }
  const store = STORE();
  const r = await fetch(`${store}/v1/${verb}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(90000),
  });
  const j = await r.json().catch(() => ({ ok: false, refuse: `http ${r.status}` }));
  return {
    status: r.status,
    verb,
    sku: `lab-${verb}`,
    store,
    ...(j && typeof j === "object" ? j : { raw: j }),
  };
}
