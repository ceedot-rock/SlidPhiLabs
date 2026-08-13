#!/usr/bin/env bash
# x_verify_auth.sh — smoke-test OAuth1 user context (no post)
# Loads midpoint .env; never prints secret values.
set -euo pipefail
ENV_FILE="${1:-/home/cee/projects/midpoint-news-agency/.env}"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "No env file: $ENV_FILE"
  exit 1
fi
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a
export X_ACCESS_SECRET="${X_ACCESS_SECRET:-${X_ACCESS_TOKEN_SECRET:-}}"

need=(X_API_KEY X_API_SECRET X_ACCESS_TOKEN X_ACCESS_SECRET)
miss=()
for k in "${need[@]}"; do
  if [[ -z "${!k:-}" ]]; then miss+=("$k"); fi
done
if ((${#miss[@]})); then
  echo "Missing: ${miss[*]}"
  echo "See scripts/amp/X_AUTH_HOW_TO.md"
  exit 1
fi

cd /home/cee/projects/midpoint-news-agency
export PYTHONPATH=src
.venv/bin/python <<'PY'
import os, sys
try:
    import tweepy
except ImportError:
    print("tweepy missing — run: .venv/bin/pip install tweepy")
    sys.exit(1)

client = tweepy.Client(
    consumer_key=os.environ["X_API_KEY"],
    consumer_secret=os.environ["X_API_SECRET"],
    access_token=os.environ["X_ACCESS_TOKEN"],
    access_token_secret=os.environ["X_ACCESS_SECRET"],
)
try:
    me = client.get_me(user_auth=True)
    if me.data is None:
        print("ok: false")
        print("error: empty user (check Read+Write + regenerate access token)")
        sys.exit(1)
    u = me.data
    print("ok: true")
    print(f"user_id: {u.id}")
    print(f"username: @{u.username}")
    print(f"name: {u.name}")
    if str(u.username).lower() != "slidphilabs":
        print("WARN: not @slidphilabs — posts will go to this account")
    print("Auth works. Safe to enable MIDPOINT_X_POSTING=1 and post.")
except Exception as e:
    print("ok: false")
    print(f"error: {e}")
    print()
    print("Most common fix:")
    print("  1) developer.x.com → App → User auth → Read and write")
    print("  2) Keys and tokens → Regenerate Access Token + Secret")
    print("  3) Paste all four into midpoint .env")
    print("  4) Re-run this script")
    print("Full guide: docs/site/scripts/amp/X_AUTH_HOW_TO.md")
    sys.exit(1)
PY
