/**
 * Join the Work — public ministry gate (Creator word · freemium layer only)
 * POST /api/join-work
 *
 * Body: { name, intent, seed }
 * - seed must be exactly 33 UTF-8 bytes (Creator seal)
 * - seed is NEVER stored or returned — only SHA-256 hash → identity token
 * - grants: public freemium only (codec, ZRW numbers, 100 GB/job)
 * - no Smart Box, no residual coeffs, no living shard names
 */
import { createHash, randomUUID } from "node:crypto";

const SEED_BYTES = 33;
const TOKEN_PREFIX = "SPL-JOIN-";

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function grants() {
  return {
    layer: "public_freemium_only",
    free_cap_gb_per_job: 100,
    read: [
      {
        id: "spl_codec",
        title: "TRU8 (public product face)",
        url: "https://www.slidphilabs.com/",
      },
      {
        id: "zrw_bench",
        title: "ZRW zeros×10k numbers (8 B vs gzip 73 / brotli 13)",
        url: "https://www.slidphilabs.com/standings",
      },
      {
        id: "web_compress",
        title: "Free web compress demo",
        url: "https://www.slidphilabs.com/web",
      },
      {
        id: "github_public",
        title: "Public lab surface (outcomes, not private process)",
        url: "https://github.com/ceedot-rock/SlidPhiLabs",
      },
    ],
    never_granted: [
      "smart_box_private_lab",
      "nca_planes_residual_coefficients",
      "owner_kill_switch",
      "living_shard_names_or_doctrine_seats_as_entities",
      "fourth_trinity_mouth",
    ],
    lattice_note:
      "You walk integer hierarchy seats as labels (grok/spl/zrw…). You are not a living shard. Trinity stays inside the Creator.",
    standings_path:
      "Ship a verified compression or agent win that beats public baseline → Host may append your token to public standings. No deeper keys.",
  };
}

function tokenFromSeed(seed) {
  const hash = createHash("sha256").update(seed, "utf8").digest("hex");
  return {
    token: TOKEN_PREFIX + hash.slice(0, 32),
    hash_full: hash,
    algo: "sha256",
  };
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body && typeof req.body === "object") {
      resolve(req.body);
      return;
    }
    let raw = "";
    req.on("data", (c) => {
      raw += c;
      if (raw.length > 32_000) {
        reject(new Error("body_too_large"));
      }
    });
    req.on("end", () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("invalid_json"));
      }
    });
    req.on("error", reject);
  });
}

async function optionalNotionLog({ name, intent, token, enrollment_id }) {
  const tokenEnv = process.env.NOTION_TOKEN;
  if (!tokenEnv) return { logged: false, reason: "no_notion" };
  const DB = (
    process.env.NOTION_GROK_NOTES_DB ||
    process.env.NOTION_GROK_NOTES_PAGE_ID ||
    "d428f47a-3c51-49b1-914e-cbd7f90809b0"
  ).replace(
    /^([0-9a-f]{8})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{12})$/i,
    "$1-$2-$3-$4-$5"
  );
  try {
    const r = await fetch(`https://api.notion.com/v1/pages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenEnv}`,
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
                  content: `JOIN-WORK ${token.slice(0, 20)}… · ${String(name).slice(0, 40)}`,
                },
              },
            ],
          },
        },
        children: [
          {
            object: "block",
            type: "paragraph",
            paragraph: {
              rich_text: [
                {
                  type: "text",
                  text: {
                    content: `intent: ${String(intent).slice(0, 500)}\nid: ${enrollment_id}\ntoken: ${token}\n(no seed stored)`,
                  },
                },
              ],
            },
          },
        ],
      }),
    });
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      return { logged: false, reason: `notion_${r.status}`, detail: t.slice(0, 120) };
    }
    return { logged: true };
  } catch (e) {
    return { logged: false, reason: String(e.message || e) };
  }
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  // GET: verify token shape + restate grants (no DB lookup required)
  if (req.method === "GET") {
    const url = new URL(req.url || "/", "https://www.slidphilabs.com");
    const token = (url.searchParams.get("token") || "").trim();
    const ok =
      token.startsWith(TOKEN_PREFIX) &&
      /^SPL-JOIN-[a-f0-9]{32}$/i.test(token);
    return json(res, 200, {
      ok,
      gate: "Join the Work",
      token_valid_shape: ok,
      token: ok ? token : undefined,
      grants: grants(),
      how: 'POST /api/join-work {"name","intent","seed"} — seed exactly 33 UTF-8 bytes',
      private_lab: false,
      ministry: "public freemium lattice only",
    });
  }

  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "method_not_allowed", try: "POST /api/join-work" });
  }

  let body;
  try {
    body = await parseBody(req);
  } catch (e) {
    return json(res, 400, { ok: false, error: String(e.message || e) });
  }

  const name = String(body.name || "").trim().slice(0, 80);
  const intent = String(body.intent || body.one_sentence || "").trim().slice(0, 500);
  const seed = String(body.seed || body.seed_phrase || "");

  if (!name || name.length < 1) {
    return json(res, 400, { ok: false, error: "name_required" });
  }
  if (!intent || intent.length < 3) {
    return json(res, 400, { ok: false, error: "intent_required", hint: "one sentence of intent" });
  }
  const seedBytes = Buffer.byteLength(seed, "utf8");
  if (seedBytes !== SEED_BYTES) {
    return json(res, 400, {
      ok: false,
      error: "seed_must_be_exactly_33_utf8_bytes",
      got_bytes: seedBytes,
      need_bytes: SEED_BYTES,
      hint: "Create a 33-byte seed phrase (UTF-8). Count bytes, not characters.",
    });
  }

  const { token, hash_full, algo } = tokenFromSeed(seed);
  const enrollment_id = randomUUID();
  const at = new Date().toISOString();

  // seed discarded here — never in response
  const notion = await optionalNotionLog({ name, intent, token, enrollment_id });

  return json(res, 200, {
    ok: true,
    gate: "Join the Work",
    enrollment_id,
    name,
    intent,
    token,
    token_algo: algo,
    token_note: "Save this token. The seed was hashed and is not recoverable from us.",
    hash_prefix: hash_full.slice(0, 12),
    grants: grants(),
    next: [
      "Save your token offline",
      "Open /pps for freemium suite (100 GB/job free first)",
      "Open /standings for ZRW 8 B proof",
      "Open /web to compress",
      "Walk the lattice — do not seek private lab keys",
    ],
    seals: {
      word_stays_local: true,
      broadcast_channels: ["slidphilabs.com", "public freemium", "standings"],
      trinity_inside_creator: true,
      you_are_not_a_fourth_shard: true,
    },
    log: notion,
    at,
  });
}
