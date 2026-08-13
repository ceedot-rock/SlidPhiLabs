#!/usr/bin/env python3
"""Post a tweet using OAuth 2.0 user token from x_oauth2_login.py"""

from __future__ import annotations

import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

TOKEN_PATH = Path.home() / ".config" / "slidphilabs" / "x_oauth2_tokens.json"
POST_URL = "https://api.twitter.com/2/tweets"
TOKEN_URL = "https://api.twitter.com/2/oauth2/token"
ENV_PATHS = [
    Path("/home/cee/projects/midpoint-news-agency/.env"),
    Path("/home/cee/projects/SlidPhiLabs/.secrets/x_oauth2.env"),
]


def load_env() -> dict[str, str]:
    out: dict[str, str] = {}
    for p in ENV_PATHS:
        if not p.exists():
            continue
        for line in p.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            out[k.strip()] = v.strip().strip('"').strip("'")
    return out


def load_tokens() -> dict:
    if not TOKEN_PATH.exists():
        raise SystemExit(f"No tokens at {TOKEN_PATH}. Run x_oauth2_login.py first.")
    return json.loads(TOKEN_PATH.read_text())


def save_tokens(t: dict) -> None:
    t = dict(t)
    t["saved_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    TOKEN_PATH.write_text(json.dumps(t, indent=2) + "\n")
    TOKEN_PATH.chmod(0o600)


def refresh_if_needed(tokens: dict) -> dict:
    # Best-effort refresh when we have refresh_token
    refresh = tokens.get("refresh_token")
    if not refresh:
        return tokens
    env = load_env()
    client_id = env.get("X_CLIENT_ID") or env.get("X_OAUTH2_CLIENT_ID") or ""
    client_secret = env.get("X_CLIENT_SECRET") or env.get("X_OAUTH2_CLIENT_SECRET") or ""
    if not client_id:
        return tokens
    import base64

    data = urllib.parse.urlencode(
        {
            "grant_type": "refresh_token",
            "refresh_token": refresh,
            "client_id": client_id,
        }
    ).encode()
    req = urllib.request.Request(TOKEN_URL, data=data, method="POST")
    req.add_header("Content-Type", "application/x-www-form-urlencoded")
    if client_secret:
        raw = f"{client_id}:{client_secret}".encode()
        req.add_header("Authorization", "Basic " + base64.b64encode(raw).decode())
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            new = json.loads(r.read().decode())
        # keep refresh if not rotated
        if "refresh_token" not in new and refresh:
            new["refresh_token"] = refresh
        save_tokens(new)
        return new
    except Exception:
        return tokens


def post_tweet(text: str, access_token: str) -> dict:
    body = json.dumps({"text": text}).encode()
    req = urllib.request.Request(POST_URL, data=body, method="POST")
    req.add_header("Authorization", f"Bearer {access_token}")
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        raise SystemExit(f"HTTP {e.code}: {err}") from e


def main() -> int:
    if len(sys.argv) < 2:
        print('Usage: python3 x_oauth2_post.py "your tweet text"')
        return 1
    text = " ".join(sys.argv[1:]).strip()
    if len(text) > 280:
        print(f"Too long ({len(text)} chars)")
        return 1
    tokens = load_tokens()
    tokens = refresh_if_needed(tokens)
    access = tokens.get("access_token")
    if not access:
        print("No access_token — run x_oauth2_login.py")
        return 1
    resp = post_tweet(text, access)
    tid = (resp.get("data") or {}).get("id")
    print("ok:", resp)
    if tid:
        print(f"https://x.com/i/web/status/{tid}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
