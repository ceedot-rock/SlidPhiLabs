/**
 * Hosted compression on this machine. Every own pathway is a candidate:
 * zeros, pulsar, LBR1, Combined GC, LZ wrap, PAQ wrap. Smallest DECODE_OK wins.
 * AWARE programs (repeat / walk_lcg / walk_d1): price via peel helpers; Kolmogorov
 * seating is rebuilt bin/lb (`lb aware`) from lbr1 main — not the JS twin alone.
 */
import { looksPulsar, pulsarDecode, pulsarEncode } from "./pulsar-host.mjs";
import { lbAware, lbDecode, lbEncode } from "./engines.mjs";
import { inspectWalkProgram, priceWalkProgram } from "./walk-peel.mjs";
import { inspectRepeatProgram, priceRepeatProgram } from "./repeat-peel.mjs";

export const MAGIC = Buffer.from("SPLS");
export const VER = 1;
export const T_ZERO = 0x00;
export const SEAT_FILL = 1;
export const SEAT_PULSAR = 2;
export const SEAT_STORE = 3;
export const SEAT_LB = 4;
export const MAX_RAW = 4_194_304;
export const EXPAND_CAP = 8_388_608;

export const NEVER = Object.freeze([
  "Combined GC",
  "LBR1",
  "ASMD",
  "gzip",
  "brotli",
  "xz",
  "bzip2",
]);

const SITE = "https://www.slidphilabs.com";

export const BUY = Object.freeze({
  pulsar_exception: `${SITE}/pay?sku=pulsar-exception`,
  gc_day: `${SITE}/pay?sku=gc-day`,
  gc_month: `${SITE}/pay?sku=gc-month`,
  gc_year: `${SITE}/pay?sku=gc-year`,
  lab_pass: `${SITE}/pay?sku=lab-pass`,
  oss_support: `${SITE}/pay?sku=oss-support`,
  license: `${SITE}/license`,
  terms: `${SITE}/COMMERCIAL-LICENSE.md`,
  sot: `${SITE}/licensing.json`,
  pulsar: `${SITE}/pulsar`,
  pulsar_source: "https://github.com/ceedot-rock/pulsar-best",
  aware: `${SITE}/gc`,
  inbox: "corey@slidphilabs.com",
});

export function packZeroRun(length) {
  const n = Number(length) >>> 0;
  const out = Buffer.alloc(8);
  out[0] = T_ZERO;
  out.writeUInt32LE(n, 1);
  return out;
}

export function unpackZeroRun(buf) {
  const b = Buffer.from(buf);
  if (b.length < 8 || b[0] !== T_ZERO) throw new Error("not a T_ZERO frame");
  return b.readUInt32LE(1);
}

export function wrapSeat(seat, inner) {
  const hdr = Buffer.alloc(6);
  MAGIC.copy(hdr);
  hdr[4] = VER;
  hdr[5] = seat;
  return Buffer.concat([hdr, inner]);
}

export function wrapFill(inner) {
  return wrapSeat(SEAT_FILL, inner);
}

export function unwrap(frame) {
  const f = Buffer.from(frame);
  if (f.length >= 6 && f.subarray(0, 4).equals(MAGIC)) {
    return { magic: "SPLS", ver: f[4], seat: f[5], inner: f.subarray(6) };
  }
  if (f.length >= 8 && f[0] === T_ZERO) {
    return { magic: "T_ZERO", ver: 0, seat: SEAT_FILL, inner: f };
  }
  if (looksPulsar(f)) {
    return { magic: "pulsar", ver: 0, seat: SEAT_PULSAR, inner: f };
  }
  throw new Error("unknown specialist frame");
}

export function classify(buf) {
  const u8 = Buffer.from(buf);
  if (!u8.length) return { seat: "empty", path: "store", zeros: 0, texty: 0 };
  let z = 0;
  let texty = 0;
  for (let i = 0; i < u8.length; i++) {
    if (u8[i] === 0) z++;
    const c = u8[i];
    if ((c >= 32 && c <= 126) || c === 9 || c === 10 || c === 13) texty++;
  }
  if (z === u8.length) return { seat: "fill", path: "fill", zeros: z, texty };
  if (texty / u8.length > 0.82) {
    return { seat: "struct_text", path: "pulsar", zeros: z, texty };
  }
  return { seat: "archive", path: "pulsar", zeros: z, texty };
}

