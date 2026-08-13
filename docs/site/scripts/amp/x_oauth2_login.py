#!/usr/bin/env python3
"""
X OAuth 2.0 PKCE login — get a USER access token that can post.

Why: Modern X portal often only shows Client ID + Client Secret (2 values).
Those alone cannot post. This script opens a browser login as @slidphilabs,
catches the callback on localhost, and saves tokens.

Prereqs in Developer Portal (User authentication settings):
  - OAuth 2.0 enabled
  - Type: Web App / Automated App or Bot
  - Callback URI: http://127.0.0.1:8787/callback
    (also add https://www.slidphilabs.com/x-oauth/callback if you want)
  - Website: https://www.slidphilabs.com
  - Permissions / scopes including tweet.write (Read and write)

Usage:
  python3 x_oauth2_login.py
  # or with env file:
  python3 x_oauth2_login.py /path/to/.env

Then:
  python3 x_oauth2_post.py "hello from slidphilabs"
"""

from __future__ import annotations

import base64
import hashlib
import json
import os
import re
import secrets
import sys
import threading
import time
import urllib.parse
import urllib.request
import webbrowser
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

AUTH_URL = "https://twitter.com/i/oauth2/authorize"
TOKEN_URL = "https://api.twitter.com/2/oauth2/token"
ME_URL = "https://api.twitter.com/2/users/me"
DEFAULT_REDIRECT = "http://127.0.0.1:8787/callback"
DEFAULT_SCOPES = "tweet.read tweet.write users.read offline.access"
TOKEN_PATH = Path.home() / ".config" / "slidphilabs" / "x_oauth2_tokens.json"
ENV_CANDIDATES = [
    Path("/home/cee/projects/midpoint-news-agency/.env"),
    Path("/home/cee/projects/SlidPhiLabs/.secrets/x_oauth2.env"),
]


def load_env(path: Path | None = None) -> dict[str, str]:
    out: dict[str, str] = {}
    paths = [path] if path else ENV_CANDIDATES
    for p in paths:
        if not p or not p.exists():
            continue
        for line in p.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            out[k.strip()] = v.strip().strip('"').strip("'")
    # process env wins
    out.update({k: v for k, v in os.environ.items() if k.startswith("X_")})
    return out


def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def pkce_pair() -> tuple[str, str]:
    verifier = b64url(secrets.token_bytes(32))
    challenge = b64url(hashlib.sha256(verifier.encode("ascii")).digest())
    return verifier, challenge


def basic_auth_header(client_id: str, client_secret: str) -> str:
    raw = f"{client_id}:{client_secret}".encode("utf-8")
    return "Basic " + base64.b64encode(raw).decode("ascii")


class CaptureHandler(BaseHTTPRequestHandler):
    code: str | None = None
    error: str | None = None
    state_expected: str = ""

    def log_message(self, fmt, *args):  # quiet
        return

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        qs = urllib.parse.parse_qs(parsed.query)
        if "error" in qs:
            CaptureHandler.error = qs.get("error", ["unknown"])[0]
            body = b"<h1>Auth failed</h1><p>You can close this tab.</p>"
            self.send_response(400)
        else:
            state = (qs.get("state") or [""])[0]
            code = (qs.get("code") or [""])[0]
            if state != CaptureHandler.state_expected:
                CaptureHandler.error = "state_mismatch"
                body = b"<h1>State mismatch</h1>"
                self.send_response(400)
            elif not code:
                CaptureHandler.error = "missing_code"
                body = b"<h1>Missing code</h1>"
                self.send_response(400)
            else:
                CaptureHandler.code = code
                body = (
                    b"<html><body style='font-family:system-ui;background:#050b16;"
                    b"color:#eef4fb;padding:40px'>"
                    b"<h1>Connected</h1>"
                    b"<p>@slidphilabs OAuth OK. You can close this tab and return to the terminal.</p>"
                    b"</body></html>"
                )
                self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def exchange_code(
    *,
    client_id: str,
    client_secret: str,
    code: str,
    redirect_uri: str,
    verifier: str,
) -> dict:
    data = urllib.parse.urlencode(
        {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": redirect_uri,
            "code_verifier": verifier,
            "client_id": client_id,
        }
    ).encode()
    req = urllib.request.Request(TOKEN_URL, data=data, method="POST")
    req.add_header("Content-Type", "application/x-www-form-urlencoded")
    # Confidential client: Basic auth with client secret
    req.add_header("Authorization", basic_auth_header(client_id, client_secret))
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())


