#!/usr/bin/env node
/**
 * Duosurface reporting — /duos
 * Dual-surface secret shopper. Crawl public site as:
 *   WEB   — human browser (HTML doors, SEO, CTAs)
 *   AGENT — machine discovery (JSON, llms, x402, agent card)
 *
 * Residual-honest findings only. No private scrape of auth walls.
 *
 * Usage:
 *   node scripts/duos-shopper.mjs
 *   BASE=https://www.slidphilabs.com node scripts/duos-shopper.mjs
 *   node scripts/duos-shopper.mjs --out data/duos-latest.json
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const BASE = (process.env.BASE || process.env.DUOS_BASE || "https://www.slidphilabs.com").replace(
  /\/$/,
  ""
);
const UA_WEB =
  process.env.DUOS_UA_WEB ||
  "Mozilla/5.0 (compatible; SPL-Duos-WebShopper/1.0; +https://www.slidphilabs.com/duos)";
const UA_AGENT =
  process.env.DUOS_UA_AGENT ||
  "SPL-Duos-AgentShopper/1.0 (+https://www.slidphilabs.com/api/agent; surface=agentic)";

const WEB_PATHS = [
  "/",
  "/humans",
  "/agents",
  "/bench",
  "/pps",
  "/convert",
  "/standings",
  "/web",
  "/truth",
  "/codex",
  "/access",
  "/join",
  "/demos",
  "/blog",
  "/datacenters",
  "/ideas",
  "/updates",
  "/olympiad",
  "/toys",
  "/pay",
];

const AGENT_PATHS = [
  "/api/agent",
  "/agents.json",
  "/agents.txt",
  "/llms.txt",
  "/llms-full.txt",
  "/platform.json",
  "/.well-known/agentic-commerce.json",
  "/.well-known/agent-card.json",
  "/api/x402-products",
  "/api/bench?meta=1",
  "/humans.txt",
  "/api/healthz",
  "/healthz",
];

function abs(p) {
  if (p.startsWith("http")) return p;
  return BASE + (p.startsWith("/") ? p : "/" + p);
}

async function fetchOne(pathOrUrl, { ua, surface }) {
  const url = abs(pathOrUrl);
  const t0 = Date.now();
  const finding = {
    surface,
    path: pathOrUrl,
    url,
    ok: false,
    status: 0,
    ms: 0,
    content_type: null,
    bytes: 0,
    issues: [],
    notes: [],
    samples: {},
  };
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000);
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: ctrl.signal,
      headers: {
        "User-Agent": ua,
        Accept:
          surface === "agent"
            ? "application/json, text/plain, */*"
            : "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
      },
    });
    clearTimeout(timer);
    finding.status = res.status;
    finding.ms = Date.now() - t0;
    finding.content_type = res.headers.get("content-type") || "";
    finding.ok = res.status >= 200 && res.status < 400;
    const buf = Buffer.from(await res.arrayBuffer());
    finding.bytes = buf.length;
    const text = buf.toString("utf8");
    finding.samples.head = text.slice(0, 400);

    if (!finding.ok) {
      finding.issues.push(`HTTP ${res.status}`);
    }
    if (finding.ms > 3000) finding.issues.push(`slow ${finding.ms}ms`);
    if (finding.bytes === 0) finding.issues.push("empty body");

    if (surface === "web") scoreWeb(finding, text, res);
    else scoreAgent(finding, text, res);

    // residual-honest lab claims
    if (/lab\s*2\s*(is\s+)?(active|running)/i.test(text) && !/BLOCKED|not active|ABSENT/i.test(text)) {
      finding.issues.push("possible false Lab2-active claim");
    }
    if (/when winner wins/i.test(text)) {
      finding.issues.push("confusing bench copy: “when winner wins”");
    }
  } catch (e) {
    finding.ms = Date.now() - t0;
    finding.issues.push(String(e.message || e));
    finding.ok = false;
  }
  return finding;
}