export function encodeFill(raw) {
  const b = Buffer.from(raw);
  if (!b.length) throw new Error("empty_body");
  if (b.length > MAX_RAW) throw new Error("too_large");
  for (let i = 0; i < b.length; i++) {
    if (b[i] !== 0) throw new Error("fill_seat_zeros_only");
  }
  const inner = packZeroRun(b.length);
  const frame = wrapFill(inner);
  return {
    ok: true,
    plain: "This file was all zeros. We compressed it to 8 bytes. You can restore it. This demo is free.",
    seat: "fill",
    occupant: "fill",
    method: "zeros",
    license: "public-demo",
    runs_here: true,
    raw_bytes: b.length,
    packed_bytes: inner.length,
    frame_bytes: frame.length,
    packed_b64: frame.toString("base64"),
    roundtrip: true,
    lab_gene: true,
    host_fallback: false,
    flagship: b.length === 1_000_000 && inner.length === 8,
    claim_check: {
      zeros: true,
      packed_8: inner.length === 8,
      matches_flagship_8b_on_1e6: b.length === 1_000_000 && inner.length === 8,
      matches_flagship_8b_on_10k_i32: b.length === 40_000 && inner.length === 8,
    },
  };
}

function occupantName(runner, blob) {
  if (!blob || blob.length < 4) return runner;
  const mag = blob.subarray(0, 4).toString("latin1");
  if (mag === "LZW1") return "lz";
  if (mag === "PCAQ") return "paq";
  if (mag === "BW22" || mag === "BW23") return "pulsar";
  if (mag === "TR8\0" || mag.startsWith("TR8")) return "fill";
  const walk = inspectWalkProgram(blob);
  if (walk) return walk.model;
  const rep = inspectRepeatProgram(blob);
  if (rep) return rep.model;
  if (mag === "LBHX") return runner === "aware" ? "aware" : runner;
  return runner;
}

export async function encodeHosted(raw) {
  const b = Buffer.from(raw);
  if (!b.length) throw new Error("empty_body");
  if (b.length > MAX_RAW) throw new Error("too_large");
  const cls = classify(b);
  if (cls.seat === "fill") return { ...encodeFill(b), classify: cls };

  // Price AWARE programs (repeat / walk) before general bake-off. Seating itself
  // is `lb aware` once Ship refreshes docs/site/bin/lb from lbr1 main.
  // Prefer repeat when it matches (byte periodic crown; tried first in lbr1).
  const repeatSku = priceRepeatProgram(b);
  const walkSku = repeatSku ? null : priceWalkProgram(b);
  const awareSku = repeatSku || walkSku;

  const tries = [];
  const run = async (name, fn, seat) => {
    try {
      const blob = await fn(b);
      if (blob && blob.length < b.length) tries.push({ name, blob, seat });
    } catch (e) {
      const msg = String(e.message || e);
      if (/ENOENT|spawn|hosted_/i.test(msg)) return;
      if (e.killed || e.signal === "SIGTERM") return;
    }
  };
  // When raw matches an AWARE program, prefer AWARE first (crown path).
  if (awareSku) {
    await run("aware", lbAware, SEAT_LB);
  }
  await run("pulsar", pulsarEncode, SEAT_PULSAR);
  await run("lbr1", lbEncode, SEAT_LB);
  if (!awareSku) {
    await run("aware", lbAware, SEAT_LB);
  }
  tries.sort((a, b) => a.blob.length - b.blob.length);
  const win = tries[0];
  const method = win ? occupantName(win.name, win.blob) : "store";
  const payload = win ? win.blob : b;
  const seat = win ? win.seat : SEAT_STORE;
  const frame = wrapSeat(seat, payload);
  const back = await decodeFrame(frame);
  if (!back.equals(b)) throw new Error("roundtrip_fail");

  const seated = win
    ? inspectRepeatProgram(win.blob) || inspectWalkProgram(win.blob)
    : null;
  const crownNote = (m) => {
    if (m.model === "repeat") {
      return `Kolmogorov crown seated by bin/lb aware (aware_bytes=${m.aware_bytes}; unit_len=${m.unit_len})`;
    }
    if (m.model === "walk_lcg") {
      return "Kolmogorov crown seated by bin/lb aware (aware_bytes=9)";
    }
    return "walk_d1 ladder seated by bin/lb aware";
  };
  const program = seated
    ? {
        ...seated,
        seated: true,
        note: crownNote(seated),
      }
    : awareSku
      ? {
          ...awareSku,
          seated: false,
          note: "SKU prices the program; refresh docs/site/bin/lb from lbr1 main to seat the crown via lb aware",
        }
      : undefined;

  let plain;
  if (seated?.model === "repeat") {
    plain = `Hosted repeat priced the program {unit_len:${seated.unit_len},n:${seated.n}} — ${seated.aware_bytes} B aware pack (${payload.length} B LBHX frame) on ${b.length} B. Restore with POST /api/decompress.`;
  } else if (seated?.model === "walk_lcg") {
    plain = `Hosted walk_lcg priced the program {step:${seated.step},seed:${seated.seed}} — ${seated.aware_bytes} B aware pack (${payload.length} B LBHX frame) on ${b.length} B. Restore with POST /api/decompress.`;
  } else if (win) {
    plain = `Hosted ${method} compressed this file from ${b.length} bytes to ${payload.length} bytes. Restore with POST /api/decompress. First 2 GB/month are free, then 8¢/GB.`;
  } else {
    plain = `This file did not get smaller. We stored it as-is (our store path, not gzip). Restore with POST /api/decompress.`;
  }

  return {
    ok: true,
    plain,
    seat: cls.seat,
    occupant: method,
    method,
    license: method === "pulsar" ? "GPL-3.0-or-later" : method === "store" ? "store" : "hosted-access",
    runs_here: true,
    raw_bytes: b.length,
    packed_bytes: payload.length,
    frame_bytes: frame.length,
    packed_b64: frame.toString("base64"),
    roundtrip: true,
    lab_gene: Boolean(win),
    host_fallback: false,
    classify: cls,
    ...(program ? { program } : {}),
    buy: { gc_month: BUY.gc_month, gc_year: BUY.gc_year },
  };
}

