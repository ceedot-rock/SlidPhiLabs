#!/bin/bash
set -e
cd "$(dirname "$0")"
BASE=https://raw.githubusercontent.com/ceedot-rock/SlidPhiLabs/main/packages/blackjack-compression
echo Fetching v4 b64 parts...
rm -f /tmp/bj.b64
for i in 0 1 2 3; do curl -fsSL "$BASE/b64/$i.txt" >> /tmp/bj.b64; done
base64 -d /tmp/bj.b64 > index.js
echo Wrote index.js $(wc -c < index.js) bytes
node -e "import('./index.js').then(m=>process.exit(m.selfTest()?0:1))"
echo OK
