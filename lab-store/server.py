#!/usr/bin/env python3
"""Lab agent store. Nine CuNi calls plus squeeze. Receipt or refuse. No 501 stubs.

check, translate, ingest, audit, money, time, chain, ship, parity.
Hosted calls bill through x402 when LAB_REQUIRE_PAY=1. The local CLI does not.
"""

from __future__ import annotations

import base64
import binascii
import hashlib
import json
import os
import re
import shutil
import subprocess
import tempfile
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent
PORT = int(os.environ.get("PORT", "8788"))
HOST = os.environ.get("HOST", "0.0.0.0")
TIMEOUT = int(os.environ.get("LAB_AGENT_TIMEOUT", "90"))
MAX_SOURCE = int(os.environ.get("LAB_AGENT_MAX_SOURCE", "200000"))
MAX_BODY = int(os.environ.get("LAB_AGENT_MAX_BODY", "1048576"))
MAX_DEPOSIT_BYTES = int(os.environ.get("LAB_AGENT_MAX_DEPOSIT", str(MAX_SOURCE)))
SHA256_RE = re.compile(r"^[0-9a-f]{64}$")
CUNI = os.environ.get("CUNI_BIN") or shutil.which("cuni") or "/usr/local/bin/cuni"
PCCX = os.environ.get("PCCX_BIN") or shutil.which("pccx") or "/usr/local/bin/pccx"
PIN_CHECK = os.environ.get("PIN_CHECK", "v0.1.10")
PIN_BANK = os.environ.get("PIN_BANK", "cuni-bank-0.1.0")
PIN_PCCX = os.environ.get("PIN_PCCX", "e72528b")
PIN_CALLS = os.environ.get("PIN_CALLS", "0.10.0")
PAY_URL = os.environ.get("LAB_PAY_URL", "https://www.slidphilabs.com/api/agent")
X402_URL = os.environ.get("LAB_X402_URL", "https://www.slidphilabs.com/api/x402-products")
REQUIRE_PAY = os.environ.get("LAB_REQUIRE_PAY", "0").strip() in ("1", "true", "yes")
DEPOSIT_DIR = Path(os.environ.get("LAB_DEPOSIT_DIR", "/tmp/lab-deposits"))
VERB_SKU = {
    "check": "lab-check",
    "translate": "lab-translate",
    "squeeze": "lab-squeeze",
    "ingest": "lab-ingest",
    "audit": "lab-audit",
    "money": "lab-money",
    "time": "lab-time",
    "chain": "lab-chain",
    "ship": "lab-ship",
    "parity": "lab-parity",
}
PAID_VERBS = tuple(VERB_SKU)
MONEY_SEATS = "py,rs,go,java,sql"
TIME_SEATS = "py,go,js,c,cpp,rs,java,sql"
SHIP_SEATS = "c,rs"
PARITY_SEATS = "py,rs,c,go,sql"
INGEST_FROM = {"py", "go", "js", "ts", "c", "cpp", "rs", "awk", "pl", "sh", "sql", "wat", "cuni"}
AUDIT_EXT = {"py", "js", "mjs", "go", "rs", "java", "sql"}
CHAIN_TARGETS = (
    ("sol", "--emit-sol", "out.sol"),
    ("solana", "--emit-solana", "out_solana.rs"),
    ("ink", "--emit-ink", "out_ink.rs"),
    ("move", "--emit-move", "out.move"),
    ("vyper", "--emit-vyper", "out.vy"),
    ("cairo", "--emit-cairo", "out.cairo"),
    ("clarity", "--emit-clarity", "out.clar"),
    ("cadence", "--emit-cadence", "out.cdc"),
)


class PayloadTooLarge(ValueError):
    """The request or decoded payload is larger than this store accepts."""


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def normalize_hash(value: object) -> str:
    """Return a lowercase SHA-256 hex digest, or "" for anything else."""
    h = str(value or "").strip().lower()
    return h if SHA256_RE.fullmatch(h) else ""