export async function decodeFrame(frame) {
  const { seat, inner } = unwrap(frame);
  if (seat === SEAT_FILL) {
    const n = unpackZeroRun(inner);
    if (n > EXPAND_CAP) throw new Error("expand_cap");
    return Buffer.alloc(n);
  }
  if (seat === SEAT_STORE) return Buffer.from(inner);
  if (seat === SEAT_PULSAR) {
    try {
      return await pulsarDecode(inner);
    } catch {
      return lbDecode(inner);
    }
  }
  if (seat === SEAT_LB) return lbDecode(inner);
  throw new Error("unknown seat " + seat);
}

export function decodeFill(frame) {
  const { seat, inner } = unwrap(frame);
  if (seat !== SEAT_FILL) throw new Error("not a zeros frame");
  const n = unpackZeroRun(inner);
  if (n > EXPAND_CAP) throw new Error("expand_cap");
  return Buffer.alloc(n);
}

export async function route(raw) {
  return encodeHosted(raw);
}

export function machineCard() {
  return {
    ok: true,
    machine: "hosted-compression",
    job: "encode",
    plain: "POST a file. Hosted lossless compression, dual-licensed. All-zero files become 8 bytes. Every pathway we own runs on this machine; we keep the smallest result that restores. First 2 GB each month are free, then 8¢/GB. npm: slid-phi. MCP: spl_compress.",
    never: NEVER,
    seats: {
      fill: { occupant: "zeros", runs_here: true, license: "public-demo" },
      pulsar: { occupant: "pulsar 2.5.0", runs_here: true, license: "GPL-3.0-or-later" },
      lbr1: { occupant: "LBR1", runs_here: true, license: "hosted-access" },
      aware: { occupant: "AWARE house (repeat / walk_lcg / walk_d1 when bin/lb from lbr1 main)", runs_here: true, license: "hosted-access" },
      lz: { occupant: "LZ wrap", runs_here: true, license: "hosted-access" },
      paq: { occupant: "PAQ wrap", runs_here: true, license: "hosted-access" },
      store: { occupant: "store", runs_here: true },
    },
    how: "POST raw bytes or JSON { corpus:'zeros', n:1000000 } or { text } or { data_b64 }. Decode: POST { op:'decode', data_b64 } or POST /api/decompress.",
    curl: `python3 -c "open('z.bin','wb').write(bytes(1000000))" && curl -sS -X POST https://www.slidphilabs.com/api/compress -H 'content-type: application/octet-stream' --data-binary @z.bin`,
    meter: {
      plain: "First 2 GB each month are free. After that, 8¢ per GB. Card charges start at $1.",
      free_gb: 2,
      usd_per_gb: 0.08,
      min_paid_usd: 1,
      window: "calendar_month",
    },
    max_raw: MAX_RAW,
    sot: BUY.sot,
    terms: BUY.terms,
    inbox: BUY.inbox,
  };
}

export function inputToRaw(input) {
  if (input == null) throw new Error("empty_body");
  if (Buffer.isBuffer(input) || input instanceof Uint8Array) return Buffer.from(input);
  if (typeof input === "string") return Buffer.from(input, "utf8");
  if (typeof input !== "object") throw new Error("empty_or_bad_input");
  if (input.data_b64) return Buffer.from(String(input.data_b64), "base64");
  if (input.text != null) return Buffer.from(input.text, "utf8");
  const corpus = String(input.corpus || "zeros");
  const n = Math.min(MAX_RAW, Math.max(1, Number(input.n) || 1_000_000));
  if (corpus === "zeros") return Buffer.alloc(n);
  throw new Error("need_zeros_text_or_data_b64");
}
