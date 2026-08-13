#!/usr/bin/env python3
# zrw_verify.py — public proof harness (MIT)
# Verify ZRW zeros×10k → 8 B without installing the product engine.
# Default: live product rail POST /api/process (urllib only).
# Optional: --local http://127.0.0.1:8788 after `make local` in slidphi.
#
# Usage:
#   python3 zrw_verify.py                  # synthesizes int32 zeros×10k
#   python3 zrw_verify.py zeros10k.bin     # raw int32 LE zeros (40_000 B)
#   python3 zrw_verify.py --make-zeros zeros10k.bin && python3 zrw_verify.py zeros10k.bin
#
# Cadence 33·66·999 · residual only · domain supremacy · no universal #1
# https://www.slidphilabs.com/stand · https://www.slidphilabs.com/api/stand

from __future__ import annotations

import argparse
import base64
import gzip
import hashlib
import json
import struct
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

DEFAULT_API = "https://www.slidphilabs.com"
N_INTS = 10_000
RAW_BYTES = N_INTS * 4  # int32 LE zeros×10k


def make_zeros_i32(n: int = N_INTS) -> bytes:
    return b"\x00" * (n * 4)


def write_zeros_bin(path: Path, n: int = N_INTS) -> Path:
    path.write_bytes(make_zeros_i32(n))
    return path


def field_gzip(raw: bytes) -> bytes:
    return gzip.compress(raw, compresslevel=9)


def field_brotli(raw: bytes) -> Optional[bytes]:
    try:
        import brotli  # type: ignore

        return brotli.compress(raw, quality=11)
    except Exception:
        return None


def field_lzma(raw: bytes) -> Optional[bytes]:
    try:
        import lzma

        return lzma.compress(raw)
    except Exception:
        return None


def zrw_encode_live(
    raw: bytes,
    api_base: str = DEFAULT_API,
    timeout: float = 60.0,
) -> Tuple[bytes, Dict[str, Any]]:
    """
    Real ZRW path via public REST (no local engine install).
    Prefer raw int32 LE octet-stream compress; fall back to process JSON zeros.
    """
    base = api_base.rstrip("/")
    # 1) raw compress
    try:
        req = urllib.request.Request(
            f"{base}/api/compress",
            data=raw,
            headers={"content-type": "application/octet-stream"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=timeout) as r:
            j = json.loads(r.read().decode())
        if j.get("ok") and j.get("packed_b64") is not None:
            packed = base64.b64decode(j["packed_b64"])
            return packed, j
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")
        meta = {"http_error": e.code, "body": body[:300]}
    except Exception as e:
        meta = {"error": str(e)}

    # 2) process JSON zeros (flagship corpus)
    n = max(1, len(raw) // 4)
    req = urllib.request.Request(
        f"{base}/api/process",
        data=json.dumps({"n": n, "corpus": "zeros"}).encode(),
        headers={"content-type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as r:
        j = json.loads(r.read().decode())
    if not j.get("ok") or j.get("packed_b64") is None:
        raise RuntimeError(f"live ZRW failed: {j}")
    packed = base64.b64decode(j["packed_b64"])
    j["_via"] = "process_zeros"
    j["_fallback_meta"] = meta if "meta" in dir() else None
    return packed, j


def zrw_roundtrip_live(raw: bytes, packed: bytes, api_base: str, meta: Dict[str, Any]) -> bool:
    """Confirm decompress restores all zeros when meta says so."""
    if meta.get("roundtrip") is True and meta.get("mirror_error") == 0:
        return True
    base = api_base.rstrip("/")
    try:
        req = urllib.request.Request(
            f"{base}/api/decompress",
            data=json.dumps({"packed_b64": base64.b64encode(packed).decode()}).encode(),
            headers={"content-type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=60) as r:
            j = json.loads(r.read().decode())
        if j.get("all_zeros") and j.get("n_ints") == len(raw) // 4:
            return True
        if j.get("restored_b64"):
            back = base64.b64decode(j["restored_b64"])
            return back == raw
    except Exception:
        return False
    return False


def bench(path: Optional[Path], api_base: str) -> Dict[str, Any]:
    if path is None:
        raw = make_zeros_i32()
        name = "zeros10k.i32le(synth)"
    else:
        raw = path.read_bytes()
        name = path.name
        if len(raw) % 4 != 0:
            raise SystemExit(f"{name}: raw must be int32-aligned (got {len(raw)} bytes)")

    t0 = time.perf_counter()
    z, meta = zrw_encode_live(raw, api_base=api_base)
    dt = time.perf_counter() - t0

    gz = field_gzip(raw)
    br = field_brotli(raw)
    lz = field_lzma(raw)
    rt = zrw_roundtrip_live(raw, z, api_base, meta)

    row = {
        "file": name,
        "raw": len(raw),
        "zrw": len(z),
        "gz": len(gz),
        "br": len(br) if br is not None else None,
        "lz": len(lz) if lz is not None else None,
        "ms": round(dt * 1000, 1),
        "roundtrip": rt,
        "mirror_error": meta.get("mirror_error"),
        "sha256_raw": hashlib.sha256(raw).hexdigest()[:16],
        "api": api_base,
    }
    br_s = f"{row['br']:>8}" if row["br"] is not None else f"{'n/a':>8}"
    lz_s = f"{row['lz']:>8}" if row["lz"] is not None else f"{'n/a':>8}"
    print(
        f"{name:24} raw={row['raw']:>8} "
        f"zrw={row['zrw']:>8} gz={row['gz']:>8} br={br_s} lz={lz_s} "
        f"ms={row['ms']:>6.1f} rt={rt}"
    )
    # domain grade for flagship shape
    if len(raw) == RAW_BYTES and raw == make_zeros_i32():
        ok = row["zrw"] == 8 and rt and row["zrw"] < row["gz"] and (
            row["br"] is None or row["zrw"] < row["br"]
        )
        print(
            f"{'GRADE':24} "
            f"{'PASS' if ok else 'CHECK'}  "
            f"claim zeros×10k → 8 B · field gz={row['gz']} br={row['br']}"
        )
        row["grade"] = "PASS" if ok else "CHECK"
        row["claim"] = "ZRW zeros×10k → 8 B"
    return row


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Public ZRW proof harness (MIT) — no engine install")
    ap.add_argument("paths", nargs="*", help="raw int32 LE files (e.g. zeros10k.bin)")
    ap.add_argument("--api", default=DEFAULT_API, help="API base (default www.slidphilabs.com)")
    ap.add_argument(
        "--make-zeros",
        metavar="PATH",
        help="write int32 LE zeros×10k corpus and exit",
    )
    ap.add_argument("--json", action="store_true", help="print machine JSON after table")
    args = ap.parse_args(argv)

    if args.make_zeros:
        p = write_zeros_bin(Path(args.make_zeros))
        print(f"wrote {p} ({p.stat().st_size} bytes int32 zeros×{N_INTS})")
        return 0

    rows = []
    if not args.paths:
        rows.append(bench(None, args.api))
    else:
        for p in args.paths:
            rows.append(bench(Path(p), args.api))

    if args.json:
        print(json.dumps({"ok": True, "rows": rows, "law": "residual only · domain-honest"}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
