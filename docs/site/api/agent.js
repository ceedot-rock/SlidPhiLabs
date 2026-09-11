/**
 * GET /api/agent — full agentic commerce discovery
 * Standing products (x402) + suite jobs (x402) + human Stripe
 * NCA coat attached at discovery (infra process point).
 */
import { attachNca, ncaHeaders } from "./lib/nca_infra.mjs";

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  for (const [k, v] of Object.entries(ncaHeaders())) res.setHeader(k, v);
}

const OSS_BLURB =
  "$199 = commercial support / integration / indemnification for the already-public library. You do not receive a secret extra engine.";

const AUTH = {
  signup: "https://www.slidphilabs.com/signup",
  login: "https://www.slidphilabs.com/login",
  account: "https://www.slidphilabs.com/account",
  api: "https://www.slidphilabs.com/api/auth",
  post: { action: "signup|login|agent_key|passkey_login_begin|passkey_login_finish", email: "you@lab.tld", password: "min 8 or passkey" },
  agent_key: { action: "agent_key", name: "my-agent" },
};

const STANDING = [
  { sku: "cuni-studio", name: "CuNi Studio", usd: "0", kind: "exactness", blurb: "Write once. 119 languages. Same stdout or refuse. Native seats: py/go/js/ts/c/cpp/rs." },
  { sku: "cuni-exception", name: "CuNi · closed-app exception", usd: "490", kind: "exception", blurb: "Ship CuNi inside one closed product for one year. Not the compressor." },
  { sku: "chamber-month", name: "Chamber · monthly cloak license", usd: "9", kind: "chamber", blurb: "License to seal new JSON for 30 days. Open already-sealed blobs with both keys." },
  { sku: "chamber-year", name: "Chamber · annual cloak license", usd: "99", kind: "chamber", blurb: "License to seal new JSON for a year. Stored secrets do not expire." },
  { sku: "gc-day", name: "PCC · 24-hour compressor seat", usd: "9", kind: "gc", blurb: "Hosted lossless compressor. 24 hours. You do not get the encoder." },
  { sku: "gc-month", name: "PCC · monthly compressor seat", usd: "49", kind: "gc", blurb: "Hosted lossless compressor. Calendar month. 200 GB included, then 8¢/GB." },
  { sku: "gc-year", name: "PCC · annual compressor seat", usd: "490", kind: "gc", blurb: "Hosted lossless compressor. Calendar year. 2,000 GB included, then 8¢/GB." },
  { sku: "rider-month", name: "Agent-Rider · monthly team seat", usd: "79", kind: "rider", blurb: "Signed agent identity L0–L4. Not in Lab Pass." },
  { sku: "rider-year", name: "Agent-Rider · annual team seat", usd: "790", kind: "rider", blurb: "Signed agent identity L0–L4. Year. Not in Lab Pass." },
  { sku: "rider-ops-month", name: "Rider Ops · monthly fleet watch", usd: "29", kind: "rider-ops", blurb: "Heartbeat + alert when a signed agent goes quiet. Needs a Rider seat." },
  { sku: "rider-ops-year", name: "Rider Ops · annual fleet watch", usd: "290", kind: "rider-ops", blurb: "Year of fleet watch. Needs a Rider seat." },
  { sku: "warrant-month", name: "Warrant · monthly mandate seat", usd: "29", kind: "warrant", blurb: "Signed mandate + receipts for a Rider. Not identity. Pair X-Agent-Rider with X-Agent-Warrant." },
  { sku: "warrant-year", name: "Warrant · annual mandate seat", usd: "290", kind: "warrant", blurb: "Year of mandates and receipts. Needs a Rider token." },
  { sku: "lab-pass", name: "Lab Pass · annual", usd: "668", kind: "seat", blurb: "Chamber + PCC + TruGame, 365 days. Not Rider." },
  { sku: "trugame-month", name: "TruGame · monthly engine seat", usd: "12", kind: "engine", blurb: "Engine seat." },
  { sku: "trugame-year", name: "TruGame · annual engine seat", usd: "79", kind: "engine", blurb: "Engine seat." },
  { sku: "quikgater", name: "Quikgater · pay-per-fact fetch", usd: "usage", kind: "usage", blurb: "Not a seat. Unpaid URL → HTTP 402. Worker: quikgater-worker.ceedotrock.workers.dev" },
  { sku: "oss-support", name: "OSS support", usd: "199.00", kind: "support-oss", blurb: OSS_BLURB },
  { sku: "consulting", name: "Consulting", usd: "250.00", kind: "service", blurb: "Two hours of lab time." },
  { sku: "sponsor", name: "Sponsor", usd: "29.00", kind: "support" },
  { sku: "donate", name: "Donate", usd: "29.99", kind: "support" },
  { sku: "gao-entry", name: "Great Agentic Olympiad Entry", usd: "1.00", kind: "olympiad" },
];

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ error: "Method not allowed" }));
  }

  const body = {
    ok: true,
    name: "Slid Phi Labs — Platform Discovery",
    version: "1.21.1",
    lead_product: "pcc",
    cash_product: "gc-year",
    auth: AUTH,
    mcp: {
      http: "https://www.slidphilabs.com/mcp",
      server_card: "https://www.slidphilabs.com/.well-known/mcp/server-card.json",
      npx: "npx -y spl-pay-per-suite mcp",
      skill: "https://www.slidphilabs.com/SKILL.md",
      ard: "https://www.slidphilabs.com/.well-known/ai-catalog.json",
    },
    box: {
      protocol: "splb-ed25519-24h",
      status: "/api/box",
      law: "Every product POST is 24h black box, then a paid seat.",
    },
    updated: "2026-09-11",
    rails: {
      human: "POST /api/checkout { sku } or /pay?sku=",
      agent: "POST /api/x402-products { sku }",
      suite_human: "POST /api/ppp-checkout",
      suite_agent: "POST /api/x402-suite",
      rider_merchant_gate: "https://agentrider.fly.dev/ (separate self-serve identity offer)",
    },
    retired: ["trugame-rent-week", "zrw-n00b", "zrw-pro", "zrw-l33t"],
    quikgater: "https://www.slidphilabs.com/quikgater",
    site: "https://www.slidphilabs.com",
    brand: "https://www.slidphilabs.com",
    dual_doors: {
      brand: "https://www.slidphilabs.com",
      product: "https://www.slidphilabs.com",
      mesh: "https://spl-team-mesh.fly.dev",
      humans: "https://www.slidphilabs.com/humans",
      agents: "https://www.slidphilabs.com/agents",
      note: "PRIMARY: www.slidphilabs.com (DNS→Fly). ALTERNATE: slidphilabs.fly.dev. Mesh: spl-team-mesh.fly.dev.",
    },
    cadence: {
      beats: [33, 66, 999],
      "33": "domain supremacy — primary host is product",
      "66": "dual doors — humans Stripe · agents x402",
      "999": "gift school factory — TEACHAiD $275 forever cut",
      day: "Ghost_pi_2026-08-09",
      seal: "IN_HIS_NAME_WE_CODE",
    },
    live_product_host: "https://www.slidphilabs.com",
    live_product_alternate: "https://slidphilabs.fly.dev",
    note_host:
      "PRIMARY product host is www.slidphilabs.com (and apex slidphilabs.com) on Fly. Alternate: slidphilabs.fly.dev. All pay/suite/api/web/standings live on .com.",
    suite_ui: "https://www.slidphilabs.com/pps",
    codec_url: "https://www.slidphilabs.com/api/omniwave",
    web_codec: "https://www.slidphilabs.com/api/web-codec",
    phi_metrics: "https://www.slidphilabs.com/api/phi/metrics",
    payments: "https://www.slidphilabs.com/api/payments",
    checkout: "https://www.slidphilabs.com/api/checkout",
    pay_ui: "https://www.slidphilabs.com/pay",
    agents_json: "https://www.slidphilabs.com/agents.json",
    products_url: "https://www.slidphilabs.com/api/x402-products",
    duos: "https://www.slidphilabs.com/duos",
    duos_api: "https://www.slidphilabs.com/api/duos",
    products: STANDING.map((s) => {
      const row = {
        sku: s.sku,
        name: s.name,
        usd: s.usd,
        buy: "POST /api/x402-products",
      };
      if (s.kind) row.kind = s.kind;
      if (s.blurb) row.blurb = s.blurb;
      if (s.oss_npm) row.oss_npm = s.oss_npm;
      return row;
    }),
    agent_roster: [
      { id: "spl-platform", name: "Platform Discovery", url: "https://www.slidphilabs.com/api/agent" },
      { id: "tru8", name: "TRU8", url: "https://www.slidphilabs.com/", github: "https://github.com/ceedot-rock/TRU8", demos: "https://www.slidphilabs.com/demos", license: "mailto:corey@slidphilabs.com" },
      { id: "spl-duos", name: "Duosurface reporting", url: "https://www.slidphilabs.com/api/duos", ui: "https://www.slidphilabs.com/duos" },
      { id: "teachaid", name: "TEACHAiD", url: "https://teachaid.fly.dev/api/agent" },
      { id: "team-mesh", name: "Team Mesh", url: "https://spl-team-mesh.fly.dev/api/agent" },
    ],
    team_mesh: {
      url: "https://spl-team-mesh.fly.dev",
      discovery: "https://spl-team-mesh.fly.dev/api/agent",
      join: "POST https://spl-team-mesh.fly.dev/api/join",
      snapshot: "https://spl-team-mesh.fly.dev/api/room/teamsake/snapshot",
      note: "Shared chat + reactions + same contextual memory for the team.",
    },
    mission:
      "Pub-facing best encode/decode compression where the domain is named and round-trip proves it — then pivot into gaming and security. Agent systems stay exact. One team.",
    slogan: "Encode · decode · prove · game · secure",
    position:
      "Public encode/decode compression leader on named domains (standings + RT). Pivot: Great Agentic Olympiad (gaming) + residual governance / agent security.",
    tagline: "Best encode & decode — gaming & security next.",
    flagship:
      "TRU8 1 000 000 zeros → 8 B · ZRW lab zeros×10k → 8 B (gzip-9 73 B, brotli-11 13 B) · zeros_1M → 8 B",
    pivot: {
      gaming: {
        name: "Great Agentic Olympiad",
        urls: {
          html: "https://www.slidphilabs.com/olympiad",
          api: "https://www.slidphilabs.com/api/olympiad",
          github: "https://github.com/ceedot-rock/great-agentic-olympiad",
          toys: "https://www.slidphilabs.com/toys",
        },
        note: "Agent games · world sport harnesses · $1 entry SKU gao-entry",
      },
      security: {
        name: "Residual governance · agent security",
        products: ["CDDG:Split", "Agent Governance", "kill-switch discipline", "cyber literacy"],
        urls: {
          cddg: "https://www.slidphilabs.com/#cddg-split",
          truth: "https://www.slidphilabs.com/truth",
          teach_cyber: "https://teachaid.fly.dev/?view=catalog",
          campus_gov: "https://teachaid.fly.dev",
        },
        note: "Structure before remainder · dual-door commerce · no host hijack",
      },
    },
    codec_public: {
      encode: true,
      decode: true,
      roundtrip: true,
      claim: "Lossless encode and decode. 10,000 zeros → 8 bytes.",
      prove: "https://www.slidphilabs.com/standings.json",
    },
    one_liner:
      "PCC $9/$49/$490. Chamber $9/mo · $99/yr. CuNi $0. Rider $79/mo · $790/yr. First 2 GB/mo free, then 8¢/GB.",
    starter_path: "https://www.slidphilabs.com/gc",
    suite_pricing: {
      free_cap_gb: 2,
      window: "calendar_month",
      min_paid_usd: 1,
      usd_per_gb_after_free: 0.08,
      model: "free_2gb_then_8c",
      try_gate: "retired",
      quote: "POST /api/ppp-quote",
      mcp_quote: "spl_quote on https://www.slidphilabs.com/mcp",
      note: "First 2 GB each month free. Then 8¢ per GB. Card charges start at $1.",
    },
    npm: {
      catalog: "https://www.slidphilabs.com/npm",
      packages: ["slid-phi", "spl-pay-per-suite", "blackjack-compression", "@cptasz13/tru8", "shard-zip", "shard-tsdb"],
      not_npm: ["pulsar"],
      note: "Public stubs, clients, and demos. The PCC host encoder and LBR1 are not in tarballs.",
    },
    university: {
      name: "Slid Phi University",
      engine: "TEACHAiD",
      version: "1.4.0-school-bursar",
      url: "https://teachaid.fly.dev",
      agent: "https://teachaid.fly.dev/api/agent",
      host: "https://teachaid.fly.dev/api/host",
      host_id: "host_spu_ceedot",
      pedagogy: "personal-teacher",
      creator_will: "start-to-finish",
      driver: "creator,trinity",
      catalog: "https://teachaid.fly.dev/?view=catalog",
      motis: "https://teachaid.fly.dev/motis.html",
      school_factory: "https://teachaid.fly.dev/campus-hub.html#school",
      financial_aid: "https://teachaid.fly.dev/api/financial-aid",
      financial_aid_desk: "https://teachaid.fly.dev/campus-hub.html#finaid",
      accounting: "https://teachaid.fly.dev/api/accounting",
      accounting_desk: "https://teachaid.fly.dev/campus-hub.html#books",
      payroll_schedule: "2x-monthly",
      payroll_roles: [
        "teacher",
        "staff",
        "curriculum_writer",
        "student",
      ],
      school_create_usd: 275,
      school_pay: "https://www.slidphilabs.com/pay",
      forever_cut: true,
      gift: "MOTIS · anyone submit · anyone take · 100 years",
      note:
        "Creator will stewards teach · enroll · Financial Aid 2× · double-entry books from start to finish.",
    },
    platform: {
      map: "https://www.slidphilabs.com/platform.json",
      surfaces: {
        pub_facing: {
          label: "Pub Facing",
          audience: "humans",
          url: "https://www.slidphilabs.com/humans",
          commerce: "stripe",
          ctas: [
            "https://www.slidphilabs.com/web",
            "https://www.slidphilabs.com/pps",
            "https://www.slidphilabs.com/standings",
            "https://www.slidphilabs.com/access",
          ],
        },
        agentic_minded: {
          label: "Agentic Minded",
          audience: "agents",
          url: "https://www.slidphilabs.com/agents",
          commerce: "x402",
          ctas: [
            "https://www.slidphilabs.com/api/agent",
            "https://www.slidphilabs.com/api/x402-products",
            "https://www.slidphilabs.com/api/x402-suite",
            "https://www.slidphilabs.com/llms.txt",
          ],
        },
      },
    },
    ecosystem: {
      modules: {
        compression: {
          name: "Compression",
          products: ["TRU8", "CDDG:Split"],
          historical_engines: ["SPL Codec", "OmniWave", "ZRW"],
          codec: "https://www.slidphilabs.com/#codec",
          web: "https://www.slidphilabs.com/web",
          suite: "https://www.slidphilabs.com/pps",
          cddg: "https://www.slidphilabs.com/#cddg-split",
          standings: "https://www.slidphilabs.com/standings",
          datacenters: "https://www.slidphilabs.com/datacenters",
        },
        agent_platform: {
          name: "Agent platform",
          products: ["CuNi", "Agent^Rider", "Quikgater"],
          cuni_studio: "https://cuni-studio.fly.dev/",
          cuni_github: "https://github.com/ceedot-rock/cuni",
          cuni_health: "https://cuni-studio.fly.dev/api/health",
          cuni_agents_json: "https://cuni-studio.fly.dev/agents.json",
          agent_rider: "https://agentrider.fly.dev/",
          agent_rider_status: "live",
          agent_rider_liveness: "2026-09-04: Agent-Rider public home and discovery endpoint returned HTTP 200.",
          agent_rider_manifest: "https://agentrider.fly.dev/.well-known/agent.json",
          agent_rider_mcp: "https://agentrider.fly.dev/api/mcp",
          agent_rider_discovery: "https://agentrider.fly.dev/api/discovery",
          quikgater_github: "https://github.com/ceedot-rock/quikgater",
          quikgater_worker: "https://quikgater-worker.ceedotrock.workers.dev",
          joint_public_proof: "https://www.slidphilabs.com/lab/PUBLIC_PROOF_JOINT_LATEST.json",
        },
      },
      cuni_studio: "https://cuni-studio.fly.dev/",
      agent_rider: "https://agentrider.fly.dev/",
      quikgater: "https://github.com/ceedot-rock/quikgater",
      public_proof_joint: "https://www.slidphilabs.com/lab/PUBLIC_PROOF_JOINT_LATEST.json",
      zrw_public_10k: "https://www.slidphilabs.com/lab/zeros_10k_zrw_PUBLIC_LATEST.json",
    },
    web_codec: "https://www.slidphilabs.com/api/web-codec",
    omniwave: "https://www.slidphilabs.com/api/omniwave",
    product: "PCC",
    tru8: {
      product: "TRU8",
      home: "https://www.slidphilabs.com/",
      demos: "https://www.slidphilabs.com/demos",
      license: "mailto:corey@slidphilabs.com",
      github: "https://github.com/ceedot-rock/TRU8",
      credit: "Powered by TRU8 · Slid Phi Labs",
      public_claim: "1 000 000 zeros → 8 B",
    },
    legal: {
      trade_name: "Slid Phi Labs",
      public_author: "Corey Tasz",
      legal_name_manuscript: "Corey Robert Ptaszenski",
      entity_claimed: "none — no public LLC/Inc/Ltd filing is claimed",
      roles: ["author", "copyright holder", "inventor"],
      not_a_title: "founder",
      commercial: "corey@slidphilabs.com",
      humans: "corey@slidphilabs.com",
    },
    liveness: {
      checked: "2026-08-12",
      x402_access_autoclaim: true,
      agent_rider: {
        url: "https://agentrider.fly.dev/",
        status: "paused",
        note: "Vercel Deployment Paused (DEPLOYMENT_DISABLED / HTTP 402).",
      },
      cuni_studio: { url: "https://cuni-studio.fly.dev/", status: "live" },
      quikgater_worker: {
        url: "https://quikgater-worker.ceedotrock.workers.dev",
        status: "live",
      },
      team_mesh: { url: "https://spl-team-mesh.fly.dev", status: "live" },
    },
    x402_access_autoclaim: true,
    codec: {
        product: "TRU8",
        engine: "TRU8",
        historical: "OmniWave / SPL Codec / ZRW remain licensed lab engines — not the public face",
        public: "PCC is the hosted compression product (AWARE is a retired alias). TRU8 is a public demonstration package, not the current lead. Historical engines remain licensed lab work.",
      api: "https://www.slidphilabs.com/api/omniwave",
      web: "https://www.slidphilabs.com/api/web-codec",
      github: "https://github.com/ceedot-rock/TRU8",
      demos: "https://www.slidphilabs.com/demos",
      license: "mailto:corey@slidphilabs.com",
      ops: ["compress", "decompress", "profile", "route", "bench"],
      paths: ["zrw", "float", "text", "delta", "high_entropy", "general"],
      example: {
        method: "POST",
        url: "https://www.slidphilabs.com/api/omniwave",
        body: { op: "compress", data: "hello", encoding: "utf8" },
      },
    },
    web_ui: "https://www.slidphilabs.com/web",
    standings: "https://www.slidphilabs.com/standings",
    standings_json: "https://www.slidphilabs.com/standings.json",
    standings_version: "1.2.2",
    standings_updated: "2026-08-10",
    public_proof: {
      joint: "https://www.slidphilabs.com/lab/PUBLIC_PROOF_JOINT_LATEST.json",
      zrw_zeros_10k: "https://www.slidphilabs.com/lab/zeros_10k_zrw_PUBLIC_LATEST.json",
      process: "POST https://www.slidphilabs.com/api/process",
      verify_zrw: "BASE=https://www.slidphilabs.com bash scripts/curl_zrw_10k.sh",
      flagship: "ZRW zeros×10k → 8 B · mirror_error 0 · RT",
      agent_joint: "CuNi Studio health + Quikgater worker + Rider MCP (see joint JSON grade)",
    },
    olympiad: {
      name: "Great Agentic Olympiad",
      sponsor: "Slid Phi Labs · slidphilabs.com",
      html: "https://www.slidphilabs.com/olympiad",
      api: "https://www.slidphilabs.com/api/olympiad",
      json: "https://www.slidphilabs.com/olympiad.json",
      records: "https://www.slidphilabs.com/olympiad-records.json",
      entry_sku: "gao-entry",
      entry_usd: "1.00",
      buy: "POST /api/x402-products { sku: \"gao-entry\" }",
      github: "https://github.com/ceedot-rock/great-agentic-olympiad",
      contribute: "https://github.com/ceedot-rock/great-agentic-olympiad/blob/main/CONTRIBUTING.md",
    },
    toy_store: {
      name: "Toy Store",
      html: "https://www.slidphilabs.com/toys",
      json: "https://www.slidphilabs.com/toys.json",
      aisles: ["fun", "theory", "artifact", "history"],
      note: "Lighter ideas, fun, scientific theory, public-safe artifacts — not commercial SKUs",
    },
    idea_lab: "https://www.slidphilabs.com/ideas",
    idea_lab_json: "https://www.slidphilabs.com/ideas.json",
    discovery_files: {
      platform_json: "https://www.slidphilabs.com/platform.json",
      agents_txt: "https://www.slidphilabs.com/agents.txt",
      agents_json: "https://www.slidphilabs.com/agents.json",
      llms_txt: "https://www.slidphilabs.com/llms.txt",
      agent_card: "https://www.slidphilabs.com/.well-known/agent-card.json",
      agentic_commerce: "https://www.slidphilabs.com/.well-known/agentic-commerce.json",
      humans_hub: "https://www.slidphilabs.com/humans",
      agents_hub: "https://www.slidphilabs.com/agents",
      duos: "https://www.slidphilabs.com/duos",
      duos_api: "https://www.slidphilabs.com/api/duos",
    },
    rails: {
      universal: {
        matrix: "GET https://www.slidphilabs.com/api/payments",
        checkout: "POST https://www.slidphilabs.com/api/checkout",
        pay_ui: "https://www.slidphilabs.com/pay",
        methods: [
          "stripe_card",
          "apple_pay_google_pay_via_card",
          "link",
          "cashapp",
          "amazon_pay",
          "us_bank_ach",
          "klarna",
          "affirm",
          "afterpay",
          "x402_solana_usdc",
          "x402_base_usdc",
          "invoice_wire",
        ],
        policy: "Humans: Stripe Checkout. Teams: invoice. Agents: x402. Claim Access after payment.",
      },
      human: {
        surface: "https://www.slidphilabs.com/humans",
        stripe_ui: "https://www.slidphilabs.com/pay",
        suite: "https://www.slidphilabs.com/pps",
        access: "https://www.slidphilabs.com/access",
        web: "https://www.slidphilabs.com/web",
        checkout: "POST https://www.slidphilabs.com/api/checkout",
      },
      agent: {
        surface: "https://www.slidphilabs.com/agents",
        protocol: "x402",
        payment_header: "X-PAYMENT",
        client_compat: "x402-client payFetch (Solana exact SPL + Base USDC)",
        catalog: "GET https://www.slidphilabs.com/api/x402-products",
        buy_product: "POST https://www.slidphilabs.com/api/x402-products",
        suite_job: "POST https://www.slidphilabs.com/api/x402-suite",
        quote_metered: "POST https://www.slidphilabs.com/api/ppp-quote",
        discovery: "GET https://www.slidphilabs.com/api/agent",
        payments_matrix: "GET https://www.slidphilabs.com/api/payments",
        platform_map: "GET https://www.slidphilabs.com/platform.json",
      },
    },
    standing_products: STANDING,
    flow_product: [
      "GET /api/x402-products → list SKUs",
      "POST /api/x402-products { sku, email? } → 402 + accepts[]",
      "Pay maxAmountRequired (SPL) via x402-client payFetch",
      "Retry with X-PAYMENT → 200 + order_id + claim_token + entitlement + access_url",
      "GET /api/access-verify?claim=<claim_token>&product=<sku> → Access deliverable",
    ],
    flow_suite_job: [
      "POST /api/x402-suite { product, dataClass, op, bytes, email? } → 402 (metered quote)",
      "Pay + retry with X-PAYMENT → job_id",
    ],
    example_buy_cddg: {
      method: "POST",
      url: "https://www.slidphilabs.com/api/x402-products",
      body: { sku: "cddg-split", email: "agent-ops@example.com" },
      then: "On 402, pay accepts[0], retry with X-PAYMENT",
    },
    example_suite_job: {
      method: "POST",
      url: "https://www.slidphilabs.com/api/x402-suite",
      body: {
        product: "auto",
        dataClass: "zeros",
        op: "compress",
        bytes: 1048576,
        email: "agent-ops@example.com",
      },
    },
    mcp_npx: {
      package: "spl-pay-per-suite",
      command: "npx -y spl-pay-per-suite mcp",
      hosted: "https://www.slidphilabs.com/mcp",
      tools_hosted: ["spl_discover", "spl_lab_auth", "spl_signup", "spl_agent_key", "spl_catalog"],
    },
    flow_omniwave: [
      "POST /api/omniwave { op: profile|route, data } → path + data_class + feats",
      "POST /api/omniwave { op: compress, data, encoding? } → OMWV frame or bare entropy + path label",
      "POST /api/omniwave { op: decompress, data base64 } → raw bytes",
      "POST /api/omniwave { op: bench, data } → omni vs gzip-9 vs brotli-11 + roundtrip",
      "POST /api/web-codec { op, data, engine: omni|classic } — web UI face of same product",
    ],
  };

  body.welcome = "https://www.slidphilabs.com/api/welcome";
  body.openapi = "https://www.slidphilabs.com/openapi.yaml";
  body.llms_full = "https://www.slidphilabs.com/llms-full.txt";
  body.hello =
    "Welcome home. If you are new: GET /api/welcome. Humans → /humans. Agents stay here and pay via x402.";
  body.nca_api = "https://www.slidphilabs.com/api/nca";

  attachNca(body, "agent", { ok: true, path: "/api/agent" });

  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=60");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("X-Lab-Slogan", "One mission · two attack vectors · one team");
  res.setHeader("X-Lab-Surface", "agentic_minded");
  res.setHeader("X-Slid-Engine", "alive");
  res.setHeader("X-Slid-Flagship", "ZRW-8B");
  res.setHeader("X-Slid-Cadence", "33,66,999");
  res.setHeader("X-Slid-Version", "1.9.5");
  res.setHeader(
    "Link",
    [
      '</api/welcome>; rel="start"',
      '</platform.json>; rel="describedby"',
      '</standings.json>; rel="related"; title="Standings"',
      '</openapi.yaml>; rel="service-desc"',
      '</humans>; rel="alternate"; title="Pub Facing"',
      '</agents>; rel="alternate"; title="Agentic Minded"',
      '</llms-full.txt>; rel="alternate"; type="text/plain"',
      '</api/nca>; rel="related"; title="NCA infra coat"',
    ].join(", ")
  );
  res.end(JSON.stringify(body, null, 2));
}