def get_me(access_token: str) -> dict:
    req = urllib.request.Request(ME_URL)
    req.add_header("Authorization", f"Bearer {access_token}")
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())


def save_tokens(payload: dict) -> Path:
    TOKEN_PATH.parent.mkdir(parents=True, exist_ok=True)
    payload = dict(payload)
    payload["saved_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    TOKEN_PATH.write_text(json.dumps(payload, indent=2) + "\n")
    TOKEN_PATH.chmod(0o600)
    return TOKEN_PATH


def main() -> int:
    env_path = Path(sys.argv[1]) if len(sys.argv) > 1 else None
    env = load_env(env_path)
    client_id = (
        env.get("X_CLIENT_ID")
        or env.get("X_OAUTH2_CLIENT_ID")
        or env.get("CLIENT_ID")
        or ""
    ).strip()
    client_secret = (
        env.get("X_CLIENT_SECRET")
        or env.get("X_OAUTH2_CLIENT_SECRET")
        or env.get("CLIENT_SECRET")
        or ""
    ).strip()
    redirect = (
        env.get("X_OAUTH2_REDIRECT_URI") or DEFAULT_REDIRECT
    ).strip()
    scopes = (env.get("X_OAUTH2_SCOPES") or DEFAULT_SCOPES).strip()

    if not client_id or not client_secret:
        print("Missing X_CLIENT_ID / X_CLIENT_SECRET in env")
        return 1

    # Parse redirect host/port
    ru = urllib.parse.urlparse(redirect)
    host = ru.hostname or "127.0.0.1"
    port = ru.port or (443 if ru.scheme == "https" else 80)
    if host not in ("127.0.0.1", "localhost"):
        print(
            "This helper needs a localhost redirect so it can catch the code.\n"
            f"Current redirect: {redirect}\n"
            "In X Developer Portal → User authentication → Callback URI, ADD:\n"
            f"  {DEFAULT_REDIRECT}\n"
            "Then re-run. (Keep any https://www.slidphilabs.com/... URLs too.)"
        )
        return 1

    verifier, challenge = pkce_pair()
    state = secrets.token_urlsafe(16)
    CaptureHandler.state_expected = state
    CaptureHandler.code = None
    CaptureHandler.error = None

    params = {
        "response_type": "code",
        "client_id": client_id,
        "redirect_uri": redirect,
        "scope": scopes,
        "state": state,
        "code_challenge": challenge,
        "code_challenge_method": "S256",
    }
    url = AUTH_URL + "?" + urllib.parse.urlencode(params)

    server = HTTPServer((host, port), CaptureHandler)
    thread = threading.Thread(target=server.handle_request, daemon=True)
    thread.start()

    print("=== X OAuth 2.0 login (PKCE) ===")
    print()
    print("1) In the browser, make sure you are logged into @slidphilabs")
    print("2) Open this URL (or allow the browser to open it):")
    print()
    print(url)
    print()
    print(f"3) Approve access. Waiting on {redirect} ...")
    print()

    try:
        webbrowser.open(url)
    except Exception:
        pass

    thread.join(timeout=300)
    server.server_close()

    if CaptureHandler.error:
        print("Auth error:", CaptureHandler.error)
        return 1
    if not CaptureHandler.code:
        print("Timed out waiting for callback. Did you open the URL and approve?")
        return 1

    try:
        tokens = exchange_code(
            client_id=client_id,
            client_secret=client_secret,
            code=CaptureHandler.code,
            redirect_uri=redirect,
            verifier=verifier,
        )
    except Exception as e:
        print("Token exchange failed:", e)
        print(
            "Common causes: wrong client secret, callback URI mismatch, "
            "or app not allowed to request tweet.write."
        )
        return 1

    access = tokens.get("access_token")
    if not access:
        print("No access_token in response:", {k: tokens.get(k) for k in tokens})
        return 1

    path = save_tokens(tokens)
    print("Tokens saved:", path)

    try:
        me = get_me(access)
        u = (me.get("data") or {})
        print(f"Logged in as @{u.get('username')} (id={u.get('id')})")
        if str(u.get("username", "")).lower() != "slidphilabs":
            print("WARNING: not @slidphilabs — re-run while logged into the brand account")
    except Exception as e:
        print("get_me failed (token may still work for posts):", e)

    print()
    print("Next: post a test")
    print('  python3 x_oauth2_post.py "Compression that knows it is alive. https://www.slidphilabs.com"')
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
