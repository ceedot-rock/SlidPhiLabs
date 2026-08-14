/**
 * Try Gate v1 — POST /api/try-submit
 * Validates form, logs to Notion, issues ZRW Free Gate key (cap 25).
 * Env: NOTION_TOKEN, optional NOTION_GROK_NOTES_DB (default Notes for Grok id)
 */
import { randomBytes } from "node:crypto";

const FREE_CAP = 25;
/** Notes for Grok database (dashed UUID). */
const DB = (
  process.env.NOTION_GROK_NOTES_DB ||
  process.env.NOTION_GROK_NOTES_PAGE_ID ||
  "d428f47a-3c51-49b1-914e-cbd7f90809b0"
).replace(
  /^([0-9a-f]{8})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{12})$/i,
  "$1-$2-$3-$4-$5"
);
/** Offline keys already issued (e.g. Bob Free Gate) before Try Gate logging. */
const FREE_KEYS_FLOOR = Number(process.env.FREE_KEYS_FLOOR || "1");
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

async function notion(method, path, body) {
  const token = process.env.NOTION_TOKEN;
  if (!token) throw new Error("NOTION_TOKEN not configured");
  const r = await fetch(`https://api.notion.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = data?.message || data?.code || r.statusText;
    throw new Error(`Notion ${r.status}: ${msg}`);
  }
  return data;
}

function plainTitle(props) {
  const name = props?.Name || props?.title;
  if (!name?.title) return "";
  return name.title.map((t) => t.plain_text || "").join("");
}

async function countIssued() {
  // Query recent notes; count titles starting with ZRW-FREE-ISSUED
  let count = 0;
  let cursor;
  for (let i = 0; i < 5; i++) {
    const body = {
      page_size: 100,
      sorts: [{ timestamp: "created_time", direction: "descending" }],
    };
    if (cursor) body.start_cursor = cursor;
    const data = await notion("POST", `/databases/${DB}/query`, body);
    for (const page of data.results || []) {
      const t = plainTitle(page.properties);
      if (t.startsWith("ZRW-FREE-ISSUED")) count += 1;
    }
    if (!data.has_more) break;
    cursor = data.next_cursor;
  }
  return Math.max(count, FREE_KEYS_FLOOR);
}

function validUrl(u) {
  try {
    const x = new URL(u);
    return x.protocol === "http:" || x.protocol === "https:";
  } catch {
    return false;
  }
}

function looksPublicReview(url) {
  if (!validUrl(url)) return false;
  // Basic reject of common private-looking schemes
  const lower = url.toLowerCase();
  if (lower.includes("localhost") || lower.includes("127.0.0.1")) return false;
  return true;
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== "POST") {
    return json(res, 405, { error: "POST only" });
  }

  try {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks).toString("utf8") || "{}";
    const body = JSON.parse(raw);

    const name = String(body.name || "").trim().slice(0, 80);
    const email = String(body.email || "").trim().slice(0, 120);
    const path = String(body.path || "").trim();
    const reviewUrl = String(body.reviewUrl || "").trim().slice(0, 500);
    const note = String(body.note || "").trim().slice(0, 500);
    const paidConfirm = Boolean(body.paidConfirm);

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json(res, 400, { error: "Valid email required." });
    }
    if (path !== "review" && path !== "donate") {
      return json(res, 400, { error: "Choose review or donate." });
    }
    if (path === "review") {
      if (!looksPublicReview(reviewUrl)) {
        return json(res, 400, {
          error:
            "We couldn’t verify that submission (private post, missing link-back, or invalid URL). Reply with a public URL.",
        });
      }
    }
    if (path === "donate" && !paidConfirm) {
      return json(res, 400, {
        error: "Confirm you completed Stripe checkout with this email.",
      });
    }

    const issuedCount = await countIssued();
    if (issuedCount >= FREE_CAP) {
      return json(res, 403, {
        error:
          "Free Gate is full (25/25). Please buy N00b or higher — see https://www.slidphilabs.com/#pricing — or open SPL Pay Per Suite at /pps.",
      });
    }

    const id = randomBytes(4).toString("hex").toUpperCase();
    const key = `ZRW-FREE-${id}`;
    const slot = issuedCount + 1;
    const remaining = FREE_CAP - slot;

    const summary = [
      `path=${path}`,
      `email=${email}`,
      name ? `name=${name}` : "",
      path === "review" ? `reviewUrl=${reviewUrl}` : "donate=confirmed",
      note ? `note=${note}` : "",
      `key=${key}`,
      `slot=${slot}/${FREE_CAP}`,
      `at=${new Date().toISOString()}`,
    ]
      .filter(Boolean)
      .join("\n");

    // Log submission + issued key (public board — no secrets beyond free key which is user-facing)
    await notion("POST", "/pages", {
      parent: { database_id: DB },
      properties: {
        Name: {
          title: [
            {
              text: {
                content: `TRY GATE · ${path} · ${email.slice(0, 40)}`.slice(
                  0,
                  100
                ),
              },
            },
          ],
        },
        Status: { select: { name: "Discussed" } },
        Priority: { select: { name: "Normal" } },
        Note: { rich_text: [{ text: { content: summary.slice(0, 1900) } }] },
      },
    });

    await notion("POST", "/pages", {
      parent: { database_id: DB },
      properties: {
        Name: {
          title: [
            {
              text: {
                content: `ZRW-FREE-ISSUED ${key} · slot ${slot}`.slice(0, 100),
              },
            },
          ],
        },
        Status: { select: { name: "Discussed" } },
        Priority: { select: { name: "Normal" } },
        Note: {
          rich_text: [
            {
              text: {
                content: `Issued via Try Gate\n${summary}`.slice(0, 1900),
              },
            },
          ],
        },
      },
    });

    return json(res, 200, {
      ok: true,
      key,
      slot,
      remaining,
      cap: FREE_CAP,
      limits:
        "100k ops/mo, 10k ints/call, no livestream, non-commercial evaluation",
      products: {
        cuni: "https://cuni-studio.fly.dev/",
        site: "https://www.slidphilabs.com",
        npm: "zero-range-wave-compression",
      },
    });
  } catch (e) {
    console.error("try-submit", e);
    return json(res, 500, {
      error: "Server error issuing pass. Email corey@slidphilabs.com with subject ZRW FREE.",
    });
  }
}