def decode_b64(value: object) -> bytes:
    """Decode strict base64 and cap the result before it reaches a verb."""
    if not isinstance(value, str):
        raise ValueError("data_b64 must be a string")
    try:
        raw = base64.b64decode(value, validate=True)
    except (binascii.Error, ValueError) as e:
        raise ValueError("invalid base64") from e
    if len(raw) > MAX_SOURCE:
        raise PayloadTooLarge(f"payload too large (max {MAX_SOURCE} bytes)")
    return raw


def run(cmd: list[str], timeout: int = TIMEOUT) -> subprocess.CompletedProcess[str]:
    return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)


def receipt(**kw) -> dict:
    out = {k: v for k, v in kw.items() if v is not None}
    for k in ("verb", "ok", "source_hash", "pin"):
        if k not in out:
            raise ValueError(f"receipt missing {k}")
    # LAB20 #8: refuse is not a retry. Callers set retry=True only on 5xx.
    out.setdefault("retry", False)
    return out


def payment_header(handler: BaseHTTPRequestHandler) -> str:
    return (
        handler.headers.get("X-PAYMENT")
        or handler.headers.get("Payment-Signature")
        or handler.headers.get("PAYMENT-SIGNATURE")
        or ""
    ).strip()


def x402_challenge(verb: str) -> dict:
    sku = VERB_SKU[verb]
    try:
        with urllib.request.urlopen(f"{X402_URL}?sku={sku}", timeout=15) as r:
            j = json.loads(r.read())
        reqs = j.get("sample_402") or {}
        return {"sku": sku, "accepts": reqs.get("accepts") or [], "x402Version": reqs.get("x402Version") or 1}
    except Exception:
        return {"sku": sku, "accepts": [], "x402Version": 1}


def x402_verify(verb: str, header: str) -> tuple[int, dict]:
    sku = VERB_SKU[verb]
    req = urllib.request.Request(
        X402_URL,
        data=json.dumps({"sku": sku, "note": f"lab-agent {verb}"}).encode(),
        headers={"Content-Type": "application/json", "X-PAYMENT": header},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=45) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        try:
            body = json.loads(e.read())
        except Exception:
            body = {"error": str(e)}
        return e.code, body
    except Exception as e:
        return 503, {"ok": False, "error": str(e)}


def paywall(verb: str, pin: str) -> dict:
    ch = x402_challenge(verb)
    return receipt(
        verb=verb,
        ok=False,
        source_hash="",
        pin=pin,
        refuse="payment required",
        pay=PAY_URL,
        sku=ch["sku"],
        x402Version=ch["x402Version"],
        accepts=ch["accepts"] or None,
        retry=False,
    )


def deposit_put(source_hash: str, blob: bytes) -> dict:
    """LAB20 #7/#18: a second copy is only a copy if source_hash matches."""
    got = sha256(blob)
    if not source_hash:
        return receipt(
            verb="deposit",
            ok=False,
            source_hash=got,
            pin="lab20-7",
            refuse="replicate without source_hash is a new object",
            retry=False,
        )
    if normalize_hash(source_hash) != got:
        return receipt(
            verb="deposit",
            ok=False,
            source_hash=got,
            pin="lab20-7",
            refuse="hash mismatch — this is a new object",
            retry=False,
        )
    if len(blob) > MAX_DEPOSIT_BYTES:
        return receipt(
            verb="deposit",
            ok=False,
            source_hash=got,
            pin="lab20-7",
            refuse=f"deposit too large (max {MAX_DEPOSIT_BYTES} bytes)",
            retry=False,
        )
    DEPOSIT_DIR.mkdir(parents=True, exist_ok=True)
    dest = DEPOSIT_DIR / got
    fd, tmp_name = tempfile.mkstemp(prefix=f".{got}.", dir=DEPOSIT_DIR)
    try:
        with os.fdopen(fd, "wb") as tmp:
            tmp.write(blob)
        os.replace(tmp_name, dest)
    except BaseException:
        Path(tmp_name).unlink(missing_ok=True)
        raise
    return receipt(
        verb="deposit",
        ok=True,
        source_hash=got,
        pin="lab20-7",
        bytes=len(blob),
        retry=False,
    )


