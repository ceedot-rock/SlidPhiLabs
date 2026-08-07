#!/usr/bin/env python3
"""
OmniWave speed bench — ms and MB/s for:
  · profiler only
  · full OmniWave compress (+ decompress)
  · zlib-9
  · zstd (if installed: pip install zstandard)

Usage:
  python3 lab/omniwave/bench_speed.py
  python3 lab/omniwave/bench_speed.py --sizes 1,4,16
"""

from __future__ import annotations

import argparse
import math
import statistics
import struct
import sys
import time
import zlib
from pathlib import Path

# lab import
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from lab.omniwave.omniwave import FastProfiler, OmniWave  # noqa: E402

try:
    import zstandard as zstd

    HAS_ZSTD = True
except ImportError:
    HAS_ZSTD = False


def make_payloads(n: int) -> dict[str, bytes]:
    """Fixed synthetic corpora at size n bytes (approx)."""
    # zeros
    zeros = b"\x00" * n
    # ramp int32 (structured)
    ramp_count = max(1, n // 4)
    ramp = b"".join(struct.pack("<i", i % 100000) for i in range(ramp_count))[:n]
    # text/json-ish
    unit = b'{"id":123,"name":"widget","ok":true,"vals":[1,2,3,4]} '
    text = (unit * (n // len(unit) + 1))[:n]
    # float series
    fc = max(1, n // 4)
    floats = b"".join(struct.pack("<f", math.sin(i / 10.0) * 100) for i in range(fc))[
        :n
    ]
    # high-entropy (pseudo-random LCG)
    he = bytearray(n)
    x = 0x12345678
    for i in range(n):
        x = (1103515245 * x + 12345) & 0x7FFFFFFF
        he[i] = x & 0xFF
    return {
        "zeros": zeros,
        "ramp_i32": ramp,
        "text_json": text,
        "float_series": floats,
        "high_entropy": bytes(he),
    }


def timed(fn, repeats: int = 5) -> float:
    """Return median seconds over repeats (warmup 1)."""
    fn()  # warmup
    times = []
    for _ in range(repeats):
        t0 = time.perf_counter()
        fn()
        times.append(time.perf_counter() - t0)
    return statistics.median(times)


def mb_s(nbytes: int, sec: float) -> float:
    if sec <= 0:
        return float("inf")
    return (nbytes / (1024 * 1024)) / sec


def bench_one(name: str, data: bytes, repeats: int) -> list[dict]:
    n = len(data)
    rows = []
    prof = FastProfiler(sample_stride=32)
    ow = OmniWave()

    # Profiler only
    sec = timed(lambda: prof.profile(data), repeats)
    rows.append(
        {
            "corpus": name,
            "path": "profiler_only",
            "bytes": n,
            "out": 0,
            "ms": sec * 1000,
            "mb_s": mb_s(n, sec),
            "ratio": None,
        }
    )

    # OmniWave compress
    box: dict = {}

    def ow_c():
        box["c"], box["m"] = ow.compress(data)

    sec = timed(ow_c, repeats)
    c = box["c"]
    rows.append(
        {
            "corpus": name,
            "path": "omniwave_compress",
            "bytes": n,
            "out": len(c),
            "ms": sec * 1000,
            "mb_s": mb_s(n, sec),
            "ratio": n / max(1, len(c)),
            "engine": box["m"].get("engine"),
        }
    )

    # OmniWave decompress
    framed = box["c"]

    def ow_d():
        box["d"] = ow.decompress(framed)

    sec = timed(ow_d, repeats)
    rows.append(
        {
            "corpus": name,
            "path": "omniwave_decompress",
            "bytes": n,
            "out": len(box.get("d") or b""),
            "ms": sec * 1000,
            "mb_s": mb_s(n, sec),
            "ratio": None,
        }
    )

    # zlib-9
    def zc():
        box["z"] = zlib.compress(data, 9)

    sec = timed(zc, repeats)
    z = box["z"]
    rows.append(
        {
            "corpus": name,
            "path": "zlib_9",
            "bytes": n,
            "out": len(z),
            "ms": sec * 1000,
            "mb_s": mb_s(n, sec),
            "ratio": n / max(1, len(z)),
        }
    )

    def zd():
        box["zd"] = zlib.decompress(z)

    sec = timed(zd, repeats)
    rows.append(
        {
            "corpus": name,
            "path": "zlib_9_decompress",
            "bytes": n,
            "out": n,
            "ms": sec * 1000,
            "mb_s": mb_s(n, sec),
            "ratio": None,
        }
    )

    if HAS_ZSTD:
        cctx = zstd.ZstdCompressor(level=3)
        dctx = zstd.ZstdDecompressor()

        def zsc():
            box["zs"] = cctx.compress(data)

        sec = timed(zsc, repeats)
        zs = box["zs"]
        rows.append(
            {
                "corpus": name,
                "path": "zstd_3",
                "bytes": n,
                "out": len(zs),
                "ms": sec * 1000,
                "mb_s": mb_s(n, sec),
                "ratio": n / max(1, len(zs)),
            }
        )

        def zsd():
            box["zsd"] = dctx.decompress(zs)

        sec = timed(zsd, repeats)
        rows.append(
            {
                "corpus": name,
                "path": "zstd_3_decompress",
                "bytes": n,
                "out": n,
                "ms": sec * 1000,
                "mb_s": mb_s(n, sec),
                "ratio": None,
            }
        )

    return rows


def main() -> int:
    ap = argparse.ArgumentParser(description="OmniWave speed bench")
    ap.add_argument(
        "--sizes",
        default="1,4",
        help="Comma-separated sizes in MiB (default: 1,4)",
    )
    ap.add_argument("--repeats", type=int, default=5, help="Timed repeats (median)")
    args = ap.parse_args()
    sizes_mib = [float(x) for x in args.sizes.split(",") if x.strip()]

    print("=== OmniWave speed bench ===")
    print(f"zstd: {'yes' if HAS_ZSTD else 'no (pip install zstandard)'}")
    print(f"repeats (median): {args.repeats}")
    print()

    header = (
        f"{'corpus':<16} {'path':<22} {'MiB':>6} {'ms':>10} {'MB/s':>10} "
        f"{'ratio':>8} {'engine':<22}"
    )
    print(header)
    print("-" * len(header))

    all_rows = []
    for mib in sizes_mib:
        n = int(mib * 1024 * 1024)
        payloads = make_payloads(n)
        for name, data in payloads.items():
            rows = bench_one(name, data, args.repeats)
            all_rows.extend(rows)
            for r in rows:
                ratio = f"{r['ratio']:.2f}x" if r.get("ratio") else "-"
                eng = r.get("engine") or "-"
                print(
                    f"{r['corpus']:<16} {r['path']:<22} {mib:6.1f} "
                    f"{r['ms']:10.2f} {r['mb_s']:10.1f} {ratio:>8} {eng:<22}"
                )
            print()

    # Summary: compress-only paths average MB/s by path across corpora @ largest size
    print("=== Summary (compress paths, last size only) ===")
    last_mib = sizes_mib[-1]
    n = int(last_mib * 1024 * 1024)
    by_path: dict[str, list[float]] = {}
    for name, data in make_payloads(n).items():
        for r in bench_one(name, data, args.repeats):
            if "decompress" in r["path"] or r["path"] == "profiler_only":
                continue
            by_path.setdefault(r["path"], []).append(r["mb_s"])
    for path, vals in sorted(by_path.items()):
        print(
            f"  {path:<22} median MB/s across corpora @ {last_mib} MiB: "
            f"{statistics.median(vals):.1f}"
        )

    print()
    print("Notes:")
    print("  · OmniWave includes profiler + route + transforms + zlib (ZRW stub = zlib).")
    print("  · Live ZRW handoff will change zeros/ramp speed & ratio dramatically.")
    print("  · profiler_only is routing tax only.")
    if not HAS_ZSTD:
        print("  · Install zstandard for zstd_3 comparison: pip install zstandard")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
