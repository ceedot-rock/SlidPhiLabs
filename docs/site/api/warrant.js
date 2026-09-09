/**
 * GET  /api/warrant           discovery
 * GET  /api/warrant?id=wrt_   public warrant
 * GET  /api/warrant?receipt=rcp_
 */
import { productCard, getWarrant, getReceipt, listReceipts } from "./lib/warrant.mjs";

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Agent-Rider, X-Agent-Warrant");
}

export default function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ error: "method_not_allowed" }));
  }
  const q = req.query || {};
  const id = String(q.id || "").trim();
  const receipt = String(q.receipt || "").trim();
  const receipts = String(q.receipts || "").trim();
  let body;
  if (receipt) body = getReceipt(receipt);
  else if (receipts) body = listReceipts(receipts);
  else if (id) body = getWarrant(id);
  else {
    body = {
      ok: true,
      product: productCard(),
      pair: {
        rider: "X-Agent-Rider — who acted (Agent-Rider)",
        warrant: "X-Agent-Warrant — what they may do, then a receipt",
      },
      endpoints: {
        issue: "POST /api/warrant/issue",
        verify: "POST /api/warrant/verify",
        receipt: "POST /api/warrant/receipt",
        revoke: "POST /api/warrant/revoke",
      },
    };
  }
  res.statusCode = body.ok === false ? 404 : 200;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}
