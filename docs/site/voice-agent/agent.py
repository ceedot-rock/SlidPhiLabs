"""
TRU8 voice guide — LiveKit Agents worker.

Voice in/out runs on LiveKit Cloud (STT + TTS via LiveKit Inference,
covered by the Startup Program credits). The brain is a Nebius-hosted
open model (OpenAI-compatible) answering under voice-agent/instructions.md.

Env (worker side, never in git):
  LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET
  NEBIUS_API_KEY, NEBIUS_MODEL (optional, default below)

Run:  pip install -r requirements.txt
      python agent.py dev        # playground
      python agent.py start      # production dispatch
Browsers join via POST /api/livekit-token (room "tru8-guide").
"""

import os
from pathlib import Path

from livekit.agents import Agent, AgentSession, JobContext, WorkerOptions, cli, inference
from livekit.plugins import openai, silero

NEBIUS_BASE = "https://api.studio.nebius.com/v1"
NEBIUS_MODEL = os.getenv("NEBIUS_MODEL", "meta-llama/Llama-3.3-70B-Instruct")
NEBIUS_KEY = os.getenv("NEBIUS_API_KEY", "")

HERE = Path(__file__).parent
INSTRUCTIONS = (HERE / "instructions.md").read_text(encoding="utf-8")


class Tru8Guide(Agent):
    def __init__(self) -> None:
        super().__init__(instructions=INSTRUCTIONS)


async def entrypoint(ctx: JobContext) -> None:
    if not NEBIUS_KEY:
        raise RuntimeError("NEBIUS_API_KEY not set on worker")
    session = AgentSession(
        vad=silero.VAD.load(),
        stt=inference.STT(),
        llm=openai.LLM(
            model=NEBIUS_MODEL,
            base_url=NEBIUS_BASE,
            api_key=NEBIUS_KEY,
            temperature=0.4,
        ),
        tts=inference.TTS(),
    )
    await session.start(room=ctx.room, agent=Tru8Guide())
    await session.generate_reply(
        instructions="Greet the caller as the TRU8 guide and ask what dataset they want to compress."
    )


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
