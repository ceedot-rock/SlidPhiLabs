#!/usr/bin/env python3
"""
OAuth 1.0a PIN (out-of-band) login — no callback URL needed.

Flow:
  1) python3 x_oauth1_pin_login.py          → prints authorize URL
  2) You open URL as @slidphilabs, allow app, copy PIN
  3) python3 x_oauth1_pin_login.py --pin 1234567
  4) Access tokens saved; can post with x_oauth1_post_thread.py

Requires in env: X_API_KEY + X_API_SECRET (Consumer Key/Secret from portal).
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

REQUEST_TOKEN_URL = "https://api.twitter.com/oauth/request_token"
AUTHORIZE_URL = "https://api.twitter.com/oauth/authorize"
ACCESS_TOKEN_URL = "https://api.twitter.com/oauth/access_token"
PENDING = Path.home() / ".config" / "slidphilabs" / "x_oauth1_pin_pending.json"
TOKENS = Path.home() / ".config" / "slidphilabs" / "x_oauth1_tokens.json"
ENV_PATHS = [
    Path("/home/cee/projects/midpoint-news-agency/.env"),
    Path("/home/cee/projects/SlidPhiLabs/.secrets/x_oauth1.env"),
]


def load_env():
    for p in ENV_PATHS:
        if not p.exists():
            continue
        for line in p.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def upsert_env(path: Path, updates: dict):
    text = path.read_text() if path.exists() else ""
    lines = text.splitlines()
    keys = set(updates)
    out = []
    seen = set()
    for line in lines:
        if "=" in line and not line.strip().startswith("#"):
            k = line.split("=", 1)[0].strip()
            if k in keys:
                out.append(f"{k}={updates[k]}")
                seen.add(k)
                continue
        out.append(line)
    for k, v in updates.items():
        if k not in seen:
            out.append(f"{k}={v}")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(out).rstrip() + "\n")
    path.chmod(0o600)


def main():
    load_env()
    ap = argparse.ArgumentParser()
    ap.add_argument("--pin", help="PIN from X after authorize")
    args = ap.parse_args()

    ck = os.getenv("X_API_KEY") or os.getenv("X_CONSUMER_KEY")
    cs = os.getenv("X_API_SECRET") or os.getenv("X_CONSUMER_SECRET")
    if not ck or not cs:
        print("Need X_API_KEY and X_API_SECRET (Consumer Key/Secret) in .env")
        print("From portal: Keys and tokens → API Key + API Key Secret")
        return 1

    try:
        from requests_oauthlib import OAuth1Session
    except ImportError:
        print("Install: pip install requests-oauthlib")
        return 1

    PENDING.parent.mkdir(parents=True, exist_ok=True)

    if not args.pin:
        oauth = OAuth1Session(ck, client_secret=cs, callback_uri="oob")
        try:
            fetch = oauth.fetch_request_token(REQUEST_TOKEN_URL)
        except Exception as e:
            print("request_token failed:", e)
            print("Often: app is Read-only, or Consumer keys wrong, or API access level blocks OAuth1.")
            return 1
        rt = fetch.get("oauth_token")
        rts = fetch.get("oauth_token_secret")
        PENDING.write_text(json.dumps({"oauth_token": rt, "oauth_token_secret": rts}, indent=2))
        PENDING.chmod(0o600)
        url = f"{AUTHORIZE_URL}?oauth_token={rt}"
        print("=== PIN login step 1/2 ===")
        print()
        print("1) Log into X as @slidphilabs")
        print("2) Open this URL:")
        print()
        print(url)
        print()
        print("3) Click Authorize / Allow")
        print("4) X shows a PIN (numbers). Copy it.")
        print("5) Tell the engineer the PIN, or run:")
        print(f"   python3 x_oauth1_pin_login.py --pin YOUR_PIN")
        return 0

    if not PENDING.exists():
        print("No pending request token. Run without --pin first.")
        return 1
    pending = json.loads(PENDING.read_text())
    oauth = OAuth1Session(
        ck,
        client_secret=cs,
        resource_owner_key=pending["oauth_token"],
        resource_owner_secret=pending["oauth_token_secret"],
        verifier=str(args.pin).strip(),
    )
    try:
        tokens = oauth.fetch_access_token(ACCESS_TOKEN_URL)
    except Exception as e:
        print("access_token failed:", e)
        print("PIN wrong/expired, or app not Read and write. Re-run step 1.")
        return 1

    access = tokens.get("oauth_token")
    secret = tokens.get("oauth_token_secret")
    screen = tokens.get("screen_name")
    user_id = tokens.get("user_id")
    print(f"OK @{screen} id={user_id}")

    TOKENS.write_text(
        json.dumps(
            {
                "oauth_token": access,
                "oauth_token_secret": secret,
                "screen_name": screen,
                "user_id": user_id,
            },
            indent=2,
        )
        + "\n"
    )
    TOKENS.chmod(0o600)

    # write into midpoint .env for posting scripts
    upsert_env(
        Path("/home/cee/projects/midpoint-news-agency/.env"),
        {
            "X_API_KEY": ck,
            "X_API_SECRET": cs,
            "X_ACCESS_TOKEN": access,
            "X_ACCESS_SECRET": secret,
            "X_ACCESS_TOKEN_SECRET": secret,
        },
    )
    upsert_env(
        Path("/home/cee/projects/SlidPhiLabs/.secrets/x_oauth1.env"),
        {
            "X_API_KEY": ck,
            "X_API_SECRET": cs,
            "X_ACCESS_TOKEN": access,
            "X_ACCESS_SECRET": secret,
        },
    )
    try:
        PENDING.unlink()
    except OSError:
        pass
    print("Tokens saved. Next: python3 x_oauth1_post_thread.py")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
