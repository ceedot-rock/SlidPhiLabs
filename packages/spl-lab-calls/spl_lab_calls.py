"""One Python client for lab calls that already have an engine.

Each function POSTs to https://www.slidphilabs.com/v1/<path>.
HTTP 402 raises PaymentRequired. The body is the door's own 402.
Local binaries stay unmetered. This client does not add prices.

Override the host with LAB_CALLS_URL.
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request

# Python name -> URL path under the site origin.
PATHS = {
    "check": "/v1/check",
    "translate": "/v1/translate",
    "ingest": "/v1/ingest",
    "audit": "/v1/audit",
    "money": "/v1/money",
    "time": "/v1/time",
    "chain": "/v1/chain",
    "ship": "/v1/ship",
    "parity": "/v1/parity",
    "squeeze": "/v1/squeeze",
    "compress": "/v1/compress",
    "decompress": "/v1/decompress",
    "zip": "/v1/zip",
    "unzip": "/v1/unzip",
    "quote": "/v1/quote",
    "research": "/v1/research",
    "fetch": "/v1/fetch",
    "seal": "/v1/seal",
    "open": "/v1/open",
    "warrant_issue": "/v1/warrant/issue",
    "warrant_verify": "/v1/warrant/verify",
    "warrant_receipt": "/v1/warrant/receipt",
    "warrant_revoke": "/v1/warrant/revoke",
    "warrant_reserve": "/v1/warrant/reserve",
    "warrant_release": "/v1/warrant/release",
    "pcc_compress": "/v1/pcc-compress",
    "pcc_verify": "/v1/pcc-verify",
    "attest_notarize": "/v1/attest-notarize",
    "attest_exactness": "/v1/attest-exactness",
    "exactodds_draw": "/v1/exactodds-draw",
    "exactodds_resolve": "/v1/exactodds-resolve",
    "cuni_proof": "/v1/cuni-proof",
    "trustream_pack": "/v1/trustream-pack",
    "chamber_seal": "/v1/chamber-seal",
    "awlpay_quote": "/v1/awlpay-quote",
}

CALLS = tuple(PATHS)

# Published prices only. Meters that are not a flat per-call fee stay out.
PRICES_USD = {
    "check": "0.05",
    "translate": "0.10",
    "ingest": "0.10",
    "money": "0.25",
    "time": "0.25",
    "parity": "0.25",
    "chain": "0.50",
    "ship": "0.50",
    "audit": "1.00",
    "squeeze": "0.10",
    "fetch": "0.02",
    "pcc_verify": "0.02",
    "attest_notarize": "0.01",
    "attest_exactness": "0.05",
    "exactodds_draw": "0.01",
    "exactodds_resolve": "0.02",
    "cuni_proof": "0.10",
    "chamber_seal": "0.02",
    "awlpay_quote": "0.005",
}

DEFAULT_BASE = "https://www.slidphilabs.com"


class PaymentRequired(Exception):
    def __init__(self, body: dict, status: int = 402):
        self.body = body
        self.status = status
        super().__init__(body.get("refuse") or body.get("error") or body.get("message") or "payment required")


def base_url() -> str:
    return (os.environ.get("LAB_CALLS_URL") or DEFAULT_BASE).rstrip("/")


def endpoint(name: str, base: str | None = None) -> str:
    path = PATHS.get(name)
    if not path:
        raise ValueError(f"unknown call {name}")
    return f"{(base or base_url()).rstrip('/')}{path}"


def call(
    name: str,
    payload: dict | None = None,
    *,
    base: str | None = None,
    payment: str | None = None,
    api_key: str | None = None,
    merchant_key: str | None = None,
    timeout: int = 90,
) -> dict:
    headers = {"content-type": "application/json"}
    if payment:
        headers["X-PAYMENT"] = payment
        headers["Payment-Signature"] = payment
    if api_key:
        headers["Authorization"] = api_key if api_key.startswith("Bearer ") else f"Bearer {api_key}"
    if merchant_key:
        headers["X-Merchant-Key"] = merchant_key
    req = urllib.request.Request(
        endpoint(name, base),
        data=json.dumps(payload or {}).encode("utf-8"),
        headers=headers,
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            raw = response.read()
            body = json.loads(raw.decode("utf-8") or "{}")
            if not isinstance(body, dict):
                return {"status": response.status, "raw": body}
            body.setdefault("status", response.status)
            return body
    except urllib.error.HTTPError as err:
        raw = err.read().decode("utf-8")
        try:
            body = json.loads(raw or "{}")
        except json.JSONDecodeError:
            body = {"raw": raw}
        if not isinstance(body, dict):
            body = {"raw": body}
        body.setdefault("status", err.code)
        if err.code == 402:
            raise PaymentRequired(body) from None
        return body


def _bind(name: str):
    def fn(payload: dict | None = None, **kwargs) -> dict:
        return call(name, payload, **kwargs)

    fn.__name__ = name
    fn.__doc__ = f"POST {PATHS[name]}"
    return fn


for _name in CALLS:
    globals()[_name] = _bind(_name)

__all__ = ["CALLS", "PATHS", "PRICES_USD", "PaymentRequired", "base_url", "endpoint", "call", *CALLS]
