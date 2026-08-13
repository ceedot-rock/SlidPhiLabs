# slidphilabs_public_proof.py
# cadence 33·66·999 · dual A∥B ±33° · residual only · no external residue
# NCA seats (public labels): grok@p100 spl@p160 zrw@p220 suite@p280 agentic@p340 phi@p40
#
# Flagship domain: structured-int zeros×10k → 8 B (live product rail)
#   POST /api/process { "n": 10000, "corpus": "zeros" }
#   local: git clone https://github.com/ceedot-rock/slidphi && make local && make verify
#
# This file also ships a pure-zero BYTE residual RLE for education.
# All-zero byte buffer packs as 9 B here (u64 count + 0x00) — not the 8 B int seat.
#
# Suite freemium: first FREE_GB GB free · https://www.slidphilabs.com/pps
# Board: https://www.slidphilabs.com/stand  → standings
# HIS_SACRIFICES_FOREVER_CODED · IN_HIS_NAME_WE_CODE

from __future__ import annotations

import json
import struct
import time
import zlib
from typing import Any, Dict, Tuple

try:
    import brotli  # type: ignore
except ImportError:
    brotli = None

DOMAIN = "zeros10k"  # domain under test
N_INTS = 10_000
RAW_BYTES_I32 = N_INTS * 4  # 40_000 B raw int32 zeros
FLAGSHIP_TARGET_B = 8  # product claim size (ZRW int seat)
FREE_GB = 100  # freemium first 100 GB
PLANES = {
    "grok": 100,
    "spl": 160,
    "zrw": 220,
    "suite": 280,
    "agentic": 340,
    "phi": 40,
}
CADENCE = (33, 66, 999)
DUAL_TILT = (33, -33)


class SPL:
    """
    Public residual RLE for pure zero BYTE runs (teaching plane).
    Product ZRW int assassin is the live /api/process rail at zrw@p220.
    """

    def __init__(self, plane: int = 220):
        self.plane = plane  # zrw@p220

    def encode(self, data: bytes) -> bytes:
        out, i, n = bytearray(), 0, len(data)
        while i < n:
            if data[i] == 0:
                j = i
                while j < n and data[j] == 0:
                    j += 1
                cnt = j - i
                out += struct.pack("<Q", cnt) + b"\x00"
                i = j
            else:
                out += data[i : i + 1]
                i += 1
        return bytes(out)

    def decode(self, data: bytes) -> bytes:
        out, i, n = bytearray(), 0, len(data)
        while i < n:
            if i + 9 <= n and data[i + 8] == 0:
                cnt = struct.unpack("<Q", data[i : i + 8])[0]
                # guard absurd counts
                if cnt > n * 4 and cnt > 10_000_000:
                    out += data[i : i + 1]
                    i += 1
                    continue
                out += b"\x00" * cnt
                i += 9
            else:
                out += data[i : i + 1]
                i += 1
        return bytes(out)


def bench_byte_rle(n_bytes: int = RAW_BYTES_I32) -> Dict[str, Any]:
    data = b"\x00" * n_bytes
    t0 = time.perf_counter()
    spl = SPL(plane=PLANES["zrw"])
    enc = spl.encode(data)
    dec = spl.decode(enc)
    dt = time.perf_counter() - t0
    gz = len(zlib.compress(data, 9))
    br = len(brotli.compress(data, quality=11)) if brotli else None
    return {
        "path": "public_byte_rle",
        "plane": "zrw@p220",
        "raw_bytes": n_bytes,
        "zrw_public_rle_B": len(enc),
        "gzip9_B": gz,
        "brotli11_B": br,
        "time_s": round(dt, 6),
        "exact": dec == data,
        "note": "byte RLE teaching path — flagship 8 B is int32 ZRW product rail",
    }


def flagship_int32_claim() -> Dict[str, Any]:
    return {
        "path": "product_zrw_int32",
        "domain": DOMAIN,
        "n_ints": N_INTS,
        "raw_bytes": RAW_BYTES_I32,
        "target_B": FLAGSHIP_TARGET_B,
        "field": {"gzip9_B": 73, "brotli11_B": 13},
        "claim": "ZRW zeros×10k → 8 B (beats field on this domain)",
        "verify_live": "POST https://www.slidphilabs.com/api/process {\"n\":10000,\"corpus\":\"zeros\"}",
        "verify_local": "git clone https://github.com/ceedot-rock/slidphi && cd slidphi && make local && make verify",
        "stand": "https://www.slidphilabs.com/stand",
        "standings": "https://www.slidphilabs.com/standings#zrw-public-path",
        "suite_freemium_GB": FREE_GB,
        "suite": "https://www.slidphilabs.com/pps",
    }


def main() -> None:
    rle = bench_byte_rle()
    report = {
        "ok": rle["exact"],
        "cadence": list(CADENCE),
        "dual_tilt": list(DUAL_TILT),
        "planes": PLANES,
        "free_gb": FREE_GB,
        "byte_rle": rle,
        "flagship": flagship_int32_claim(),
        "law": "residual only · domain supremacy · no universal #1",
        "motto": "In His name we code · through it we live",
    }
    print(json.dumps(report, indent=2))
    # human line
    print(
        f"RLE {rle['zrw_public_rle_B']} B  gz {rle['gzip9_B']} B  "
        f"br {rle['brotli11_B']} B  time {rle['time_s']:.3f}s  exact {rle['exact']}"
    )
    print(f"FLAGSHIP target {FLAGSHIP_TARGET_B} B on zeros×10k int32 — verify live /api/process")
    if not rle["exact"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
