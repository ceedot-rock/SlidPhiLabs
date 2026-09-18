#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
OHD="$ROOT/ohd"
IN="$ROOT/testdata/hello.txt"
OUT="$ROOT/proof/hello.ohd"
RAW="$ROOT/proof/hello.raw"

if [[ ! -f "$IN" ]]; then
  mkdir -p "$ROOT/testdata"
  printf 'hello\n' > "$IN"
fi
mkdir -p "$ROOT/proof"

# Soft preflight: at least one seat resolvable
if ! "$OHD" compress "$IN" "$OUT" 2>"$ROOT/proof/compress.err"; then
  rc=$?
  cat "$ROOT/proof/compress.err" >&2 || true
  if grep -q "no seats available" "$ROOT/proof/compress.err" 2>/dev/null; then
    echo "prove.sh: no seats available (set SCOUT_LB / OHD_SCOUT and/or OHD_SNIPER or npcc on PATH)" >&2
    exit 2
  fi
  exit "$rc"
fi
"$OHD" decompress "$OUT" "$RAW"
cmp "$IN" "$RAW"
SEAT=$(python3 -c "import struct,json; b=open('$OUT','rb').read(); assert b[:4]==b'OHD1'; n=struct.unpack('>I',b[4:8])[0]; print(json.loads(b[8:8+n])['seat'])")
echo "PROOF_DECODE_OK_IDENTICAL seat=$SEAT"