def deposit_get(source_hash: str) -> dict:
    h = normalize_hash(source_hash)
    base = DEPOSIT_DIR.resolve()
    path = (base / h) if h else None
    if not h or path is None or not path.is_file():
        return receipt(
            verb="deposit",
            ok=False,
            source_hash=h,
            pin="lab20-18",
            refuse="no deposit for this source_hash",
            retry=False,
        )
    resolved = path.resolve()
    if resolved.parent != base or resolved.stat().st_size > MAX_DEPOSIT_BYTES:
        return receipt(
            verb="deposit",
            ok=False,
            source_hash=h,
            pin="lab20-18",
            refuse="no deposit for this source_hash",
            retry=False,
        )
    raw = resolved.read_bytes()
    return receipt(
        verb="deposit",
        ok=True,
        source_hash=h,
        pin="lab20-18",
        bytes=len(raw),
        data_b64=base64.b64encode(raw).decode("ascii"),
        retry=False,
    )


def do_check(source: str) -> dict:
    raw = source.encode("utf-8")
    h = sha256(raw)
    with tempfile.TemporaryDirectory(prefix="lab-check-") as td:
        p = Path(td) / "n.cuni"
        p.write_text(source, encoding="utf-8")
        r = run([CUNI, "check", str(p), "--only", "py,go,js", "--timeout", "60"])
        ok = r.returncode == 0 and "exactness: PASS" in (r.stdout or "")
        return receipt(
            verb="check",
            ok=ok,
            source_hash=h,
            pin=PIN_CHECK,
            stdout=(r.stdout or "").strip(),
            refuse=None if ok else ((r.stderr or r.stdout or "check refuse").strip()),
        )


def do_translate(source: str, frm: str, to: str) -> dict:
    raw = source.encode("utf-8")
    h = sha256(raw)
    frm = (frm or "py").strip().lower()
    to = (to or "js").strip().lower()
    with tempfile.TemporaryDirectory(prefix="lab-bank-") as td:
        ext = "cuni" if frm == "cuni" else "py"
        inp = Path(td) / f"n.{ext}"
        outp = Path(td) / "emit.out"
        inp.write_text(source, encoding="utf-8")
        r = run(
            [CUNI, "bank", "paste", str(inp), "--from", frm, "--to", to, "-o", str(outp)]
        )
        artifact = outp.read_text(encoding="utf-8") if outp.is_file() else ""
        ok = r.returncode == 0 and "bank: PASS" in (r.stdout or "")
        return receipt(
            verb="translate",
            ok=ok,
            source_hash=h,
            pin=PIN_BANK,
            from_lang=frm,
            to=to,
            artifact=artifact,
            summary=(r.stdout or "").strip(),
            refuse=None if ok else ((r.stderr or r.stdout or "bank refuse").strip()),
        )


def do_squeeze(data: bytes) -> dict:
    h = sha256(data)
    if not Path(PCCX).is_file():
        return receipt(
            verb="squeeze",
            ok=False,
            source_hash=h,
            pin=PIN_PCCX,
            refuse="pccx binary missing",
        )
    with tempfile.TemporaryDirectory(prefix="lab-pccx-") as td:
        inp = Path(td) / "in.bin"
        outp = Path(td) / "out.bin"
        inp.write_bytes(data)
        r = run([PCCX, "encode", str(inp), str(outp)])
        packed = outp.read_bytes() if outp.is_file() else b""
        ok = r.returncode == 0 and packed and len(packed) < len(data)
        if r.returncode == 0 and packed and len(packed) >= len(data):
            return receipt(
                verb="squeeze",
                ok=False,
                source_hash=h,
                pin=PIN_PCCX,
                refuse="never-expand: packed ≥ raw",
                raw_bytes=len(data),
                packed_bytes=len(packed),
            )
        return receipt(
            verb="squeeze",
            ok=ok,
            source_hash=h,
            pin=PIN_PCCX,
            raw_bytes=len(data),
            packed_bytes=len(packed) if packed else 0,
            packed_b64=base64.b64encode(packed).decode("ascii") if ok else None,
            stdout=(r.stdout or "").strip(),
            refuse=None if ok else ((r.stderr or r.stdout or "pccx refuse").strip()),
        )


