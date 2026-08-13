#!/usr/bin/env python3
"""Post amp thread with OAuth 1.0a (portal-generated access tokens)."""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

THREAD = [
    """Site now breathes.

Compression that knows it is alive.

ZRW zeros×10k → 8 B
gzip-9: 73 B · brotli-11: 13 B
ramp ~141× vs brotli

Live proof bar · standings · metrics
https://www.slidphilabs.com""",
    """What just went live:

• Hero leads with the 8 B claim
• Proof bar: ratio · cycles · self-tunes · last path
• Standings first-paint (no Loading…)
• GET /api/phi/metrics → alive:true
• Headers: X-Slid-Engine: alive

Pulse: https://www.slidphilabs.com/api/phi/metrics
Standings: https://www.slidphilabs.com/standings""",
    """One product. Two doors.

Humans → free web · standings · suite
https://www.slidphilabs.com/humans

Agents → GET /api/agent · x402 · OmniWave
https://www.slidphilabs.com/agents

Same lab. Same 8 B proof. Different rails.""",
    """IP Guard: outcomes only.

Free first 100 GB suite, then ~5¢/GB under ~9¢ egress.
Try free web: https://www.slidphilabs.com/web
Why 8 B: https://www.slidphilabs.com/blog/2026-08-07-why-8b-matters

Exact codecs. Agentic infrastructure.
Compression that knows it is alive.
@slidphilabs""",
]


def load_env():
    for p in [
        Path("/home/cee/projects/midpoint-news-agency/.env"),
        Path("/home/cee/projects/SlidPhiLabs/.secrets/x_oauth1.env"),
    ]:
        if not p.exists():
            continue
        for line in p.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
    if os.getenv("X_ACCESS_TOKEN_SECRET") and not os.getenv("X_ACCESS_SECRET"):
        os.environ["X_ACCESS_SECRET"] = os.environ["X_ACCESS_TOKEN_SECRET"]


def main():
    load_env()
    need = ["X_API_KEY", "X_API_SECRET", "X_ACCESS_TOKEN", "X_ACCESS_SECRET"]
    miss = [k for k in need if not os.getenv(k)]
    if miss:
        print("Missing:", ", ".join(miss))
        print("See X_POST_WITHOUT_BROWSER.md")
        return 1
    try:
        import tweepy
    except ImportError:
        print("pip install tweepy")
        return 1

    client = tweepy.Client(
        consumer_key=os.environ["X_API_KEY"],
        consumer_secret=os.environ["X_API_SECRET"],
        access_token=os.environ["X_ACCESS_TOKEN"],
        access_token_secret=os.environ["X_ACCESS_SECRET"],
    )
    me = client.get_me(user_auth=True)
    if not me.data:
        print("get_me failed — tokens invalid or read-only")
        return 1
    print(f"auth ok @{me.data.username}")

    reply = None
    ids = []
    for i, text in enumerate(THREAD, 1):
        kwargs = {"text": text, "user_auth": True}
        if reply:
            kwargs["in_reply_to_tweet_id"] = reply
        r = client.create_tweet(**kwargs)
        tid = str(r.data["id"])
        ids.append(tid)
        reply = tid
        print(f"post {i}: https://x.com/{me.data.username}/status/{tid}")
    print(json.dumps({"ok": True, "ids": ids}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
