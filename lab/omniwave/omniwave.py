#!/usr/bin/env python3
"""
OmniWave / Apex Path — Complementary Generalist Architecture for SLiD Phi Labs

Strong where ZRW/structured is weak (general bytes, high-entropy, floats, text/nested).
Router preserves ZRW dominance on zeros/ramps/walks.

Exact lossless on implemented reverse paths. Cache-friendly. Agent-ready hooks.

IP Guard: Lab scaffold only. Do not publish private engines or process. Wire real
ZRW/CDDG/Blackjack via `zrw_delegate` callables when available.

Author: The Architect (for Slid Phi Labs synergy)
"""

from __future__ import annotations

import json
import math
import struct
import zlib
from collections import Counter
from typing import Any, Callable, Dict, Optional, Tuple

# ====================== EFFICIENT DATA STRUCTURES ======================


class CircularBuffer:
    """Cache-friendly sliding window for LZ (power-of-two size)."""

    def __init__(self, size: int = 1 << 16):
        self.size = size
        self.mask = size - 1
        self.buf = bytearray(size)
        self.pos = 0

    def push(self, b: int) -> None:
        self.buf[self.pos] = b & 0xFF
        self.pos = (self.pos + 1) & self.mask

    def get(self, offset: int) -> int:
        return self.buf[(self.pos - offset) & self.mask]


class FastProfiler:
    """O(n) or sampled feature extractor for routing decisions."""

    def __init__(self, sample_stride: int = 16):
        self.stride = max(1, sample_stride)

    def profile(self, data: bytes) -> Dict[str, float]:
        n = len(data)
        if n == 0:
            return {
                "entropy": 0.0,
                "zero_ratio": 1.0,
                "printable": 0.0,
                "float_like": 0.0,
                "run_score": 0.0,
                "linearity": 0.0,
                "n": 0.0,
            }

        sample = data[:: self.stride] if n > 4096 else data
        ns = len(sample)

        cnt = Counter(sample)
        ent = -sum((c / ns) * math.log2(c / ns) for c in cnt.values() if c)

        zeros = sample.count(0)
        zero_ratio = zeros / ns
        runs = 1
        for i in range(1, ns):
            if sample[i] != sample[i - 1]:
                runs += 1
        run_score = 1.0 - (runs / ns)

        printable = (
            sum(1 for b in sample if 32 <= b < 127 or b in (9, 10, 13)) / ns
        )

        float_like = 0.0
        if n >= 8:
            exp_hist: Counter = Counter()
            for i in range(0, min(n - 3, 1024), 4):
                try:
                    f = struct.unpack_from("<f", data, i)[0]
                    if math.isfinite(f):
                        bits = struct.unpack_from("<I", data, i)[0]
                        exp = (bits >> 23) & 0xFF
                        exp_hist[exp] += 1
                except struct.error:
                    pass
            if exp_hist:
                e_ns = sum(exp_hist.values())
                e_ent = -sum(
                    (c / e_ns) * math.log2(c / e_ns) for c in exp_hist.values() if c
                )
                float_like = max(0.0, 1.0 - e_ent / 8.0)

        if n >= 8:
            diffs = []
            for i in range(0, min(n - 7, 512), 4):
                a = struct.unpack_from("<i", data, i)[0]
                b = struct.unpack_from("<i", data, i + 4)[0]
                diffs.append(abs(b - a))
            if diffs:
                mean_diff = sum(diffs) / len(diffs)
                linearity = 1.0 / (1.0 + mean_diff / 1000.0)
            else:
                linearity = 0.0
        else:
            linearity = 0.0

        return {
            "entropy": float(ent),
            "zero_ratio": float(zero_ratio),
            "printable": float(printable),
            "float_like": float(float_like),
            "run_score": float(run_score),
            "linearity": float(linearity),
            "n": float(n),
        }


# ====================== SPECIALIST TRANSFORMS ======================