def _pin(verb: str) -> str:
    if verb == "check":
        return PIN_CHECK
    if verb == "translate":
        return PIN_BANK
    if verb == "squeeze":
        return PIN_PCCX
    return PIN_CALLS


def _need_source(verb: str, data: dict) -> tuple[str | None, dict | None]:
    source = data.get("source")
    if not isinstance(source, str) or not source.strip():
        return None, receipt(verb=verb, ok=False, source_hash="", pin=_pin(verb), refuse="missing source")
    if len(source) > MAX_SOURCE:
        return None, receipt(verb=verb, ok=False, source_hash="", pin=_pin(verb), refuse="source too large")
    return source, None


def _json_stdout(stdout: str):
    text = (stdout or "").strip()
    if not text:
        return None
    try:
        got = json.loads(text)
    except json.JSONDecodeError:
        return None
    return got if isinstance(got, dict) else None


def do_gate(verb: str, source: str, seats: str) -> dict:
    h = sha256(source.encode("utf-8"))
    with tempfile.TemporaryDirectory(prefix=f"lab-{verb}-") as td:
        path = Path(td) / "n.cuni"
        path.write_text(source, encoding="utf-8")
        r = run([CUNI, "check", str(path), "--only", seats, "--json", "--timeout", str(TIMEOUT)])
        ok = r.returncode == 0
        return receipt(
            verb=verb,
            ok=ok,
            source_hash=h,
            pin=PIN_CALLS,
            seats=seats,
            check=_json_stdout(r.stdout),
            stdout=None if ok else (r.stdout or "").strip()[:4000],
            refuse=None if ok else ((r.stderr or r.stdout or f"{verb} refuse").strip()[:4000]),
        )


def do_ingest(source: str, frm: str) -> dict:
    frm = (frm or "py").strip().lower().lstrip(".")
    h = sha256(source.encode("utf-8"))
    if frm not in INGEST_FROM:
        return receipt(verb="ingest", ok=False, source_hash=h, pin=PIN_CALLS, refuse=f"from {frm} is not an ingest seat")
    ext = "py" if frm == "cuni" else frm
    with tempfile.TemporaryDirectory(prefix="lab-ingest-") as td:
        path = Path(td) / f"n.{ext}"
        path.write_text(source, encoding="utf-8")
        r = run([CUNI, "ingest", str(path)])
        artifact = r.stdout or ""
        ok = r.returncode == 0 and bool(artifact.strip())
        return receipt(
            verb="ingest",
            ok=ok,
            source_hash=h,
            pin=PIN_CALLS,
            from_lang=frm,
            artifact=artifact if ok else None,
            refuse=None if ok else ((r.stderr or r.stdout or "ingest refuse").strip()[:4000]),
        )


def do_audit(source: str, against: str, ext: str) -> dict:
    ext = (ext or "py").strip().lower().lstrip(".")
    h = sha256((source + "\n" + against).encode("utf-8"))
    if not isinstance(against, str) or not against.strip():
        return receipt(verb="audit", ok=False, source_hash=h, pin=PIN_CALLS, refuse="missing against")
    if len(against) > MAX_SOURCE:
        return receipt(verb="audit", ok=False, source_hash=h, pin=PIN_CALLS, refuse="against too large")
    if ext not in AUDIT_EXT:
        return receipt(verb="audit", ok=False, source_hash=h, pin=PIN_CALLS, refuse=f"against_ext {ext} is not runnable")
    with tempfile.TemporaryDirectory(prefix="lab-audit-") as td:
        law = Path(td) / "law.cuni"
        impl = Path(td) / f"impl.{ext}"
        law.write_text(source, encoding="utf-8")
        impl.write_text(against, encoding="utf-8")
        r = run([CUNI, "audit", str(law), "--against", str(impl)])
        ok = r.returncode == 0
        return receipt(
            verb="audit",
            ok=ok,
            source_hash=h,
            pin=PIN_CALLS,
            against_ext=ext,
            audit=_json_stdout(r.stdout),
            refuse=None if ok else ((r.stderr or r.stdout or "audit refuse").strip()[:4000]),
        )


