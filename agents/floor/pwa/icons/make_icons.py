#!/usr/bin/env python3
"""Build pwa/icons/icon-{192,512}.png with stdlib only (zlib + struct).

Dark rounded square, gold ring, gold bar: the floor's phi mark.
Re-run after any rebrand:  python make_icons.py
"""
import os
import struct
import zlib

HERE = os.path.dirname(os.path.abspath(__file__))
BG = (13, 17, 23)
GOLD = (212, 167, 44)


def circle(img, n, cx, cy, r, w, color):
    for y in range(n):
        for x in range(n):
            d = abs(((x - cx) ** 2 + (y - cy) ** 2) ** 0.5 - r)
            if d <= w / 2:
                img[y][x] = color


def rounded(img, n, rad, color):
    for y in range(n):
        for x in range(n):
            if x < rad and y < rad and (x - rad) ** 2 + (y - rad) ** 2 > rad ** 2:
                img[y][x] = None
            if x >= n - rad and y < rad and (x - (n - rad)) ** 2 + (y - rad) ** 2 > rad ** 2:
                img[y][x] = None
            if x < rad and y >= n - rad and (x - rad) ** 2 + (y - (n - rad)) ** 2 > rad ** 2:
                img[y][x] = None
            if x >= n - rad and y >= n - rad and (x - (n - rad)) ** 2 + (y - (n - rad)) ** 2 > rad ** 2:
                img[y][x] = None


def make(n):
    img = [[BG for _ in range(n)] for _ in range(n)]
    rounded(img, n, int(n * 0.22), None)
    circle(img, n, n / 2, n / 2, n * 0.27, max(2, n * 0.07), GOLD)
    bw = max(2, int(n * 0.07))
    for y in range(int(n * 0.16), int(n * 0.84)):
        for x in range(n // 2 - bw // 2, n // 2 + bw // 2):
            img[y][x] = GOLD
    raw = b"".join(b"\x00" + b"".join(
        b"\x00\x00\x00\x00" if px is None else bytes((*px, 255)) for px in row) for row in img)

    def chunk(tag, data):
        c = struct.pack(">I", len(data)) + tag + data
        return c + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    png = (b"\x89PNG\r\n\x1a\n"
           + chunk(b"IHDR", struct.pack(">IIBBBBB", n, n, 8, 6, 0, 0, 0))
           + chunk(b"IDAT", zlib.compress(raw, 9))
           + chunk(b"IEND", b""))
    path = os.path.join(HERE, "icon-%d.png" % n)
    with open(path, "wb") as f:
        f.write(png)
    return path, len(png)


if __name__ == "__main__":
    for size in (192, 512):
        print("%s (%d bytes)" % make(size))