def float_predict_xor(data: bytes) -> Tuple[bytes, dict]:
    """Float specialist: XOR prediction on float32/float64 bit patterns. Reversible."""
    if len(data) % 8 == 0:
        width = 8
    elif len(data) % 4 == 0:
        width = 4
    else:
        return data, {"type": "raw"}

    out = bytearray()
    meta = {"type": "float_xor", "width": width}
    prev = 0
    fmt_bits = "Q" if width == 8 else "I"
    for i in range(0, len(data) - width + 1, width):
        curr_bits = struct.unpack_from("<" + fmt_bits, data, i)[0]
        xor = curr_bits ^ prev
        out.extend(struct.pack("<" + fmt_bits, xor))
        prev = curr_bits
    rem = len(data) % width
    if rem:
        out.extend(data[-rem:])
    return bytes(out), meta


def float_predict_xor_reverse(data: bytes, width: int) -> bytes:
    fmt_bits = "Q" if width == 8 else "I"
    out = bytearray()
    prev = 0
    body = len(data) - (len(data) % width)
    for i in range(0, body, width):
        xor = struct.unpack_from("<" + fmt_bits, data, i)[0]
        curr = xor ^ prev
        out.extend(struct.pack("<" + fmt_bits, curr))
        prev = curr
    if len(data) > body:
        out.extend(data[body:])
    return bytes(out)


def structural_json_ish_split(data: bytes) -> Tuple[bytes, dict]:
    """
    Text/JSON/HTML hook: mark structural path.
    Production: real tokenizer → keys / strings / numbers streams + index.
    Prototype: identity payload + meta (entropy still runs on general path).
    """
    try:
        data.decode("utf-8")
        enc = "utf8"
    except UnicodeDecodeError:
        enc = "binary"
    return data, {"type": "struct_split", "orig_encoding": enc}


def simple_delta_int(data: bytes) -> Tuple[bytes, dict]:
    """Near-linear int32 LE series that missed ZRW detector."""
    if len(data) < 8 or len(data) % 4 != 0:
        return data, {"type": "raw"}
    out = bytearray()
    prev = 0
    for i in range(0, len(data), 4):
        val = struct.unpack_from("<i", data, i)[0]
        diff = (val - prev) & 0xFFFFFFFF
        # store as signed i32 bit pattern
        if diff >= 0x80000000:
            diff_s = diff - 0x100000000
        else:
            diff_s = diff
        out.extend(struct.pack("<i", diff_s))
        prev = val
    return bytes(out), {"type": "delta_i32"}


def simple_delta_int_reverse(data: bytes) -> bytes:
    if len(data) % 4 != 0:
        return data
    out = bytearray()
    prev = 0
    for i in range(0, len(data), 4):
        diff = struct.unpack_from("<i", data, i)[0]
        val = prev + diff
        out.extend(struct.pack("<i", val))
        prev = val
    return bytes(out)


# ====================== CORE GENERAL ENGINE (LZ + Entropy) ======================


def lz77_encode(data: bytes, window_bits: int = 16, min_match: int = 4) -> bytes:
    """
    Simplified LZ77 for scaffold demos.
    Production: SIMD hash, lazy match, optimal parse; or skip and use zstd only.
    Format: 0x00 + literal byte | 0x01 + u16 off + u8 (len-min_match)
    """
    n = len(data)
    if n == 0:
        return b""
    window = 1 << window_bits
    out = bytearray()
    i = 0
    hash_table: Dict[int, int] = {}

    while i < n:
        match_len = 0
        match_off = 0
        if i + min_match <= n:
            h = hash(data[i : i + 4]) & 0xFFFF
            if h in hash_table:
                cand = hash_table[h]
                if 0 <= i - cand < window:
                    length = 0
                    max_l = min(258, n - i)
                    while length < max_l and data[cand + length] == data[i + length]:
                        length += 1
                    if length >= min_match:
                        match_len = length
                        match_off = i - cand
            hash_table[h] = i

        if match_len >= min_match:
            out.append(0x01)
            out.extend(struct.pack("<HB", match_off, min(match_len - min_match, 255)))
            i += match_len
        else:
            out.append(0x00)
            out.append(data[i])
            i += 1
    return bytes(out)


