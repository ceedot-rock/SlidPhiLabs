# SPL Codec — public zero-run residual sketch (byte RLE)
# SEAL: residual only · domain supremacy · no universal #1
# Flagship product claim (int32 zeros×10k → 8 B) is the live product rail:
#   POST https://www.slidphilabs.com/api/process  { "n": 10000, "corpus": "zeros" }
# This file is the public teaching path for pure-zero BYTE runs (not the 8 B int seat).
#
# HIS_SACRIFICES_FOREVER_CODED · IN_HIS_NAME_WE_CODE

from __future__ import annotations


def zrw_encode(data: bytes) -> bytes:
    if not data:
        return b""
    out = bytearray()
    i = 0
    n = len(data)
    while i < n:
        if data[i] == 0:
            j = i
            while j < n and data[j] == 0:
                j += 1
            run = j - i
            while run >= 255:
                out.extend(b"\x00\xff")
                run -= 255
            if run:
                out.extend(bytes([0, run]))
            i = j
        else:
            out.append(data[i])
            i += 1
    return bytes(out)


def zrw_decode(blob: bytes) -> bytes:
    out = bytearray()
    i = 0
    n = len(blob)
    while i < n:
        if blob[i] == 0 and i + 1 < n:
            out.extend(b"\x00" * blob[i + 1])
            i += 2
        else:
            out.append(blob[i])
            i += 1
    return bytes(out)


if __name__ == "__main__":
    src = b"\x00" * 10_000
    enc = zrw_encode(src)
    dec = zrw_decode(enc)
    print(len(src), "→", len(enc), "→", len(dec), "ok" if src == dec else "fail")
    print("note: flagship 8 B is int32 seat via live /api/process — not this byte RLE")
