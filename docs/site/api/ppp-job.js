/**
 * PPP job intake — POST /api/ppp-job
 * SPL Pay Per Suite job intake — after payment, customer submits project metadata (+ optional small sample).
 * Logs to Notion Notes when NOTION_TOKEN is set. Does not run private engines.
 */
const DB = (
  process.env.NOTION_GROK_NOTES_DB ||
  process.env.NOTION_GROK_NOTES_PAGE_ID ||
  "d428f47a-3c51-49b1-914e-cbd7f90809b0"
).replace(
  /^([0-9a-f]{8})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{12})$/i,
  "$1-$2-$3-$4-$5"
);
const NOTION_VERSION = "2022-06-28";

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function clean(s, max = 2000) {
  return String(s || "")
    .trim()
    .slice(0, max);
}

function jobId() {
  return (
    "PPP-" +
    Date.now().toString(36).toUpperCase() +
    "-" +
    Math.random().toString(36).slice(2, 8).toUpperCase()
  );
}

async function notionCreate(title, note) {
  const token = process.env.NOTION_TOKEN;
  if (!token) return { ok: false, reason: "no_token" };
  const r = await fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      parent: { database_id: DB },
      properties: {
        Name: { title: [{ text: { content: title.slice(0, 200) } }] },
        Note: { rich_text: [{ text: { content: note.slice(0, 1900) } }] },
        Priority: { select: { name: "High" } },
        Status: { select: { name: "New" } },
      },
    }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = data?.message || data?.code || r.statusText;
    throw new Error(`Notion ${r.status}: ${msg}`);
  }
  return { ok: true, id: data.id };
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed" });
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return json(res, 400, { error: "Invalid JSON" });
    }
  }
  body = body || {};

  const email = clean(body.email, 120);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json(res, 400, { error: "Valid email required" });
  }

  const id = jobId();
  const product = clean(body.product || "auto", 40);
  const dataClass = clean(body.dataClass || body.data_class || "unknown", 40);
  const op = clean(body.op || "compress", 20);
  const bytes = Number(body.bytes) || 0;
  const amount = clean(body.amount_display || body.amount || "", 20);
  const tool = clean(body.tool || product, 40);
  const fileName = clean(body.fileName || body.file_name || "", 200);
  const paidConfirm = !!body.paidConfirm || !!body.paid;
  const note = clean(body.note, 800);
  const sampleHint = clean(body.sampleHint || body.sample_hint || "", 400);

  const title = `SPL-PPS ${id} · ${op} · ${tool}`;
  const detail = [
    `Service: SPL Pay Per Suite
Job: ${id}`,
    `Email: ${email}`,
    `Paid confirm: ${paidConfirm}`,
    `Amount quoted: $${amount}`,
    `Op: ${op}`,
    `Tool: ${tool}`,
    `Product: ${product}`,
    `Data class: ${dataClass}`,
    `Bytes: ${bytes}`,
    `File: ${fileName || "(none)"}`,
    `Sample: ${sampleHint || "(none)"}`,
    `Note: ${note || "(none)"}`,
    `Deliver: process offline with lab tools; reply with packed result / download.`,
  ].join("\n");

  let notion = { ok: false };
  try {
    notion = await notionCreate(title, detail);
  } catch (e) {
    notion = { ok: false, reason: String(e.message || e).slice(0, 200) };
  }

  return json(res, 200, {
    ok: true,
    job_id: id,
    message:
      "Project received. We run the best available lab tool for your data class and email results to you.",
    notion: notion.ok,
    next: "Watch your inbox (and spam). Large jobs may take up to one business day.",
  });
}