def lz77_decode(data: bytes, min_match: int = 4) -> bytes:
    out = bytearray()
    i = 0
    n = len(data)
    while i < n:
        flag = data[i]
        i += 1
        if flag == 0x00:
            if i >= n:
                break
            out.append(data[i])
            i += 1
        elif flag == 0x01:
            if i + 3 > n:
                break
            off, len_extra = struct.unpack_from("<HB", data, i)
            i += 3
            length = len_extra + min_match
            start = len(out) - off
            for k in range(length):
                out.append(out[start + k])
        else:
            # corrupt / legacy: treat as literal payload remainder
            out.extend(data[i - 1 :])
            break
    return bytes(out)


def entropy_encode(data: bytes) -> bytes:
    """Baseline: zlib-9. Prod: zstd / brotli / ANS."""
    return zlib.compress(data, level=9)


def entropy_decode(data: bytes) -> bytes:
    return zlib.decompress(data)


# ====================== OMNIWAVE MAIN ======================


class OmniWave:
    """Complementary architecture for non-ZRW regimes + ZRW handoff."""

    MAGIC = b"OMWV"
    VERSION = 1

    def __init__(
        self,
        zrw_compress: Optional[Callable[[bytes], bytes]] = None,
        zrw_decompress: Optional[Callable[[bytes], bytes]] = None,
    ):
        self.profiler = FastProfiler(sample_stride=32)
        self.zrw_threshold = 0.65
        self.float_threshold = 0.4
        self.text_threshold = 0.75
        self.zrw_compress = zrw_compress
        self.zrw_decompress = zrw_decompress

    def should_route_to_zrw(self, feats: Dict[str, float]) -> bool:
        """Preserve zeros / ramps / walks for ZRW. Never steal that lane."""
        score = (
            feats["zero_ratio"] * 0.4
            + feats["run_score"] * 0.3
            + feats["linearity"] * 0.3
        )
        # Classic structured: high score + moderate entropy
        if score >= self.zrw_threshold and feats["entropy"] < 4.0:
            return True
        # Ramp/walk-class: strong linearity even if entropy is higher
        if feats["linearity"] >= 0.85 and feats["printable"] < 0.55:
            return True
        # Dense zeros
        if feats["zero_ratio"] >= 0.9:
            return True
        return False

    def compress(
        self, data: bytes, force_general: bool = False
    ) -> Tuple[bytes, Dict[str, Any]]:
        if not data:
            return b"", {"engine": "empty", "feats": self.profiler.profile(b"")}

        feats = self.profiler.profile(data)
        meta: Dict[str, Any] = {
            "v": self.VERSION,
            "feats": feats,
            "engine": None,
            "transforms": [],
            "use_lz": False,
        }

        # --- Router: never steal ZRW domain ---
        if not force_general and self.should_route_to_zrw(feats):
            meta["engine"] = "ZRW_delegate"
            meta["transforms"].append({"type": "zrw_handoff"})
            if self.zrw_compress is not None:
                payload = self.zrw_compress(data)
                meta["zrw_live"] = True
            else:
                # Placeholder until real ZRW is wired: still framed + zlib for round-trip
                payload = entropy_encode(data)
                meta["zrw_live"] = False
                meta["zrw_note"] = "delegate_stub_zlib"
            return self._frame(payload, meta), meta

        # --- Specialist paths (complementary) ---
        transformed = data
        use_lz = True

        # Float lane only when not text-like and not structured-int dominant
        if (
            feats["float_like"] >= self.float_threshold
            and feats["printable"] < 0.55
            and feats["linearity"] < 0.85
        ):
            transformed, tmeta = float_predict_xor(transformed)
            meta["transforms"].append(tmeta)
            meta["engine"] = "float_xor+entropy"
            use_lz = False  # keep XOR stream aligned for reverse
        elif feats["printable"] >= self.text_threshold or (
            len(data) >= 1 and (b"{" in data[:1024] or b"<" in data[:1024])
        ):
            transformed, tmeta = structural_json_ish_split(transformed)
            meta["transforms"].append(tmeta)
            meta["engine"] = "struct_text+lz+entropy"
        elif feats["linearity"] > 0.5 and len(data) % 4 == 0:
            transformed, tmeta = simple_delta_int(transformed)
            meta["transforms"].append(tmeta)
            meta["engine"] = "delta+lz+entropy"
        else:
            meta["engine"] = "general_lz_entropy"

        # Toy LZ77 is O(n·match) — fine for demos; skip on large payloads (entropy is enough).
        meta["use_lz"] = use_lz and len(transformed) <= 256 * 1024
        if meta["use_lz"]:
            intermediate = lz77_encode(transformed)
            meta["transforms"].append({"type": "lz77"})
        else:
            intermediate = transformed
            if use_lz and meta.get("engine") and "+lz+" in str(meta["engine"]):
                meta["engine"] = str(meta["engine"]).replace("+lz+", "+")

        payload = entropy_encode(intermediate)
        return self._frame(payload, meta), meta

    def decompress(self, framed: bytes) -> bytes:
        payload, meta = self._unframe(framed)

        if meta.get("engine") == "ZRW_delegate":
            if self.zrw_decompress is not None and meta.get("zrw_live"):
                return self.zrw_decompress(payload)
            return entropy_decode(payload)

        data = entropy_decode(payload)

        # Reverse transforms last-applied-first
        for t in reversed(meta.get("transforms", [])):
            if not isinstance(t, dict):
                continue
            typ = t.get("type")
            if typ == "lz77":
                data = lz77_decode(data)
            elif typ == "float_xor":
                data = float_predict_xor_reverse(data, int(t.get("width", 4)))
            elif typ == "delta_i32":
                data = simple_delta_int_reverse(data)
            elif typ in ("struct_split", "raw", "zrw_handoff"):
                pass

        return data

    def _frame(self, payload: bytes, meta: Dict[str, Any]) -> bytes:
        meta_bytes = json.dumps(meta, default=str, separators=(",", ":")).encode(
            "utf-8"
        )
        header = struct.pack("<4sII", self.MAGIC, self.VERSION, len(meta_bytes))
        return header + meta_bytes + payload

    def _unframe(self, framed: bytes) -> Tuple[bytes, Dict[str, Any]]:
        if len(framed) < 12 or framed[:4] != self.MAGIC:
            raise ValueError("Not OmniWave frame")
        _ver, meta_len = struct.unpack_from("<II", framed, 4)
        meta = json.loads(framed[12 : 12 + meta_len].decode("utf-8"))
        payload = framed[12 + meta_len :]
        return payload, meta