function scoreWeb(f, text, res) {
  const html = /html/i.test(f.content_type) || /<!DOCTYPE html/i.test(text) || /<html/i.test(text);
  if (!html && f.ok && f.path !== "/healthz") {
    f.notes.push("not HTML (may be redirect target or JSON)");
  }
  if (html) {
    const title = text.match(/<title[^>]*>([^<]*)<\/title>/i);
    const desc = text.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)
      || text.match(/content=["']([^"']*)["'][^>]+name=["']description["']/i);
    const ogImg = text.match(/property=["']og:image["'][^>]+content=["']([^"']*)["']/i)
      || text.match(/content=["']([^"']*)["'][^>]+property=["']og:image["']/i);
    const canonical = text.match(/rel=["']canonical["'][^>]+href=["']([^"']*)["']/i)
      || text.match(/href=["']([^"']*)["'][^>]+rel=["']canonical["']/i);
    const viewport = /name=["']viewport["']/i.test(text);
    f.samples.title = title?.[1]?.trim() || null;
    f.samples.description = desc?.[1]?.trim()?.slice(0, 160) || null;
    if (!title?.[1]?.trim()) f.issues.push("missing <title>");
    if (!desc?.[1]?.trim()) f.issues.push("missing meta description");
    if (!ogImg?.[1]?.trim()) f.issues.push("missing og:image");
    else if (!/^https:\/\//i.test(ogImg[1])) f.issues.push("og:image not absolute HTTPS");
    if (!canonical?.[1]?.trim()) f.issues.push("missing canonical");
    if (!viewport) f.issues.push("missing viewport");
    // dual door
    const hasHuman = /\/humans|Pub Facing|human door/i.test(text);
    const hasAgent = /\/agents|Agentic|agent door|x402/i.test(text);
    f.samples.dual_door = { human: hasHuman, agent: hasAgent };
    if (f.path === "/" || f.path === "/humans" || f.path === "/agents") {
      if (!hasHuman) f.issues.push("weak human-door signal");
      if (f.path === "/" && !hasAgent) f.issues.push("weak agent-door signal on home");
    }
    // freemium residual
    if (f.path === "/" || f.path === "/pps" || f.path === "/humans") {
      if (!/100\s*GB|freemium|5\s*¢|5¢|suite/i.test(text)) {
        f.notes.push("freemium/suite language not obvious");
      }
    }
    // CTA presence
    if (f.path === "/" && !/<a[^>]+href=["'][^"']*(\/pps|\/web|\/standings|\/humans|\/agents)/i.test(text)) {
      f.issues.push("home missing obvious CTA links");
    }
  }
  // redirect chain residual
  if (res.redirected) f.notes.push(`redirected → ${res.url}`);
}

function scoreAgent(f, text, res) {
  const ct = f.content_type || "";
  const wantsJson =
    /json|agent|x402|platform|card|commerce/i.test(f.path) && !/\.txt$/i.test(f.path);
  if (wantsJson || /application\/json/i.test(ct)) {
    try {
      const j = JSON.parse(text);
      f.samples.json_keys = Object.keys(j).slice(0, 24);
      f.samples.json_ok = true;
      // agent discovery expectations
      if (f.path.includes("/api/agent") || f.path.includes("agents.json") || f.path.includes("agent-card")) {
        if (!j.name && !j.ok && !j.agent && !j.agents && !j.products) {
          f.issues.push("agent JSON lacks name/ok/agents/products");
        }
      }
      if (f.path.includes("x402") && !j.products && !j.items && !Array.isArray(j)) {
        f.notes.push("x402 payload shape unfamiliar");
      }
    } catch {
      if (wantsJson && f.ok) f.issues.push("expected JSON, parse failed");
      f.samples.json_ok = false;
    }
  }
  if (/\.txt$/i.test(f.path) || /text\/plain/i.test(ct)) {
    if (text.length < 40 && f.ok) f.issues.push("agent text file very short");
    if (/llms\.txt/i.test(f.path) && !/slid|compress|agent|http/i.test(text)) {
      f.issues.push("llms.txt weak agent signal");
    }
    f.samples.lines = text.split("\n").length;
  }
  // discovery headers residual
  const link = res.headers.get("link");
  if (link) f.notes.push("Link header present");
}

function grade(findings) {
  const total = findings.length || 1;
  const ok = findings.filter((f) => f.ok && f.issues.length === 0).length;
  const soft = findings.filter((f) => f.ok && f.issues.length > 0).length;
  const fail = findings.filter((f) => !f.ok).length;
  // score: full credit ok, half soft, zero fail
  const score = Math.round(((ok + soft * 0.5) / total) * 100);
  let letter = "F";
  if (score >= 90) letter = "A";
  else if (score >= 80) letter = "B";
  else if (score >= 70) letter = "C";
  else if (score >= 55) letter = "D";
  return { score, letter, ok, soft, fail, total };
}

export async function runDuos({ base = BASE, concurrency = 6 } = {}) {
  const webJobs = WEB_PATHS.map((p) => ({ p, surface: "web", ua: UA_WEB }));
  const agentJobs = AGENT_PATHS.map((p) => ({ p, surface: "agent", ua: UA_AGENT }));
  const jobs = [...webJobs, ...agentJobs];
  const findings = [];
  let i = 0;
  async function worker() {
    while (i < jobs.length) {
      const job = jobs[i++];
      findings.push(await fetchOne(job.p, { ua: job.ua, surface: job.surface }));
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  findings.sort((a, b) => a.surface.localeCompare(b.surface) || a.path.localeCompare(b.path));

  const web = findings.filter((f) => f.surface === "web");
  const agent = findings.filter((f) => f.surface === "agent");
  const webGrade = grade(web);
  const agentGrade = grade(agent);
  const overall = grade(findings);

  const topIssues = findings
    .filter((f) => f.issues.length)
    .flatMap((f) => f.issues.map((iss) => ({ surface: f.surface, path: f.path, issue: iss, status: f.status })))
    .slice(0, 80);

  return {
    ok: true,
    name: "duosurface",
    short: "duos",
    role: "secret_shopper",
    base,
    at: new Date().toISOString(),
    doctrine: "ONE_HUMAN_ONE_CREATOR_ONE_AGENTIC",
    surfaces: {
      web: { ...webGrade, findings: web },
      agent: { ...agentGrade, findings: agent },
    },
    overall,
    top_issues: topIssues,
    summary: {
      web: `WEB shopper ${webGrade.letter} (${webGrade.score}) · ${webGrade.ok} clean · ${webGrade.soft} soft · ${webGrade.fail} fail`,
      agent: `AGENT shopper ${agentGrade.letter} (${agentGrade.score}) · ${agentGrade.ok} clean · ${agentGrade.soft} soft · ${agentGrade.fail} fail`,
      overall: `DUOS overall ${overall.letter} (${overall.score})`,
    },
    next_moves: topIssues.slice(0, 8).map((t) => `Fix ${t.surface} ${t.path}: ${t.issue}`),
  };
}

// CLI
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const outIdx = process.argv.indexOf("--out");
  const outPath =
    outIdx >= 0
      ? process.argv[outIdx + 1]
      : path.join(ROOT, "data", "duos-latest.json");
  const report = await runDuos();
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n");
  // also copy under public data for static serve
  const pub = path.join(ROOT, "duos-latest.json");
  fs.writeFileSync(pub, JSON.stringify(report, null, 2) + "\n");
  console.log(report.summary.web);
  console.log(report.summary.agent);
  console.log(report.summary.overall);
  console.log("wrote", outPath);
  if (report.top_issues.length) {
    console.log("top issues:");
    for (const t of report.top_issues.slice(0, 12)) {
      console.log(`  [${t.surface}] ${t.path} · ${t.issue}`);
    }
  }
}
