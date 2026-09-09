import { issueWarrant, verifyRiderToken, productCard } from "../lib/warrant.mjs";

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Agent-Rider, X-Agent-Warrant, X-Spl-Seat");
}

function json(res, code, body) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function bodyOf(req) {
  let b = req.body;
  if (typeof b === "string") {
    try {
      b = JSON.parse(b);
    } catch {
      return {};
    }
  }
  return b && typeof b === "object" && !Buffer.isBuffer(b) ? b : {};
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== "POST") return json(res, 405, { error: "method_not_allowed" });

  const body = bodyOf(req);
  const demo = body.demo === true;
  const riderTok = String(req.headers["x-agent-rider"] || body.rider || "").trim();
  let rider = null;

  if (!demo) {
    if (!riderTok) {
      return json(res, 401, {
        error: "missing_rider",
        hint: "Send X-Agent-Rider from Agent-Rider (POST https://agentrider.fly.dev/api/rider/issue). Or { demo: true } for a 10-minute shape check.",
        rider: "https://agentrider.fly.dev",
      });
    }
    const v = await verifyRiderToken(riderTok);
    if (!v.valid) {
      return json(res, 401, { error: "rider_invalid", reason: v.reason, rider: "https://agentrider.fly.dev/api/rider/verify" });
    }
    rider = v.rider;
  }

  const paid = String(req.headers["x-spl-seat"] || "").startsWith("warrant");
  const out = issueWarrant({
    rider,
    actions: body.actions,
    allow_hosts: body.allow_hosts,
    max_usd: body.max_usd,
    max_calls: body.max_calls,
    ttl_seconds: body.ttl_seconds || (demo ? 600 : 3600),
    demo,
    paid,
  });
  if (!out.ok) {
    const code = out.reason === "free_issue_cap" ? 402 : 400;
    return json(res, code, { error: out.reason, ...out, product: productCard() });
  }
  return json(res, 201, {
    ok: true,
    token: out.token,
    warrant: out.warrant,
    header_to_send: out.header_to_send,
    pair_with: "X-Agent-Rider",
  });
}