# ====================== DEMO / BENCH HOOK ======================

if __name__ == "__main__":
    ow = OmniWave()

    tests = {
        "high_entropy_pattern": bytes([i % 256 for i in range(10000)]),
        "text_general": (
            b"The quick brown fox jumps over the lazy dog. " * 200
            + b'{"key": "value", "nested": [1,2,3]}'
        ),
        "float_series": b"".join(
            struct.pack("<f", math.sin(i / 10.0) * 100) for i in range(2500)
        ),
        "zeros_should_handoff": b"\x00" * 4000,
        "mixed_binary": bytes(range(256)) * 40,
        "ramp_i32": b"".join(struct.pack("<i", i) for i in range(2000)),
    }

    print("=== OmniWave Complementary Strength Demo ===\n")
    fails = 0
    for name, data in tests.items():
        comp, meta = ow.compress(data)
        ratio = len(data) / max(1, len(comp) - 12)
        try:
            roundtrip = ow.decompress(comp)
            ok = roundtrip == data
        except Exception as e:
            ok = False
            print(f"  decompress error: {e}")
        if not ok:
            fails += 1
        feats = meta.get("feats", {})
        print(f"{name}:")
        print(
            f"  In: {len(data)} B → Out: {len(comp)} B | ~ratio {ratio:.2f}x | Engine: {meta.get('engine')}"
        )
        print(
            f"  Feats: ent={feats.get('entropy', 0):.2f} "
            f"float_like={feats.get('float_like', 0):.2f} "
            f"print={feats.get('printable', 0):.2f} "
            f"lin={feats.get('linearity', 0):.2f} "
            f"zero={feats.get('zero_ratio', 0):.2f}"
        )
        print(f"  Roundtrip: {'PASS' if ok else 'FAIL'}\n")

    print("Integration: In SPL Codec, call OmniWave when ZRW score is low.")
    print("Wire zrw_compress/zrw_decompress for live ZRW handoff.")
    print("Upgrade entropy_encode to zstd/brotli + full structural parser for prod.")
    raise SystemExit(1 if fails else 0)
