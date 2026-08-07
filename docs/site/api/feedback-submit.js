/**
 * Feedback hub — POST /api/feedback-submit
 * kinds: partner | loi | investor | comment | suggestion | donate-note
 * Logs to Notion Notes for Grok when NOTION_TOKEN is set; always accepts payload.
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
const ALLOWED = new Set(["partner", "loi", "investor", "comment", "suggestion", "donate-note"]);

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
        Priority: { select: { name: "Normal" } },
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

  const kind = clean(body.kind, 40).toLowerCase();
  if (!ALLOWED.has(kind)) {
    return json(res, 400, { error: "Unknown kind" });
  }

  const name = clean(body.name, 120);
  const email = clean(body.email, 160);
  const org = clean(body.org, 160);
  const message = clean(body.message, 4000);
  const amount = clean(body.amount, 40);
  const website = clean(body.website, 200);

  if (!message || message.length < 5) {
    return json(res, 400, { error: "Please write a short message (at least a few words)." });
  }
  if ((kind === "partner" || kind === "loi" || kind === "investor") && !email) {
    return json(res, 400, { error: "Email is required for this form." });
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json(res, 400, { error: "That email does not look valid." });
  }

  const labels = {
    partner: "PARTNER",
    loi: "LOI",
    investor: "INVESTOR",
    comment: "COMMENT",
    suggestion: "SUGGESTION",
    "donate-note": "DONATE-NOTE",
  };
  const title = `SITE ${labels[kind]} — ${name || email || "anon"} — ${new Date().toISOString().slice(0, 10)}`;
  const note = [
    `kind: ${kind}`,
    name && `name: ${name}`,
    email && `email: ${email}`,
    org && `org: ${org}`,
    website && `website: ${website}`,
    amount && `amount_interest: ${amount}`,
    "",
    message,
  ]
    .filter((x) => x !== false && x !== "")
    .join("\n");

  let notion = { ok: false };
  try {
    notion = await notionCreate(title, note);
  } catch (e) {
    // Still accept — lab can recover from logs if Notion fails
    notion = { ok: false, reason: String(e.message || e) };
  }

  return json(res, 200, {
    ok: true,
    kind,
    logged: !!notion.ok,
    message:
      kind === "loi"
        ? "Thanks — we received your LOI interest and will follow up by email."
        : kind === "partner"
          ? "Thanks — partner note received. We will review and reply."
          : kind === "investor"
            ? "Thanks — investor note received. We will follow up if there is a fit."
            : "Thanks — your note is in. We read every one.",
  });
}