def do_chain(source: str, to: str) -> dict:
    h = sha256(source.encode("utf-8"))
    known = {item[0] for item in CHAIN_TARGETS}
    names = [part.strip() for part in (to or "").split(",") if part.strip()] or [item[0] for item in CHAIN_TARGETS]
    bad = [name for name in names if name not in known]
    if bad:
        return receipt(verb="chain", ok=False, source_hash=h, pin=PIN_CALLS, refuse="unknown chain target: " + ",".join(bad))
    with tempfile.TemporaryDirectory(prefix="lab-chain-") as td:
        path = Path(td) / "n.cuni"
        path.write_text(source, encoding="utf-8")
        artifacts = {}
        for target, flag, filename in CHAIN_TARGETS:
            if target not in names:
                continue
            out = Path(td) / filename
            r = run([CUNI, str(path), flag, str(out)])
            text = out.read_text(encoding="utf-8") if out.is_file() else ""
            if r.returncode != 0 or not text.strip():
                return receipt(
                    verb="chain",
                    ok=False,
                    source_hash=h,
                    pin=PIN_CALLS,
                    target=target,
                    refuse=((r.stderr or r.stdout or f"{target} emit refuse").strip()[:4000]),
                )
            artifacts[target] = text
        gate = run([CUNI, "check", str(path), "--only", "py", "--json", "--timeout", str(TIMEOUT)])
        ok = gate.returncode == 0
        return receipt(
            verb="chain",
            ok=ok,
            source_hash=h,
            pin=PIN_CALLS,
            targets=list(artifacts),
            artifacts=artifacts if ok else None,
            check=_json_stdout(gate.stdout),
            refuse=None if ok else ((gate.stderr or gate.stdout or "chain proof refuse").strip()[:4000]),
        )


