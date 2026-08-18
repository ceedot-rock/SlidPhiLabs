/**
 * SPLB 24h black box — every product use-route.
 * First use opens 24 hours. Then a paid seat (Lab Pass / product year).
 * Tamper-evident cookie: started timestamp must not go backwards.
 */
import { createHmac, randomBytes } from "node:crypto";

export const BOX_MS = 24 * 3600 * 1000;
export const PROTOCOL = "splb-ed25519-24h";
export const BUY = {
  gate_year: "https://buy.stripe.com/7sY4gA6Jfapy1GZ8gw6wE0G",
  tru8_year: "https://buy.stripe.com/dRmaEY6Jf1T23P78gw6wE0E",
  chamber_year: "https://buy.stripe.com/dRmeVeaZv7dm99rcwM6wE0F",
  lab_pass: "https://buy.stripe.com/3cI7sM2sZ0OYfxP7cs6wE0D",
  license: "https://www.slidphilabs.com/license",
};
export const SEATS = new Set([
  "lab-pass",
  "lab-pass-year",
  "tru8-year",
  "tru8-month",
  "tru8-day",
  "gate-year",
  "gate-month",
  "gate-day",
  "chamber-year",
  "chamber-month",
  "chamber-day",
  "trugame-year",
  "trugame-month",
  "trugame-pass",
]);

const COOKIE = "spl_box";

export function parseCookies(req) {
  const raw = req.headers?.cookie || "";
  const out = {};
  for (const part of String(raw).split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function seatSecret() {
  return process.env.SPL_SEAT_SECRET || process.env.X402_CLAIM_SECRET || "";
}

export function signSeat(sku, seatId) {
  const secret = seatSecret();
  if (!secret) return "";
  const body = `${sku}:${seatId}`;
  return createHmac("sha256", secret).update(body).digest("hex");
}

export function seatOk(req) {
  if (process.env.SPL_UNLOCK === "1") return { ok: true, sku: "env" };
  const h = req.headers || {};
  const sku = String(h["x-spl-seat"] || h["x-spl-sku"] || "").toLowerCase();
  const id = String(h["x-spl-seat-id"] || "");
  const sig = String(h["x-spl-seat-sig"] || "");
  if (!SEATS.has(sku) || !id) return { ok: false };
  const secret = seatSecret();
  if (!secret) return { ok: false };
  const want = signSeat(sku, id);
  if (sig.length === 64 && sig === want) return { ok: true, sku, id };
  return { ok: false };
}

export function readBox(req) {
  const c = parseCookies(req);
  const raw = c[COOKIE] || String(req.headers?.["x-spl-box"] || "");
  const m = /^([a-f0-9]{16,})\.(\d{10,})$/i.exec(raw);
  if (!m) return null;
  return { id: m[1], started: Number(m[2]) };
}

export function inspect(req) {
  const paid = seatOk(req);
  if (paid.ok) {
    return { ok: true, protocol: PROTOCOL, door: "seat", sku: paid.sku, box_open: true, hours_left: null };
  }
  const box = readBox(req);
  const now = Date.now();
  if (!box) {
    return { ok: true, protocol: PROTOCOL, door: "open", first: true, box_open: true, hours_left: 24 };
  }
  if (box.started > now + 60_000) {
    return { ok: false, protocol: PROTOCOL, error: "HALT: clock tamper", tamper: "HALT" };
  }
  const left = BOX_MS - (now - box.started);
  if (left > 0) {
    return {
      ok: true,
      protocol: PROTOCOL,
      door: "black-box",
      box: box.id,
      box_open: true,
      hours_left: +(left / 3600000).toFixed(3),
    };
  }
  return {
    ok: false,
    protocol: PROTOCOL,
    door: "gated",
    box_open: false,
    hours_left: 0,
    error: "black box closed — buy a seat",
    buy: BUY,
    inbox: "corey@slidphilabs.com",
  };
}

export function admit(req, res, product = "lab") {
  const g = inspect(req);
  if (g.first) {
    const id = randomBytes(8).toString("hex");
    const started = Date.now();
    const val = `${id}.${started}`;
    res.setHeader(
      "Set-Cookie",
      `${COOKIE}=${val}; Path=/; Max-Age=31536000; SameSite=Lax`,
    );
    res.setHeader("x-spl-box", val);
    g.box = id;
  }
  res.setHeader("x-spl-protocol", PROTOCOL);
  if (g.ok) return g;
  res.statusCode = g.tamper ? 409 : 402;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify({ ok: false, product, ...g }));
  return g;
}

export function withProductBox(handler, product) {
  return async function boxed(req, res) {
    if (req.method === "OPTIONS") return handler(req, res);
    if (req.method === "GET") return handler(req, res);
    const g = admit(req, res, product);
    if (!g.ok) return;
    return handler(req, res);
  };
}
