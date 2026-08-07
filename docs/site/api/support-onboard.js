/**
 * POST /api/support-onboard
 * Called after $199 Support + Integration payment (or manual ops).
 * Body: { session_id?, email?, product? }
 * Writes Notion note + returns onboarding checklist.
 * Env: NOTION_TOKEN, optional RESEND/SMTP later.
 */
const DB = (
  process.env.NOTION_GROK_NOTES_DB ||
  process.env.NOTION_GROK_NOTES_PAGE_ID ||
  "d428f47a-3c51-49b1-914e-cbd7f90809b0"
).replace(
  /^([0-9a-f]{8})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{12})$/i,
  "$1-$2-$3-$4-$5"
);

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== "POST") return json(res, 405, { error: "POST only" });

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return json(res, 400, { error: "bad json" });
    }
  }
  body = body || {};
  const email = String(body.email || "").trim();
  const session = String(body.session_id || body.session || "").trim();
  const product = String(body.product || "support-integration").trim();

  const checklist = [
    "Confirm Stripe payment (session or receipt)",
    "Create Access note for product=" + product,
    "Email onboarding: install path + support contact corey@slidphilabs.com",
    "Schedule pathway bench call if needed",
  ];

  const onboarding_email = {
    to: email || "(collect at checkout)",
    subject: "Slid Phi Labs — Support + Integration onboarding",
    body: [
      "Thanks for purchasing Support + Integration ($199).",
      "",
      "Next steps:",
      "1. Open https://www.slidphilabs.com/access?product=support-integration" +
        (session ? "&session=" + session : ""),
      "2. Reply to this email with your primary codebase / data shape.",
      "3. We return pathway choice + bench notes (usually same day).",
      "",
      "— Slid Phi Labs",
    ].join("\n"),
  };

  let notion = { ok: false };
  const token = process.env.NOTION_TOKEN;
  if (token) {
    try {
      const r = await fetch("https://api.notion.com/v1/pages", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          parent: { database_id: DB },
          properties: {
            Name: {
              title: [
                {
                  text: {
                    content: `SUPPORT ONBOARD · ${product} · ${email || session || "pending"}`.slice(
                      0,
                      200
                    ),
                  },
                },
              ],
            },
            Note: {
              rich_text: [
                {
                  text: {
                    content: [
                      `product=${product}`,
                      `email=${email || "(none)"}`,
                      `session=${session || "(none)"}`,
                      "",
                      onboarding_email.body.slice(0, 1500),
                    ].join("\n").slice(0, 1900),
                  },
                },
              ],
            },
            Priority: { select: { name: "High" } },
            Status: { select: { name: "New" } },
          },
        }),
      });
      notion = { ok: r.ok, status: r.status };
    } catch (e) {
      notion = { ok: false, error: String(e.message || e) };
    }
  }

  return json(res, 200, {
    ok: true,
    product,
    checklist,
    onboarding_email,
    notion,
    access_url:
      "https://www.slidphilabs.com/access?product=" +
      encodeURIComponent(product) +
      (session ? "&session=" + encodeURIComponent(session) : ""),
    note: "Email send not yet wired — ops uses onboarding_email body or future Resend/SMTP.",
  });
}
