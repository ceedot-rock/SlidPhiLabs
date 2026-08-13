#!/usr/bin/env bash
# slid_verify_deploy.sh — Slid Phi Labs post-deploy pulse check
# Usage: ./slid_verify_deploy.sh [base_url]
# Default: https://www.slidphilabs.com
# Requires: curl, python3 (no jq)
set -uo pipefail
BASE="${1:-https://www.slidphilabs.com}"
PASS=0
FAIL=0
FAILS=()

check() {
  local name="$1"
  shift
  if "$@" &>/dev/null; then
    echo "✅ $name"
    PASS=$((PASS + 1))
  else
    echo "❌ $name"
    FAIL=$((FAIL + 1))
    FAILS+=("$name")
  fi
}

http_code() {
  curl -sS -o /dev/null -w '%{http_code}' --max-time 20 "$1"
}

body_has() {
  # body_has URL REGEX
  python3 - "$1" "$2" <<'PY'
import sys, urllib.request, re
url, pat = sys.argv[1], sys.argv[2]
try:
    with urllib.request.urlopen(url, timeout=20) as r:
        text = r.read().decode("utf-8", "replace")
    sys.exit(0 if re.search(pat, text, re.I | re.S) else 1)
except Exception:
    sys.exit(1)
PY
}

body_not_has() {
  python3 - "$1" "$2" <<'PY'
import sys, urllib.request, re
url, pat = sys.argv[1], sys.argv[2]
try:
    with urllib.request.urlopen(url, timeout=20) as r:
        text = r.read().decode("utf-8", "replace")
    sys.exit(0 if not re.search(pat, text, re.I | re.S) else 1)
except Exception:
    sys.exit(1)
PY
}

json_ok() {
  python3 - "$1" <<'PY'
import sys, urllib.request, json
url = sys.argv[1]
try:
    with urllib.request.urlopen(url, timeout=20) as r:
        json.load(r)
    sys.exit(0)
except Exception:
    sys.exit(1)
PY
}

metrics_alive() {
  python3 - "$1" <<'PY'
import sys, urllib.request, json
url = sys.argv[1].rstrip("/") + "/api/phi/metrics"
try:
    with urllib.request.urlopen(url, timeout=20) as r:
        d = json.load(r)
    sys.exit(0 if d.get("alive") is True else 1)
except Exception:
    sys.exit(1)
PY
}

header_has() {
  python3 - "$1" "$2" <<'PY'
import sys, urllib.request
url, key = sys.argv[1], sys.argv[2].lower()
try:
    req = urllib.request.Request(url, method="HEAD")
    with urllib.request.urlopen(req, timeout=20) as r:
        headers = {k.lower(): v for k, v in r.headers.items()}
    # fallback GET if HEAD thin
    if key not in headers:
        with urllib.request.urlopen(url, timeout=20) as r:
            headers = {k.lower(): v for k, v in r.headers.items()}
    sys.exit(0 if key in headers else 1)
except Exception:
    sys.exit(1)
PY
}

echo "=== Slid Phi Labs Deploy Pulse — $BASE ==="
echo "Timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo

check "Homepage 200" bash -c "[[ \$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 '$BASE/') == 200 ]]"
check "Standings 200" bash -c "[[ \$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 '$BASE/standings') == 200 ]]"
check "Humans door 200" bash -c "[[ \$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 '$BASE/humans') == 200 ]]"
check "Agents door 200" bash -c "[[ \$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 '$BASE/agents') == 200 ]]"

check "Standings.json present" json_ok "$BASE/standings.json"
check "Metrics endpoint alive" metrics_alive "$BASE"
check "Flagship 8 B claim on homepage" body_has "$BASE/" '8\s*B|8B'
check "Alive tagline present" body_has "$BASE/" 'knows it is alive|compression that knows'
check "Hero CTAs (Try free web)" body_has "$BASE/" 'Try free web'
check "Hero CTAs (See standings)" body_has "$BASE/" 'See standings'
check "Hero CTAs (Quote suite)" body_has "$BASE/" 'Quote suite'
check "Proof bar markup" body_has "$BASE/" 'slid-proof'
check "Standings bootstrap (first paint)" body_has "$BASE/standings" 'standings-bootstrap'
check "Standings no Loading skeleton" body_not_has "$BASE/standings" 'Loading standings…'
check "Standings proof title" body_has "$BASE/standings" 'Proof that breathes'
check "Humans 8 B parity" body_has "$BASE/humans" '8\s*B|8B'
check "Agents 8 B parity" body_has "$BASE/agents" '8\s*B|8B'
check "X-Slid-Engine header" header_has "$BASE/" "x-slid-engine"
check "X-Slid-Flagship header" header_has "$BASE/" "x-slid-flagship"

# Metrics movement
read -r M1 M2 <<EOF2
$(python3 - "$BASE" <<'PY'
import urllib.request, json, time, sys
base = sys.argv[1].rstrip("/")
def cycles():
    with urllib.request.urlopen(base + "/api/phi/metrics", timeout=20) as r:
        return json.load(r).get("cycles", 0)
c1 = cycles()
time.sleep(0.8)
c2 = cycles()
print(c1, c2)
sys.exit(0 if c2 >= c1 else 1)
PY
)
EOF2
if [[ "${M2:-0}" -ge "${M1:-1}" ]]; then
  echo "✅ Metrics cycles move ($M1 → $M2)"
  PASS=$((PASS + 1))
else
  echo "❌ Metrics cycles move ($M1 → ${M2:-?})"
  FAIL=$((FAIL + 1))
  FAILS+=("Metrics cycles move")
fi

echo
echo "=== Results: $PASS passed, $FAIL failed ==="
if [ "$FAIL" -gt 0 ]; then
  echo "Site is not yet at war footing. Hotfix required."
  printf '  - %s\n' "${FAILS[@]}"
  exit 1
else
  echo "Site is breathing. Amplify."
  exit 0
fi
