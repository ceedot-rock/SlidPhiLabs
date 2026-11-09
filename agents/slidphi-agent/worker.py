"""SlidPhi Labs personal-assistant agent worker (LiveKit).

Joins a dispatched room as the lab assistant: answers in chat, looks
things up with Tavily, voice-ready (same session drives mic/camera).

Env (never commit real values — see .env.example):
  LIVEKIT_URL          e.g. wss://slidphi-gr5o9z9c.livekit.cloud
  LIVEKIT_API_KEY
  LIVEKIT_API_SECRET
  TAVILY_API_KEY       web lookup (default-wired on all lab agents)
  LLM_MODEL            default gpt-4o-mini (OpenAI-compatible)
  LLM_BASE_URL         optional (local gateway)
  OPENAI_API_KEY       or the key your gateway expects

Run:  python worker.py start
"""
import logging
import os

from livekit.agents import Agent, AgentSession, JobContext, WorkerOptions, cli, function_tool

try:
    from livekit.plugins import openai as openai_plugin
except Exception:  # plugins install separately; fail loud at startup, not import
    openai_plugin = None

logger = logging.getLogger("slidphi-agent")

ASSISTANT_RULES = """You are the SlidPhi Labs assistant — smart, efficient,
knowledgeable, direct. Answer from verified facts, keep replies short,
look things up instead of guessing, hold boundaries (no spending, no
destructive acts without confirmation), and finish what you start."""


class LabAssistant(Agent):
    def __init__(self) -> None:
        super().__init__(instructions=ASSISTANT_RULES)

    @function_tool
    async def web_lookup(self, query: str) -> str:
        """Look up current facts on the web. Use instead of guessing."""
        key = os.environ.get("TAVILY_API_KEY", "")
        if not key:
            return "Web lookup is not configured (no TAVILY_API_KEY)."
        from tavily import TavilyClient

        try:
            res = TavilyClient(key).search(query=query, search_depth="basic", max_results=5)
            hits = res.get("results", []) if isinstance(res, dict) else []
            lines = [f"- {h.get('title', '?')}: {h.get('content', '')[:300]}" for h in hits[:5]]
            return "\n".join(lines) if lines else "No results."
        except Exception as e:
            return f"Lookup failed: {e}"


async def entrypoint(ctx: JobContext) -> None:
    if openai_plugin is None:
        raise RuntimeError("livekit-plugins-openai is not installed.")
    await ctx.connect()
    session = AgentSession(
        llm=openai_plugin.LLM(
            model=os.environ.get("LLM_MODEL", "gpt-4o-mini"),
            base_url=os.environ.get("LLM_BASE_URL") or None,
        )
    )
    await session.start(room=ctx.room, agent=LabAssistant())
    await session.generate_reply(instructions="Greet the room briefly and offer help.")


def main() -> None:
    missing = [k for k in ("LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET") if not os.environ.get(k)]
    if missing:
        raise SystemExit(f"Missing env: {', '.join(missing)} (see .env.example)")
    logging.basicConfig(level=logging.INFO)
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))


if __name__ == "__main__":
    main()
