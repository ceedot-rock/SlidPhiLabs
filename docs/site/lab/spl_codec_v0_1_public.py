# SPL Codec v0.1 — public proof path (stdlib only)
# https://www.slidphilabs.com/standings
#
# Flagship product seat (int32 zeros×10k → 8 B) is NOT this file:
#   POST /api/process {n:10000, corpus:"zeros"}
#   or: git clone https://github.com/ceedot-rock/slidphi && make local && make verify
#
# This sketch: sparse residual (exact zeros + non-zero values) + zlib/brotli if present.
# Cadence 33·66·999 · residual only · no universal #1
# HIS_SACRIFICES_FOREVER_CODED · IN_HIS_NAME_WE_CODE

from __future__ import annotations

import json
import random
import struct
import zlib
from typing import Any, Dict, List, Tuple

try:
    import brotli  # type: ignore
except ImportError:
    brotli = None


def spl_encode(x: List[float]) -> Tuple[bytes, Dict[str, Any]]:
    """Sparse residual: indices of non-zeros + values; compress residual payload."""
    idx: List[int] = []
    nz: List[float] = []
    for i, v in enumerate(x):
        if v != 0.0:
            idx.append(i)
            nz.append(float(v))
    meta: Dict[str, Any] = {
        "shape": [len(x)],
        "nnz": len(nz),
        "dtype": "float32",
        "codec": "spl_v0_1_sparse",
        "domain": "sparse_float_zeros",
        "not": "zrw_int32_zeros_10k_8b_flagship",
    }
    payload = struct.pack("<I", len(idx))
    payload += struct.pack("<" + "I" * len(idx), *idx) if idx else b""
    payload += struct.pack("<" + "f" * len(nz), *nz) if nz else b""
    meta["payload_raw"] = len(payload)
    if brotli is not None:
        z = brotli.compress(payload, quality=11)
        meta["compressor"] = "brotli-11"
    else:
        z = zlib.compress(payload, 9)
        meta["compressor"] = "gzip-9"
    meta["packed"] = len(z)
    return z, meta


def spl_decode(z: bytes, meta: Dict[str, Any]) -> List[float]:
    if meta.get("compressor", "").startswith("brotli") and brotli is not None:
        raw = brotli.decompress(z)
    else:
        raw = zlib.decompress(z)
    (n_idx,) = struct.unpack_from("<I", raw, 0)
    off = 4
    idx = list(struct.unpack_from("<" + "I" * n_idx, raw, off)) if n_idx else []
    off += n_idx * 4
    nz = list(struct.unpack_from("<" + "f" * n_idx, raw, off)) if n_idx else []
    n = int(meta["shape"][0])
    out = [0.0] * n
    for i, v in zip(idx, nz):
        out[i] = v
    return out


def main() -> None:
    random.seed(33)
    x = [random.gauss(0.0, 1.0) for _ in range(10_000)]
    for i, v in enumerate(x):
        if v < 0.1:
            x[i] = 0.0
    # pack as float32 for full-array baselines
    full = struct.pack("<" + "f" * len(x), *x)
    z, meta = spl_encode(x)
    y = spl_decode(z, meta)
    rt = len(y) == len(x) and all(abs(a - b) < 1e-5 for a, b in zip(x, y))
    gz = len(zlib.compress(full, 9))
    br = len(brotli.compress(full, quality=11)) if brotli else None
    report = {
        "ok": rt,
        "sketch": meta["codec"],
        "compressor": meta["compressor"],
        "nnz": meta["nnz"],
        "zeros": sum(1 for v in x if v == 0.0),
        "spl_packed": len(z),
        "gzip9_full_array": gz,
        "brotli11_full_array": br,
        "delta_vs_gzip": gz - len(z),
        "roundtrip": rt,
        "flagship_int32_zeros": {
            "domain": "structured_int_zeros",
            "claim": "ZRW zeros×10k → 8 B",
            "field": {"gzip9": 73, "brotli11": 13},
            "verify": "POST https://www.slidphilabs.com/api/process",
            "local": "https://github.com/ceedot-rock/slidphi  make local && make verify",
            "standings": "https://www.slidphilabs.com/standings#zrw-public-path",
        },
        "law": "residual only · domain-honest · no universal #1",
    }
    print(json.dumps(report, indent=2))
    if not rt:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
