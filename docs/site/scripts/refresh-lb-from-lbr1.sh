#!/usr/bin/env bash
# Copy rebuilt lb from an lbr1 checkout into docs/site/bin/ (gitignored).
# Kolmogorov repeat / walk_lcg seating requires lbr1 main with those peels merged.
set -euo pipefail
LBR1="${1:-${LBR1_DIR:-}}"
if [[ -z "${LBR1}" ]]; then
  echo "usage: $0 /path/to/lbr1" >&2
  exit 2
fi
SITE="$(cd "$(dirname "$0")/.." && pwd)"
echo "building lb in $LBR1 ..."
( cd "$LBR1" && cargo build -p splb --release --bin lb )
mkdir -p "$SITE/bin"
cp -f "$LBR1/target/release/lb" "$SITE/bin/lb"
chmod +x "$SITE/bin/lb"
echo "installed $SITE/bin/lb ($(wc -c < "$SITE/bin/lb") bytes)"
if [[ -n "${REPEAT_TEXT:-}" && -f "${REPEAT_TEXT}" ]]; then
  "$SITE/bin/lb" aware "$REPEAT_TEXT" /tmp/repeat_text_refresh.out
fi
if [[ -n "${REPEAT_JSON:-}" && -f "${REPEAT_JSON}" ]]; then
  "$SITE/bin/lb" aware "$REPEAT_JSON" /tmp/repeat_json_refresh.out
fi
if [[ -n "${WALK_S1:-}" && -f "${WALK_S1}" ]]; then
  "$SITE/bin/lb" aware "$WALK_S1" /tmp/walk_refresh_check.out
fi
echo "Ship: cd $SITE && fly deploy --remote-only --ha=false"
echo "Proof gate: /api/compress on periodic fixtures → program.model=repeat seated"