def read_json(handler: BaseHTTPRequestHandler) -> dict:
    try:
        n = int(handler.headers.get("Content-Length") or "0")
    except (TypeError, ValueError):
        raise ValueError("invalid Content-Length")
    if n < 0:
        raise ValueError("invalid Content-Length")
    if n > MAX_BODY:
        raise PayloadTooLarge(f"request body too large (max {MAX_BODY} bytes)")
    raw = handler.rfile.read(n) if n else b"{}"
    if n and len(raw) != n:
        raise ValueError("incomplete request body")
    try:
        data = json.loads(raw.decode("utf-8") or "{}")
    except (UnicodeDecodeError, json.JSONDecodeError):
        raise ValueError("invalid JSON")
    if not isinstance(data, dict):
        raise ValueError("JSON object required")
    return data


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt: str, *args) -> None:
        sys_stderr = __import__("sys").stderr
        sys_stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    def _send(self, code: int, body: dict | bytes, ctype: str = "application/json", extra: dict | None = None) -> None:
        if isinstance(body, dict):
            payload = json.dumps(body).encode("utf-8")
        else:
            payload = body
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Cache-Control", "no-store")
        if extra:
            for k, v in extra.items():
                if v is not None:
                    self.send_header(k, str(v))
        self.end_headers()
        self.wfile.write(payload)

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Payment-Signature, X-PAYMENT")
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        if path in ("/", "/health", "/healthz", "/readyz"):
            ready = Path(CUNI).is_file()
            return self._send(
                200 if path != "/readyz" or ready else 503,
                {
                    "ok": True if path != "/readyz" else ready,
                    "service": "slidphilabs-agent-store",
                    "about": "Slid Phi Labs agent store — nine CuNi calls plus squeeze. Receipt or refuse.",
                    "ready": ready,
                    "endpoints": {
                        "health": ["/", "/health", "/healthz"],
                        "ready": "/readyz",
                        "verbs": [f"/v1/{name}" for name in PAID_VERBS],
                        "deposit": "/v1/deposit",
                        "catalog": "/.well-known/ai-products.json",
                        "tools": "/mcp/tools.json",
                        "receipt_schema": "/receipt.schema.json",
                    },
                    "store": "slidphilabs-agent-store",
                    "verbs": list(PAID_VERBS) + ["deposit"],
                    "cuni": Path(CUNI).is_file(),
                    "pccx": Path(PCCX).is_file(),
                    "pins": {"check": PIN_CHECK, "translate": PIN_BANK, "squeeze": PIN_PCCX, "calls": PIN_CALLS},
                    "pay_required": REQUIRE_PAY,
                    "pay": PAY_URL,
                },
            )
        if path.startswith("/v1/deposit/"):
            h = path.rsplit("/", 1)[-1]
            rec = deposit_get(h)
            return self._send(200 if rec["ok"] else 404, rec)
        if path in ("/.well-known/ai-products.json", "/ai-products.json"):
            return self._send(200, (ROOT / ".well-known" / "ai-products.json").read_bytes())
        if path in ("/mcp/tools.json", "/tools.json"):
            return self._send(200, (ROOT / "mcp" / "tools.json").read_bytes())
        if path == "/receipt.schema.json":
            return self._send(200, (ROOT / "receipt.schema.json").read_bytes())
        return self._send(404, {"ok": False, "refuse": "not found"})

    def do_POST(self) -> None:  # noqa: N802
        path = urlparse(self.path).path.rstrip("/") or "/"
        try:
            data = read_json(self)
        except PayloadTooLarge as e:
            self.close_connection = True
            return self._send(413, {"ok": False, "refuse": str(e), "retry": False})
        except ValueError as e:
            self.close_connection = True
            return self._send(400, {"ok": False, "refuse": str(e)})
        try:
            verb = path.rsplit("/", 1)[-1]
            if path == f"/v1/{verb}" and verb in PAID_VERBS and REQUIRE_PAY:
                pin = _pin(verb)
                hdr = payment_header(self)
                if not hdr:
                    rec = paywall(verb, pin)
                    reqs = {"x402Version": rec.get("x402Version") or 1, "accepts": rec.get("accepts") or []}
                    b64 = __import__("base64").b64encode(json.dumps(reqs).encode()).decode()
                    return self._send(402, rec, extra={"PAYMENT-REQUIRED": b64, "X-PAYMENT-REQUIRED": b64})
                st, paid_body = x402_verify(verb, hdr)
                if st != 200 or not paid_body.get("ok"):
                    rec = paywall(verb, pin)
                    rec["detail"] = (paid_body.get("error") or paid_body.get("detail") or "payment not verified")[:300]
                    return self._send(402, rec)
                # verified — fall through to the verb
            if path == "/v1/deposit":
                if data.get("data_b64") is not None:
                    try:
                        raw = decode_b64(data.get("data_b64"))
                    except PayloadTooLarge as e:
                        return self._send(413, receipt(verb="deposit", ok=False, source_hash="", pin="lab20-7", refuse=str(e)))
                    except ValueError as e:
                        return self._send(400, receipt(verb="deposit", ok=False, source_hash="", pin="lab20-7", refuse=str(e)))
                elif isinstance(data.get("source"), str):
                    raw = data["source"].encode("utf-8")
                else:
                    return self._send(
                        400,
                        receipt(verb="deposit", ok=False, source_hash="", pin="lab20-7", refuse="missing data_b64 or source"),
                    )
                rec = deposit_put(str(data.get("source_hash") or ""), raw)
                return self._send(200 if rec["ok"] else 422, rec)
            if path == "/v1/replicate":
                rec = deposit_get(str(data.get("source_hash") or ""))
                return self._send(200 if rec["ok"] else 404, rec)
            if path == "/v1/check":
                source = data.get("source")
                if not isinstance(source, str) or not source.strip():
                    return self._send(400, receipt(verb="check", ok=False, source_hash="", pin=PIN_CHECK, refuse="missing source"))
                if len(source) > MAX_SOURCE:
                    return self._send(400, receipt(verb="check", ok=False, source_hash="", pin=PIN_CHECK, refuse="source too large"))
                rec = do_check(source)
                return self._send(200 if rec["ok"] else 422, rec)
            if path == "/v1/translate":
                source = data.get("source")
                if not isinstance(source, str) or not source.strip():
                    return self._send(400, receipt(verb="translate", ok=False, source_hash="", pin=PIN_BANK, refuse="missing source"))
                if len(source) > MAX_SOURCE:
                    return self._send(400, receipt(verb="translate", ok=False, source_hash="", pin=PIN_BANK, refuse="source too large"))
                rec = do_translate(source, str(data.get("from") or "py"), str(data.get("to") or "js"))
                return self._send(200 if rec["ok"] else 422, rec)
            if path == "/v1/squeeze":
                if data.get("data_b64") is not None:
                    try:
                        raw = decode_b64(data.get("data_b64"))
                    except PayloadTooLarge as e:
                        return self._send(413, receipt(verb="squeeze", ok=False, source_hash="", pin=PIN_PCCX, refuse=str(e)))
                    except ValueError as e:
                        return self._send(400, receipt(verb="squeeze", ok=False, source_hash="", pin=PIN_PCCX, refuse=str(e)))
                elif isinstance(data.get("source"), str):
                    raw = data["source"].encode("utf-8")
                else:
                    return self._send(400, receipt(verb="squeeze", ok=False, source_hash="", pin=PIN_PCCX, refuse="missing data_b64 or source"))
                if len(raw) > MAX_SOURCE:
                    return self._send(400, receipt(verb="squeeze", ok=False, source_hash=sha256(raw), pin=PIN_PCCX, refuse="payload too large"))
                rec = do_squeeze(raw)
                return self._send(200 if rec["ok"] else 422, rec)
            if path in ("/v1/money", "/v1/time", "/v1/ship", "/v1/parity"):
                source, err = _need_source(verb, data)
                if err:
                    return self._send(400, err)
                seats = {
                    "money": MONEY_SEATS,
                    "time": TIME_SEATS,
                    "ship": SHIP_SEATS,
                    "parity": PARITY_SEATS,
                }[verb]
                rec = do_gate(verb, source, seats)
                return self._send(200 if rec["ok"] else 422, rec)
            if path == "/v1/ingest":
                source, err = _need_source("ingest", data)
                if err:
                    return self._send(400, err)
                rec = do_ingest(source, str(data.get("from") or "py"))
                return self._send(200 if rec["ok"] else 422, rec)
            if path == "/v1/audit":
                source, err = _need_source("audit", data)
                if err:
                    return self._send(400, err)
                rec = do_audit(source, str(data.get("against") or ""), str(data.get("against_ext") or "py"))
                return self._send(200 if rec["ok"] else 422, rec)
            if path == "/v1/chain":
                source, err = _need_source("chain", data)
                if err:
                    return self._send(400, err)
                rec = do_chain(source, str(data.get("to") or ""))
                return self._send(200 if rec["ok"] else 422, rec)
        except subprocess.TimeoutExpired:
            return self._send(504, {"ok": False, "refuse": f"timeout after {TIMEOUT}s", "retry": True})
        except FileNotFoundError as e:
            return self._send(503, {"ok": False, "refuse": str(e), "retry": True})
        except Exception as e:  # noqa: BLE001
            __import__("sys").stderr.write(f"lab-agent internal error: {e!r}\n")
            return self._send(500, {"ok": False, "refuse": "internal error", "retry": True})
        return self._send(404, {"ok": False, "refuse": "not found"})


def main() -> None:
    httpd = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"lab-agent store → http://{HOST}:{PORT}/  cuni={Path(CUNI).is_file()} pccx={Path(PCCX).is_file()}")
    httpd.serve_forever()


if __name__ == "__main__":
    main()
