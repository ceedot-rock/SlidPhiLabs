/**
 * Hosted compression on this machine: zeros specialist + pulsar 2.5.0.
 * gzip/brotli/xz/bzip2 are not occupants. Combined GC / LBR1 / ASMD are not here.
 */
import { looksPulsar, pulsarDecode, pulsarEncode } from "./pulsar-host.mjs";

export const MAGIC = Buffer.from("SPLS");
export const VER = 1;
export const T_ZERO = 0x00;
export const SEAT_FILL = 1;
export const SEAT_PULSAR = 2;
export const SEAT_STORE = 3;
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

export async function encodeHosted(raw) {
  const b = Buffer.from(raw);
  if (!b.length) throw new Error("empty_body");
  if (b.length > MAX_RAW) throw new Error("too_large");
  const cls = classify(b);
  if (cls.seat === "fill") return { ...encodeFill(b), classify: cls };

  let inner = null;
  try {
    inner = await pulsarEncode(b);
  } catch (e) {
    const msg = String(e.message || e);
    if (/ENOENT|spawn/i.test(msg)) {
      throw new Error("hosted_pulsar_missing");
    }
    throw e;
  }
  const method = inner ? "pulsar" : "store";
  const payload = inner || b;
  const seat = inner ? SEAT_PULSAR : SEAT_STORE;
  const frame = wrapSeat(seat, payload);
  const back = await decodeFrame(frame);
  if (!back.equals(b)) throw new Error("roundtrip_fail");
  return {
    ok: true,
    plain: inner
      ? `Hosted pulsar compressed this file from ${b.length} bytes to ${payload.length} bytes. Restore with POST /api/decompress. First 2 GB/month are free, then 8¢/GB.`
      : `This file did not get smaller. We stored it as-is (our store path, not gzip). Restore with POST /api/decompress.`,
    seat: cls.seat,
    occupant: method,
    method,
    license: inner ? "GPL-3.0-or-later" : "store",
    runs_here: true,
    raw_bytes: b.length,
    packed_bytes: payload.length,
    frame_bytes: frame.length,
    packed_b64: frame.toString("base64"),
    roundtrip: true,
    lab_gene: Boolean(inner),
    host_fallback: false,
    classify: cls,
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
  if (seat === SEAT_PULSAR) return pulsarDecode(inner);
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
    plain: "POST a file. All-zero files become 8 bytes. Everything else runs pulsar 2.5.0 on this host (or store if it would not shrink). First 2 GB each month are free, then 8¢/GB. The private encoder is not on this host.",
    never: NEVER,
    seats: {
      fill: { occupant: "zeros", runs_here: true, license: "public-demo" },
      pulsar: {
        occupant: "pulsar 2.5.0",
        runs_here: true,
        license: "GPL-3.0-or-later",
        commercial_sku: "pulsar-exception",
        pay: BUY.pulsar_exception,
      },
      store: { occupant: "store", runs_here: true, note: "Incompressible. Our path, not gzip." },
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
