#!/usr/bin/env bash
# Poll DNS until www/apex point at Fly, then check certs + HTTP
set -euo pipefail
export FLY_API_TOKEN="${FLY_API_TOKEN:-$(grep '^FLY_API_TOKEN=' /home/cee/.env_secrets 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d "'")}"
FLY_IP="66.241.125.123"
for i in $(seq 1 60); do
  A_WWW=$(curl -sS "https://cloudflare-dns.com/dns-query?name=www.slidphilabs.com&type=A" -H "accept: application/dns-json" | python3 -c "import sys,json; j=json.load(sys.stdin); print(','.join(sorted(a['data'] for a in j.get('Answer') or [] if a.get('type')==1)))" 2>/dev/null || true)
  A_APEX=$(curl -sS "https://cloudflare-dns.com/dns-query?name=slidphilabs.com&type=A" -H "accept: application/dns-json" | python3 -c "import sys,json; j=json.load(sys.stdin); print(','.join(sorted(a['data'] for a in j.get('Answer') or [] if a.get('type')==1)))" 2>/dev/null || true)
  echo "[$i] www=$A_WWW apex=$A_APEX"
  if echo "$A_WWW" | grep -q "$FLY_IP" && echo "$A_APEX" | grep -q "$FLY_IP"; then
    echo "DNS flipped to Fly"
    fly certs check www.slidphilabs.com -a slidphilabs || true
    fly certs check slidphilabs.com -a slidphilabs || true
    sleep 5
    echo "www: $(curl -sS -o /dev/null -w '%{http_code}' -m 20 https://www.slidphilabs.com/ || true)"
    echo "apex: $(curl -sS -o /dev/null -w '%{http_code}' -m 20 https://slidphilabs.com/ || true)"
    exit 0
  fi
  sleep 30
done
echo "timeout waiting for DNS"
exit 1
