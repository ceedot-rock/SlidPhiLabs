/**
 * One lab account for every public product.
 * Email + password. scrypt hash. HMAC JWT. File store ( /data if mounted ).
 */
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const ORIGINS = [
  "https://www.slidphilabs.com",
  "https://slidphilabs.fly.dev",
  "https://agentrider.fly.dev",
  "https://agentrider.vercel.app",
  "https://cuni-studio.fly.dev",
  "https://l33tsaas.fly.dev",
  "https://overlord-eye.fly.dev",
  "https://teachaid.fly.dev",
];

function dir() {
  const d = process.env.AUTH_DIR || (fs.existsSync("/data") ? "/data" : path.join(process.cwd(), "data"));
  fs.mkdirSync(d, { recursive: true });
  return d;
}

function secret() {
  const env = (process.env.AUTH_SECRET || process.env.LICENSE_HMAC_SECRET || "").trim();
  if (env.length >= 16) return env;
  const p = path.join(dir(), "auth-secret.txt");
  if (fs.existsSync(p)) return fs.readFileSync(p, "utf8").trim();
  const s = randomBytes(32).toString("hex");
  fs.writeFileSync(p, s, { mode: 0o600 });
  return s;
}

function storePath() {
  return path.join(dir(), "lab-users.json");
}

function load() {
  try {
    return JSON.parse(fs.readFileSync(storePath(), "utf8"));
  } catch {
    return { users: [] };
  }
}

function save(db) {
  fs.writeFileSync(storePath(), JSON.stringify(db, null, 2) + "\n");
}

function b64url(buf) {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function hashPass(password, salt) {
  const s = salt || randomBytes(16).toString("hex");
  const h = scryptSync(password, s, 32).toString("hex");
  return { salt: s, hash: h };
}

function checkPass(password, salt, hash) {
  const got = scryptSync(password, salt, 32);
  const want = Buffer.from(hash, "hex");
  return got.length === want.length && timingSafeEqual(got, want);
}

export function cors(req, res) {
  const o = req.headers.origin || "";
  if (ORIGINS.includes(o)) res.setHeader("Access-Control-Allow-Origin", o);
  else res.setHeader("Access-Control-Allow-Origin", ORIGINS[0]);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");
}

export function publicUser(u) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    created: u.created,
    doors: {
      studio: "https://cuni-studio.fly.dev/",
      rider: "https://agentrider.fly.dev/",
      chamber: "https://www.slidphilabs.com/chamber",
      box: "https://www.slidphilabs.com/box",
      l33tsaas: "https://l33tsaas.fly.dev/",
      overlord: "https://overlord-eye.fly.dev/",
      teachaid: "https://teachaid.fly.dev/",
    },
  };
}

export function signToken(user) {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({
      sub: user.id,
      email: user.email,
      name: user.name,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
    })
  );
  const sig = b64url(createHmac("sha256", secret()).update(`${header}.${payload}`).digest());
  return `${header}.${payload}.${sig}`;
}

export function readToken(tok) {
  if (!tok || tok.split(".").length !== 3) return null;
  const [h, p, s] = tok.split(".");
  const want = b64url(createHmac("sha256", secret()).update(`${h}.${p}`).digest());
  if (want.length !== s.length || !timingSafeEqual(Buffer.from(want), Buffer.from(s))) return null;
  try {
    const body = JSON.parse(Buffer.from(p, "base64url").toString("utf8"));
    if (body.exp && body.exp < Math.floor(Date.now() / 1000)) return null;
    return body;
  } catch {
    return null;
  }
}

export function signup({ email, password, name }) {
  const e = String(email || "")
    .trim()
    .toLowerCase();
  const n = String(name || "").trim() || e.split("@")[0];
  const pw = String(password || "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return { error: "bad_email", status: 400 };
  if (pw.length < 8) return { error: "password_min_8", status: 400 };
  const db = load();
  if (db.users.some((u) => u.email === e)) return { error: "email_taken", status: 409 };
  const { salt, hash } = hashPass(pw);
  const user = {
    id: randomBytes(8).toString("hex"),
    email: e,
    name: n.slice(0, 80),
    salt,
    hash,
    created: new Date().toISOString(),
  };
  db.users.push(user);
  save(db);
  return { user: publicUser(user), token: signToken(user) };
}

export function login({ email, password }) {
  const e = String(email || "")
    .trim()
    .toLowerCase();
  const pw = String(password || "");
  const db = load();
  const user = db.users.find((u) => u.email === e);
  if (!user || !checkPass(pw, user.salt, user.hash)) return { error: "bad_login", status: 401 };
  return { user: publicUser(user), token: signToken(user) };
}

export function meFromAuth(header) {
  const t = String(header || "").replace(/^Bearer\s+/i, "").trim();
  const body = readToken(t);
  if (!body) return null;
  const db = load();
  const user = db.users.find((u) => u.id === body.sub || u.email === body.email);
  return user ? publicUser(user) : null;
}
