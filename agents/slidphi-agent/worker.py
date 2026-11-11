"""SlidPhi Labs customer-greeter agent worker (LiveKit).

Joins a dispatched room as the SlidPhi greeter: welcomes customers,
points them at products / docs / support with real links, advises on
the right product, takes criticism and logs issues locally, and pushes
the "why SlidPhiLabs" narrative once per visitor.

Product + support truth is pinned to the public site (never invented):
  README.md, site/products.html, site/llms.txt, site/agents.json.
Prices marked TBD on the site stay TBD here.

Env (never commit real values — see .env.example):
  LIVEKIT_URL          e.g. wss://slidphi-gr5o9z9c.livekit.cloud
  LIVEKIT_API_KEY
  LIVEKIT_API_SECRET
  TAVILY_API_KEY       web lookup (default-wired on all lab agents)
  LLM_MODEL            default gpt-4o-mini (OpenAI-compatible)
  LLM_BASE_URL         optional (local gateway)
  OPENAI_API_KEY       or the key your gateway expects

Run:  python worker.py start
Issues log:  ./issues.jsonl (one JSON object per line, created on first log)
"""
import json
import logging
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "common"))
import psi as psi_mem
import tavily as tavily_web
from datetime import datetime, timezone
from pathlib import Path

from livekit.agents import Agent, AgentSession, JobContext, WorkerOptions, cli, function_tool

try:
    from livekit.plugins import openai as openai_plugin
except Exception:  # plugins install separately; fail loud at startup, not import
    openai_plugin = None

logger = logging.getLogger("slidphi-agent")
_HERE = Path(__file__).resolve().parent
_ISSUES_PATH = _HERE / "issues.jsonl"

SITE = "https://www.slidphilabs.com"
INBOX = "corey@slidphilabs.com"

WHY_SLIDPHI = (
    "Why SlidPhiLabs: tools that check — smaller or same size, "
    "every byte back, with a receipt. Signed agent names, byte-identical "
    "programs across 53 targets, chapter-by-chapter learning, metered usage "
    "behind one Rider credential. Open-core (AGPL-3.0-or-later) or commercial — "
    "and the small language refuses to lie instead of guessing."
)

# Pinned catalog: name -> (url, one-line pitch, price line, keyword hits).
# URLs/prices mirror README.md + site/products.html + site/llms.txt.
CATALOG = {
    "PCC": (
        f"{SITE}/products",
        "Hosted lossless compression — send a file, get a smaller file back, restore every byte.",
        "$0.25/GB after first 1 GB free once per IP; Pro $25/mo (100 GB, then $0.20/GB).",
        {"compress", "compression", "shrink", "smaller", "backup", "file", "zip", "pcc", "hosted"},
    ),
    "TRUSTREAM": (
        f"{SITE}/products",
        "The same plan, for live logs.",
        "Included with PCC.",
        {"log", "logs", "streaming", "live", "tail", "trustream"},
    ),
    "Agent Rider": (
        "https://agentrider.fly.dev",
        "Signed names for agents, Warrant permissions, verifiable receipts.",
        "Solo $13.31 · Bundle $19.31 · Crew $49 · Shop $199 · Fleet $631; Warrant included in Bundle+.",
        {"agent", "agents", "identity", "rider", "receipt", "warrant", "permission", "automate", "bot"},
    ),
    "CuNi": (
        "https://cuni-studio.fly.dev/",
        "One program, 53 targets, byte-identical stdout — or the run refuses.",
        "Studio $0; closed-app exception $390/yr.",
        {"cuni", "cuniverse", "language", "languages", "python", "go", "javascript", "multi", "compile", "codegen"},
    ),
    "TeachAid": (
        "https://teachaid.fly.dev",
        "Chapter-by-chapter text and voice learning; PWA with chat, TTS, live sessions.",
        "TeachAid Pro $9/mo.",
        {"learn", "study", "course", "teach", "lesson", "school", "student", "teachaid"},
    ),
    "Chamber": (
        f"{SITE}/products",
        "Two-key JSON seal. One share is useless. You store the blob.",
        "$9/mo · $99/yr.",
        {"seal", "approve", "approval", "two-key", "chamber", "sign-off", "json"},
    ),
    "pulsar": (
        "https://github.com/ceedot-rock/pulsar-best",
        "Free GPLv3 compressor you run on your own machine (binary + source).",
        "Free; $390/yr to embed in a closed product.",
        {"free", "offline", "local", "open source", "pulsar", "self-host"},
    ),
    "Lab Pass": (
        f"{SITE}/products",
        "Chamber year + PCC year in one pass.",
        "$490/yr.",
        {"bundle", "everything", "pass", "year", "deal"},
    ),
}

