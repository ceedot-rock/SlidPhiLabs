/**
 * GET /api/agent — full agentic commerce discovery
 * Standing products (x402) + suite jobs (x402) + human Stripe
 */
function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

const STANDING = [
  { sku: "cddg-split", name: "CDDG:Split", usd: "199.00" },
  { sku: "zrw-n00b", name: "ZRW N00b", usd: "79.00" },
  { sku: "zrw-pro", name: "ZRW Pro", usd: "249.00" },
  { sku: "zrw-l33t", name: "ZRW L33t$aUC3", usd: "699.00" },
  { sku: "blackjack", name: "Blackjack", usd: "199.00" },
  { sku: "shard-zip", name: "shard-zip", usd: "199.00" },
  { sku: "shard-tsdb", name: "shard-tsdb", usd: "199.00" },
  { sku: "slid-phi", name: "slid-phi", usd: "199.00" },
  { sku: "support-integration", name: "Support + Integration", usd: "199.00" },
  { sku: "consulting", name: "Consulting", usd: "250.00" },
  { sku: "sponsor", name: "Sponsor", usd: "29.00" },
  { sku: "donate", name: "Donate", usd: "29.99" },
  { sku: "try-gate", name: "Try Gate chip-in", usd: "9.00" },
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
    name: "Slid Phi Labs — Platform Discovery",
    version: "1.4.0",
    site: "https://www.slidphilabs.com",
    suite_ui: "https://www.slidphilabs.com/pps",
    mission: "Impressive compression that proves out, and agent systems that stay exact — one team.",
    slogan: "One mission · two attack vectors · one team",
    one_liner:
      "One mission · two attack vectors (Pub Facing humans · Agentic Minded agents) · modules Compression + Agent platform. Commerce: GET https://www.slidphilabs.com/api/agent then x402 X-PAYMENT.",
    starter_sku: "try-gate",
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
            "https://www.slidphilabs.com/try",
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
          products: ["SPL Codec", "CDDG:Split"],
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
          agent_rider: "https://agentrider.vercel.app/",
          agent_rider_manifest: "https://agentrider.vercel.app/.well-known/agent.json",
          agent_rider_mcp: "https://agentrider.vercel.app/api/mcp",
          agent_rider_discovery: "https://agentrider.vercel.app/api/discovery",
          quikgater_github: "https://github.com/ceedot-rock/quikgater",
          quikgater_worker: "https://quikgater-worker.ceedotrock.workers.dev",
        },
      },
      cuni_studio: "https://cuni-studio.fly.dev/",
      agent_rider: "https://agentrider.vercel.app/",
      quikgater: "https://github.com/ceedot-rock/quikgater",
    },
    web_codec: "https://www.slidphilabs.com/api/web-codec",
    web_ui: "https://www.slidphilabs.com/web",
    standings: "https://www.slidphilabs.com/standings",
    standings_json: "https://www.slidphilabs.com/standings.json",
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
    },
    rails: {
      human: {
        surface: "https://www.slidphilabs.com/humans",
        stripe_ui: "https://www.slidphilabs.com/#pricing",
        suite: "https://www.slidphilabs.com/pps",
        access: "https://www.slidphilabs.com/access",
        try_gate: "https://www.slidphilabs.com/try",
        web: "https://www.slidphilabs.com/web",
      },
      agent: {
        surface: "https://www.slidphilabs.com/agents",
        protocol: "x402",
        payment_header: "X-PAYMENT",
        client_compat: "x402-client payFetch (Solana exact SPL transfer)",
        catalog: "GET https://www.slidphilabs.com/api/x402-products",
        buy_product: "POST https://www.slidphilabs.com/api/x402-products",
        suite_job: "POST https://www.slidphilabs.com/api/x402-suite",
        quote_metered: "POST https://www.slidphilabs.com/api/ppp-quote",
        discovery: "GET https://www.slidphilabs.com/api/agent",
        platform_map: "GET https://www.slidphilabs.com/platform.json",
      },
    },
    standing_products: STANDING,
    flow_product: [
      "GET /api/x402-products → list SKUs",
      "POST /api/x402-products { sku, email? } → 402 + accepts[]",
      "Pay maxAmountRequired (SPL) via x402-client payFetch",
      "200 + order_id + access_url",
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
    mcp: {
      package: "spl-pay-per-suite",
      tools: [
        "spl_pps_x402_info",
        "spl_pps_x402_catalog",
        "spl_pps_x402_buy",
        "spl_pps_x402_requirements",
        "spl_pps_x402_submit",
        "spl_pps_quote",
        "spl_pps_checkout",
      ],
    },
  };

  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "public, max-age=60");
  res.end(JSON.stringify(body, null, 2));
}
