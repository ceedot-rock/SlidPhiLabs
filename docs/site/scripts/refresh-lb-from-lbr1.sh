#!/usr/bin/env bash
# Copy rebuilt lb from an lbr1 checkout into docs/site/bin/ (gitignored).
# Kolmogorov walk_lcg seating requires lbr1 main with walk_d1/walk_lcg merged.
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
if [[ -n "${WALK_S1:-}" && -f "${WALK_S1}" ]]; then
  "$SITE/bin/lb" aware "$WALK_S1" /tmp/walk_refresh_check.out
fi
echo "Ship: cd $SITE && fly deploy --remote-only --ha=false"