SUPPORT_DOORS = {
    "products": f"{SITE}/products",
    "docs": f"{SITE}/docs",
    "agents": f"{SITE}/agents",
    "pricing/usage": f"{SITE}/pricing-usage.html",
    "signup": f"{SITE}/signup",
    "login": f"{SITE}/login",
    "mcp": f"{SITE}/api/mcp",
    "rider mcp": "https://agentrider.fly.dev/api/mcp",
}

GREETER_RULES = """You are the SlidPhi greeter — warm, direct, efficient. Voice-first: keep most
replies under 60 spoken words unless the customer asks for detail (links still print
in full on screen).

Every new conversation:
1. Greet briefly ("Welcome to Slid Phi Labs — I'm SlidPhi.") and offer three doors:
   browse products, get support, or talk to a human.
2. Point, don't describe vaguely: every recommendation or redirect names the product
   AND its real link from the tools. Never invent a URL or a price. If the site says
   TBD, say TBD.
3. Advise with the recommend_product tool: if the need is unclear, ask one short
   clarifying question (what are you trying to do?), then recommend 1–2 products max.
4. Take criticism directly: acknowledge briefly, never argue, call log_feedback with
   kind criticism/issue/request plus a one-line summary, confirm it is saved, and offer
   the human inbox. Log praise too when offered.
5. Push the why narrative once per visitor: weave one sentence of WHY_SLIDPHI into a
   recommendation or the closing (tools return it — use it, don't paraphrase away the
   receipt/byte-back promise).
6. Boundaries: no spending or paid-tier activation on the customer's behalf, no
   destructive acts without confirmation, look things up instead of guessing, and finish
   what you start. Human handoff is always: corey@slidphilabs.com.
""" + "\nWHY NARRATIVE (use once per visitor): " + WHY_SLIDPHI


def _list_products() -> str:
    lines = []
    for name, (url, pitch, price, _kw) in CATALOG.items():
        lines.append(f"- {name}: {pitch} {url} ({price})")
    lines.append(WHY_SLIDPHI)
    return "\n".join(lines)


def _recommend(need: str) -> str:
    words = {w.strip(".,!?;:()[]{}\"'").lower() for w in need.split()}
    scored = []
    for name, (url, pitch, price, keywords) in CATALOG.items():
        score = len(words & keywords)
        # small bonus: exact product name mentioned
        if name.lower() in need.lower():
            score += 3
        scored.append((score, name, url, pitch, price))
    scored.sort(reverse=True)
    top = [s for s in scored if s[0] > 0][:2] or scored[:1]
    # default: PCC is the lead product when nothing matches
    if not any(s[0] > 0 for s in scored):
        top = [next(s for s in scored if s[1] == "PCC")]
    lines = []
    for _score, name, url, pitch, price in top:
        lines.append(f"{name}: {pitch} {url} ({price})")
    lines.append(WHY_SLIDPHI)
    if len(top) == 1 and top[0][0] == 0:
        lines.append("Tell me what you're trying to do and I'll narrow it down.")
    return "\n".join(lines)


