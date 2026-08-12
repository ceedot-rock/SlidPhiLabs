#!/usr/bin/env python3
"""
cddg-split v0.2 TRUE8 — SlidPhiLabs quikgater
Splits any file into dormant (TRUE8 8B) + active (zstd/raw)
For Silesia bench.

Docket: SLID-PHI-CDDG-SPLIT-TRUE8
Public demonstration surface. Production residual coefficients remain private.
"""
from __future__ import annotations
import struct, sys, json, zlib
from pathlib import Path
from typing import List, Tuple, Dict, Any

def find_dormant_runs(data: bytes, min_run: int = 32) -> List[Tuple[int, int, str, int]]:
    """Find dormant runs: zeros, 0xFF, repeated byte, ramp."""
    runs: List[Tuple[int, int, str, int]] = []
    i = 0
    n = len(data)
    while i < n:
        if data[i] == 0:
            j = i
            while j < n and data[j] == 0 and j - i < 10_000_000:
                j += 1
            run_len = j - i
            if run_len >= min_run:
                runs.append((i, run_len, "zeros", 0))
                i = j
                continue
        if data[i] == 0xFF:
            j = i
            while j < n and data[j] == 0xFF:
                j += 1
            run_len = j - i
            if run_len >= min_run:
                runs.append((i, run_len, "ff", 0xFF))
                i = j
                continue
        if i + min_run <= n and len(set(data[i : i + min_run])) == 1:
            b = data[i]
            j = i + min_run
            while j < n and data[j] == b:
                j += 1
            run_len = j - i
            runs.append((i, run_len, "repeat", b))
            i = j
            continue
        if i + min_run <= n:
            step = int(data[i + 1]) - int(data[i]) if i + 1 < n else 0
            if step in (1, -1):
                j = i + 1
                while j < n and j - i < 1024:
                    if int(data[j]) - int(data[j - 1]) != step:
                        break
                    j += 1
                run_len = j - i
                if run_len >= min_run:
                    runs.append((i, run_len, "ramp", step))
                    i = j
                    continue
        i += 1
    return runs

def pack_true8(run_type: str, run_len: int, extra: int = 0) -> bytes:
    """TRUE 8B core packing: uint64 count (or start+step for ramp)."""
    if run_type in ("zeros", "ff", "repeat"):
        return struct.pack("<Q", run_len)
    if run_type == "ramp":
        return struct.pack("<ii", extra, 1)
    return struct.pack("<Q", run_len)

def split_file(in_path: Path, out_dir: Path) -> Dict[str, Any]:
    data = in_path.read_bytes()
    runs = find_dormant_runs(data)
    true8_blob = bytearray()
    active = bytearray()
    manifest: Dict[str, Any] = {
        "file": in_path.name,
        "raw_size": len(data),
        "docket": "SLID-PHI-CDDG-SPLIT-TRUE8",
        "runs": [],
    }
    last = 0
    for offset, length, rtype, extra in runs:
        active.extend(data[last:offset])
        if rtype == "ramp":
            tb = struct.pack("<ii", int(data[offset]), extra)
        else:
            tb = pack_true8(rtype, length, extra)
        true8_offset = len(true8_blob)
        true8_blob.extend(tb)
        manifest["runs"].append({
            "offset": offset,
            "length": length,
            "type": rtype,
            "value": extra if rtype != "ramp" else int(data[offset]),
            "true8_offset": true8_offset,
            "true8_size": len(tb),
            "true8_hex": tb.hex(),
        })
        last = offset + length
    active.extend(data[last:])
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / (in_path.name + ".splz")).write_bytes(true8_blob)
    (out_dir / (in_path.name + ".active")).write_bytes(active)
    (out_dir / (in_path.name + ".manifest.json")).write_text(json.dumps(manifest, indent=2))
    active_z = zlib.compress(bytes(active), level=9)
    (out_dir / (in_path.name + ".active.zst")).write_bytes(active_z)
    total_cddg = len(true8_blob) + len(active_z)
    ratio = total_cddg / len(data) * 100 if data else 0.0
    return {
        "file": in_path.name,
        "raw": len(data),
        "runs": len(runs),
        "dormant_raw": sum(r[1] for r in runs),
        "true8": len(true8_blob),
        "active_raw": len(active),
        "active_zstd": len(active_z),
        "cddg_total": total_cddg,
        "ratio": ratio,
        "saving_vs_zlib": len(zlib.compress(data, 9)) - total_cddg,
    }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: cddg-split <file> [out_dir]")
        sys.exit(1)
    in_path = Path(sys.argv[1])
    out_dir = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("./out")
    res = split_file(in_path, out_dir)
    print(
        f"{res['file']}: raw {res['raw']} -> runs {res['runs']} dormant {res['dormant_raw']} "
        f"-> true8 {res['true8']}B + active_z {res['active_zstd']}B = {res['cddg_total']}B "
        f"({res['ratio']:.1f}%) saving {res['saving_vs_zlib']}B vs zlib"
    )
