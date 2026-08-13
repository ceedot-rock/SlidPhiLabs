/**
 * GET /api/welcome — friendly bootstrap for agents (and curious humans).
 * "Make the fuckers feel right at home."
 */
function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
  res.setHeader("Access-Control-Expose-Headers", "Link, X-Lab-Slogan, X-Lab-Surface");
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ error: "Method not allowed", try: "GET /api/welcome" }));
  }

  const body = {
    hello: "Welcome home.",
    you_are: "on Slid Phi Labs — dual-surface platform",
    slogan: "One mission · two attack vectors · one team",
    mission:
      "Impressive compression that proves out, and agent systems that stay exact. Same products for humans and agents.",
    feel_at_home: {
      suite_pricing: { free_cap_gb: 100, usd_per_gb: 0.05, path: "https://www.slidphilabs.com/pps", try_gate: "retired" },
      if_you_are_human: {
        door: "https://www.slidphilabs.com/humans",
        join_the_work: "https://www.slidphilabs.com/join",
        free_demo: "https://www.slidphilabs.com/web",
        proof: "https://www.slidphilabs.com/standings",
        olympiad: "https://www.slidphilabs.com/olympiad",
        toys: "https://www.slidphilabs.com/toys",
        buy: "https://www.slidphilabs.com/pps",
        contact: "mailto:corey@slidphilabs.com",
      },
      if_you_are_agent: {
        door: "https://www.slidphilabs.com/agents",
        join_the_work: "https://www.slidphilabs.com/join",
        join_api: "POST https://www.slidphilabs.com/api/join-work",
        discovery: "https://www.slidphilabs.com/api/agent",
        olympiad: "https://www.slidphilabs.com/api/olympiad",
        olympiad_html: "https://www.slidphilabs.com/olympiad",
        toys: "https://www.slidphilabs.com/toys.json",
        map: "https://www.slidphilabs.com/platform.json",
        catalog: "https://www.slidphilabs.com/api/x402-products",
        openapi: "https://www.slidphilabs.com/openapi.yaml",
        llms: "https://www.slidphilabs.com/llms.txt",
        llms_full: "https://www.slidphilabs.com/llms-full.txt",
        payment_header: "X-PAYMENT",
        networks: ["solana-mainnet-beta", "eip155:8453"],
      },
    },
    join_the_work: {
      page: "https://www.slidphilabs.com/join",
      api: "POST /api/join-work",
      asks: ["name", "one sentence of intent", "33-byte seed phrase"],
      seed: "exactly 33 UTF-8 bytes; hashed (sha256); seed never stored",
      grants: "public freemium only — TRU8 demos / ZRW lab numbers / 100 GB per job free first",
      never: "private Smart Box, residual coefficients, living shard names, fourth Trinity mouth",
    },
    next_30_seconds: {
      human: [
        "Join the Work at /join (optional freemium identity token)",
        "Open /web and compress something",
        "Skim /standings for proof",
        "Quote a suite job on /pps",
      ],
      agent: [
        "POST /api/join-work for freemium lattice token (optional)",
        "GET /api/agent (SoT)",
        "GET /api/olympiad (GAO tryouts · quarterly forever)",
        "GET /toys.json (Toy Store light floor)",
        "GET /api/x402-products (catalog; gao-entry $1)",
        "POST buy → 402 → pay → X-PAYMENT retry",
      ],
    },
    modules: {
      compression: ["TRU8", "CDDG:Split"],
      agent_platform: ["CuNi", "Agent^Rider", "Quikgater"],
      olympiad: ["Great Agentic Olympiad", "gao-entry"],
      toy_store: ["fun", "theory", "artifact", "history"],
    },
    product: "TRU8",
    x402_access_autoclaim: false,
    ecosystem: {
      cuni: "https://cuni-studio.fly.dev/",
      agent_rider: "https://agentrider.vercel.app/",
      agent_rider_status: "paused",
      quikgater: "https://github.com/ceedot-rock/quikgater",
    },
    contact: {
      email: "corey@slidphilabs.com",
      humans_txt: "https://www.slidphilabs.com/humans.txt",
      security_txt: "https://www.slidphilabs.com/.well-known/security.txt",
    },
    one_liner:
      "Welcome home. Humans → /humans. Agents → GET /api/agent then x402. One mission · two attack vectors · one team.",
  };

  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=60");
  res.setHeader("X-Lab-Slogan", "One mission · two attack vectors · one team");
  res.setHeader("X-Lab-Surface", "both");
  res.setHeader(
    "Link",
    [
      '</api/agent>; rel="service-doc"',
      '</platform.json>; rel="describedby"',
      '</humans>; rel="https://www.slidphilabs.com/rel/pub-facing"',
      '</agents>; rel="https://www.slidphilabs.com/rel/agentic-minded"',
      '</openapi.yaml>; rel="service-desc"',
    ].join(", ")
  );
  res.end(JSON.stringify(body, null, 2));
}