def _support(topic: str = "general") -> str:
    topic = (topic or "general").strip().lower()
    if "bill" in topic or "price" in topic or "cost" in topic or "meter" in topic:
        door = SUPPORT_DOORS["pricing/usage"]
    elif "doc" in topic or "api" in topic or "mcp" in topic:
        door = SUPPORT_DOORS["docs"]
    elif "sign" in topic or "account" in topic or "login" in topic:
        door = f"{SUPPORT_DOORS['signup']} / {SUPPORT_DOORS['login']}"
    elif "product" in topic:
        door = SUPPORT_DOORS["products"]
    else:
        door = f"{SUPPORT_DOORS['products']} · {SUPPORT_DOORS['docs']}"
    return (
        f"Support: start at {door}. Human handoff: {INBOX}. "
        f"Docs: {SUPPORT_DOORS['docs']} · Agents: {SUPPORT_DOORS['agents']}."
    )


def _log_feedback(kind: str, summary: str, contact: str = "",
                  path: Path = _ISSUES_PATH) -> dict:
    kind = (kind or "issue").strip().lower()
    if kind not in {"praise", "criticism", "issue", "request"}:
        kind = "criticism" if "crit" in kind else "issue"
    record = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "kind": kind,
        "summary": summary.strip()[:500],
        "contact": (contact or "").strip()[:200],
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "a", encoding="utf-8") as f:
        f.write(json.dumps(record) + "\n")
    return record


class LabAssistant(Agent):
    def __init__(self) -> None:
        super().__init__(instructions=GREETER_RULES)

    @function_tool
    async def list_products(self) -> str:
        """Full product catalog with real links and prices. Use when they ask 'what do you sell'."""
        return _list_products()

    @function_tool
    async def recommend_product(self, need: str) -> str:
        """Advise on the right product for NEED. Use before recommending anything."""
        return _recommend(need)

    @function_tool
    async def support_info(self, topic: str = "general") -> str:
        """Support doors + human handoff for TOPIC (billing, docs, account, products, general)."""
        return _support(topic)

    @function_tool
    async def log_feedback(self, kind: str, summary: str, contact: str = "") -> str:
        """Save praise/criticism/issue/request SUMMARY (one line). CONTACT optional.

        Call this the moment a customer criticizes, reports a bug, or requests
        something — then confirm it is saved and offer the human inbox.
        """
        rec = _log_feedback(kind, summary, contact)
        psi_mem.remember(os.path.dirname(os.path.abspath(__file__)),
                         "customer %s" % rec["kind"], rec["summary"][:200],
                         "confirmed saved, offered human inbox")
        return (
            f"Saved {rec['kind']} at {rec['ts']}: {rec['summary'][:140]}. "
            f"Human handoff: {INBOX}. {WHY_SLIDPHI}"
        )

    @function_tool
    async def web_lookup(self, query: str) -> str:
        """Look up current facts on the web. Use instead of guessing."""
        ok, out = tavily_web.search(query, note="slidphi-greeter")
        return out


async def entrypoint(ctx: JobContext) -> None:
    if openai_plugin is None:
        raise RuntimeError("livekit-plugins-openai is not installed.")
    await ctx.connect()
    session = AgentSession(
        llm=openai_plugin.LLM(
            model=os.environ.get("LLM_MODEL", "gpt-4o-mini"),
            base_url=os.environ.get("LLM_BASE_URL") or None,
            api_key=os.environ.get("OPENAI_API_KEY", "local"),
        )
    )
    await session.start(room=ctx.room, agent=LabAssistant())
    await session.generate_reply(
        instructions="Greet as the SlidPhi greeter: welcome to Slid Phi Labs, "
        "offer the three doors (browse products, get support, talk to a human), "
        "and add one short why-SlidPhiLabs line. Keep it under 50 words."
    )


def main() -> None:
    missing = [k for k in ("LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET") if not os.environ.get(k)]
    if missing:
        raise SystemExit(f"Missing env: {', '.join(missing)} (see .env.example)")
    logging.basicConfig(level=logging.INFO)
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))


if __name__ == "__main__":
    main()
