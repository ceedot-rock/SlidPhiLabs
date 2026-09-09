#!/usr/bin/env python3
"""Official Silesia 12, files individually. DECODE_OK or the row is not a keep.
Opponents gzip-9 / bzip2-9 / xz-6. Ours: pulsar, pcc, champ, best, aware.
"""
from __future__ import annotations

import json, os, subprocess, tempfile, time
from pathlib import Path

SILESIA = Path(os.environ.get("SILESIA", "/home/ceedotrock/data/silesia"))
LB = os.environ.get("LB", "/home/ceedotrock/projects/lbr1/target/release/lb")
PULSAR = os.environ.get("PULSAR", "/home/ceedotrock/projects/SlidPhiLabs/docs/site/bin/pulsar")
OUT = Path(os.environ.get("OUT", "/home/ceedotrock/projects/SlidPhiLabs/docs/site/silesia.json"))
ENC_T = int(os.environ.get("ENC_T", "180"))
DEC_T = int(os.environ.get("DEC_T", "90"))

# Mahoney column order
FILES = [
    "dickens", "mozilla", "mr", "nci", "ooffice", "osdb",
    "reymont", "samba", "sao", "webster", "x-ray", "xml",
]

def run(cmd, timeout):
    t0 = time.time()
    p = subprocess.run(cmd, capture_output=True, timeout=timeout)
    ms = int((time.time() - t0) * 1000)
    return p.returncode, ms, p.stdout, p.stderr

def encode_decode(name, encode_cmd, decode_cmd, raw_path, raw):
    d = Path(tempfile.mkdtemp(prefix="sil-"))
    packed = d / "p.bin"
    back = d / "b.bin"
    try:
        enc = list(encode_cmd(raw_path, packed))
        rc, enc_ms, _, err = run(enc, ENC_T)
        if rc != 0 or not packed.exists():
            return {"ok": False, "error": f"encode rc={rc} {err[-200:]}", "encode_ms": enc_ms}
        size = packed.stat().st_size
        dec = list(decode_cmd(packed, back))
        rc, dec_ms, _, err = run(dec, DEC_T)
        if rc != 0 or not back.exists():
            return {"ok": False, "error": f"decode rc={rc}", "packed_bytes": size, "encode_ms": enc_ms, "decode_ms": dec_ms}
        got = back.read_bytes()
        ok = got == raw
        return {
            "ok": ok,
            "decode_ok": ok,
            "packed_bytes": size,
            "encode_ms": enc_ms,
            "decode_ms": dec_ms,
            "error": None if ok else "roundtrip_mismatch",
        }
    except subprocess.TimeoutExpired:
        return {"ok": False, "error": "timeout"}
    finally:
        for p in (packed, back):
            try:
                p.unlink()
            except FileNotFoundError:
                pass
        try:
            d.rmdir()
        except OSError:
            pass

PATHWAYS = {
    "pulsar": (
        lambda inn, out: [PULSAR, "encode", str(inn), "-o", str(out)],
        lambda inn, out: [PULSAR, "decode", str(inn), "-o", str(out)],
    ),
    "pcc": (
        lambda inn, out: [LB, "pcc", str(inn), str(out)],
        lambda inn, out: [LB, "decode", str(inn), str(out)],
    ),
    "champ": (
        lambda inn, out: [LB, "champ", str(inn), str(out)],
        lambda inn, out: [LB, "decode", str(inn), str(out)],
    ),
    "best": (
        lambda inn, out: [LB, "best", str(inn), str(out)],
        lambda inn, out: [LB, "decode", str(inn), str(out)],
    ),
    "aware": (
        lambda inn, out: [LB, "aware", str(inn), str(out)],
        lambda inn, out: [LB, "decode", str(inn), str(out)],
    ),
    "gzip-9": (
        lambda inn, out: ["bash", "-lc", f"gzip -9 -c {inn} > {out}"],
        lambda inn, out: ["bash", "-lc", f"gzip -dc {inn} > {out}"],
    ),
    "bzip2-9": (
        lambda inn, out: ["bash", "-lc", f"bzip2 -9 -c {inn} > {out}"],
        lambda inn, out: ["bash", "-lc", f"bzip2 -dc {inn} > {out}"],
    ),
    "xz-6": (
        lambda inn, out: ["bash", "-lc", f"xz -6 -c {inn} > {out}"],
        lambda inn, out: ["bash", "-lc", f"xz -dc {inn} > {out}"],
    ),
}

def mahoney_kb(n):
    return n // 1000

def main():
    rows = {f: {"raw": (SILESIA / f).stat().st_size} for f in FILES}
    totals = {}
    for pw, (enc, dec) in PATHWAYS.items():
        print(f"== {pw} ==", flush=True)
        total = 0
        keeps = 0
        for f in FILES:
            raw_path = SILESIA / f
            raw = raw_path.read_bytes()
            print(f"  {f} {len(raw)}...", flush=True)
            r = encode_decode(pw, enc, dec, raw_path, raw)
            rows[f][pw] = r
            if r.get("decode_ok"):
                total += r["packed_bytes"]
                keeps += 1
                print(f"    {r['packed_bytes']} DECODE_OK enc={r.get('encode_ms')}ms", flush=True)
            else:
                print(f"    FAIL {r.get('error')}", flush=True)
        totals[pw] = {"packed_bytes": total if keeps == 12 else None, "decode_ok": keeps, "n": 12}
        print(f"  TOTAL {pw} keeps={keeps}/12 packed={totals[pw]['packed_bytes']}", flush=True)

    # Mahoney lines for complete keeps
    lines = []
    for pw, t in totals.items():
        if t["decode_ok"] != 12 or t["packed_bytes"] is None:
            continue
        kbs = [str(mahoney_kb(rows[f][pw]["packed_bytes"])) for f in FILES]
        lines.append(f"{t['packed_bytes']}  " + " ".join(f"{k:>5}" for k in kbs) + f"  {pw}")

    report = {
        "ok": True,
        "corpus": "Silesia 12 official, files individually",
        "raw_total": 211_938_580,
        "at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "host": "linux x86_64",
        "lb": "pcc-0.12.1",
        "pulsar": "2.5.0",
        "plain": "Official Silesia 12. DECODE_OK required. gzip/bzip2/xz are opponents, not occupants. Not a #1 claim. Hosted API cap is 4 MiB so this table is local lb/pulsar, not POST /api/compress.",
        "source": {
            "pulsar": "https://github.com/ceedot-rock/pulsar-best",
            "pcc": "https://github.com/ceedot-rock/lbr1",
            "champ": "https://github.com/ceedot-rock/lbr1",
            "best": "https://github.com/ceedot-rock/lbr1",
            "aware": "https://github.com/ceedot-rock/lbr1",
        },
        "totals": totals,
        "files": rows,
        "mahoney_lines": lines,
        "oscb": "https://mattmahoney.net/dc/silesia.html",
    }
    OUT.write_text(json.dumps(report, indent=2))
    print("wrote", OUT)
    for line in lines:
        print("MAHONEY", line)

if __name__ == "__main__":
    main()
