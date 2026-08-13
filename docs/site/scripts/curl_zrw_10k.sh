#!/usr/bin/env bash
# Creator /lord — 1-line style test: 10k zeros → 8 B ZRW payload
# Usage: BASE=https://slidphilabs.fly.dev bash scripts/curl_zrw_10k.sh
set -euo pipefail
BASE="${BASE:-https://slidphilabs.fly.dev}"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
# 10000 int32 zeros = 40000 bytes
python3 -c "open('${TMP}/z.bin','wb').write(bytes(40000))"
echo "[1] POST ${BASE}/api/compress (40k raw zeros)…"
RESP=$(curl -sS -X POST "${BASE}/api/compress" \
  -H "content-type: application/octet-stream" \
  --data-binary @"${TMP}/z.bin")
echo "$RESP" | python3 -c "
import sys,json,base64
d=json.load(sys.stdin)
print('zrw_bytes', d.get('zrw_bytes'), 'mirror_error', d.get('mirror_error'), 'rt', d.get('roundtrip'))
assert d.get('ok'), d
assert d.get('zrw_bytes')==8, d
assert d.get('mirror_error')==0, d
open('${TMP}/p.b64','w').write(d['packed_b64'])
"
echo "[2] POST ${BASE}/api/decompress…"
curl -sS -X POST "${BASE}/api/decompress" \
  -H "content-type: application/json" \
  -d "{\"packed_b64\":\"$(cat ${TMP}/p.b64)\"}" | python3 -c "
import sys,json
d=json.load(sys.stdin)
print('n_ints', d.get('n_ints'), 'all_zeros', d.get('all_zeros'))
assert d.get('ok') and d.get('n_ints')==10000 and d.get('all_zeros')
print('OK — 10k zeros → 8 B → round-trip zeros')
"
