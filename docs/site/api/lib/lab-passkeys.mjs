/**
 * WebAuthn passkeys for lab accounts. No extra npm.
 * Browser sends SPKI from AuthenticatorAttestationResponse.getPublicKey().
 */
import { createHash, createPublicKey, randomBytes, verify, timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const RP_ID = "www.slidphilabs.com";
const ORIGIN = "https://www.slidphilabs.com";

function dir() {
  const d = process.env.AUTH_DIR || (fs.existsSync("/data") ? "/data" : path.join(process.cwd(), "data"));
  fs.mkdirSync(d, { recursive: true });
  return d;
}

function chalPath() {
  return path.join(dir(), "passkey-challenges.json");
}

function loadChal() {
  try {
    return JSON.parse(fs.readFileSync(chalPath(), "utf8"));
  } catch {
    return { items: [] };
  }
}

function saveChal(db) {
  const now = Date.now();
  db.items = (db.items || []).filter((c) => c.exp > now).slice(-200);
  fs.writeFileSync(chalPath(), JSON.stringify(db) + "\n", { mode: 0o600 });
}

function b64url(buf) {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function fromB64url(s) {
  return Buffer.from(String(s || ""), "base64url");
}

export function beginChallenge({ email, purpose }) {
  const challenge = b64url(randomBytes(32));
  const db = loadChal();
  db.items.push({
    challenge,
    email: email ? String(email).trim().toLowerCase() : "",
    purpose: purpose || "login",
    exp: Date.now() + 5 * 60 * 1000,
  });
  saveChal(db);
  return {
    rpId: RP_ID,
    rpName: "Slid Phi Labs",
    challenge,
    timeout: 120000,
    userVerification: "preferred",
  };
}

function takeChallenge(challenge) {
  const db = loadChal();
  const i = (db.items || []).findIndex((c) => c.challenge === challenge);
  if (i < 0) return null;
  const row = db.items[i];
  if (row.exp < Date.now()) return null;
  db.items.splice(i, 1);
  saveChal(db);
  return row;
}

export function publicKeyCredentialCreationOptions({ user, email, name }) {
  const ch = beginChallenge({ email, purpose: "register" });
  return {
    ...ch,
    user: {
      id: b64url(Buffer.from(user.id, "utf8")),
      name: email,
      displayName: name || email,
    },
    pubKeyCredParams: [
      { type: "public-key", alg: -7 },
      { type: "public-key", alg: -257 },
    ],
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
    attestation: "none",
  };
}

function parseClientData(clientDataJSON) {
  const json = JSON.parse(fromB64url(clientDataJSON).toString("utf8"));
  if (json.origin !== ORIGIN && json.origin !== "https://slidphilabs.fly.dev") return null;
  return json;
}

function verifyAssertion({ spkiB64, clientDataJSON, authenticatorData, signature }) {
  const client = parseClientData(clientDataJSON);
  if (!client) return { ok: false, error: "bad_origin" };
  const clientHash = createHash("sha256").update(fromB64url(clientDataJSON)).digest();
  const authData = fromB64url(authenticatorData);
  const signed = Buffer.concat([authData, clientHash]);
  const key = createPublicKey({
    key: fromB64url(spkiB64),
    format: "der",
    type: "spki",
  });
  const sig = fromB64url(signature);
  const ok = verify(null, signed, key, sig);
  return { ok, client };
}

export function finishRegister({ user, credential, challenge }) {
  const row = takeChallenge(challenge);
  if (!row) return { error: "bad_challenge", status: 400 };
  const client = parseClientData(credential.clientDataJSON);
  if (!client || client.type !== "webauthn.create") return { error: "bad_client", status: 400 };
  if (client.challenge !== challenge) return { error: "challenge_mismatch", status: 400 };
  if (!credential.id || !credential.publicKey) return { error: "need_publicKey", status: 400 };
  user.passkeys = user.passkeys || [];
  user.passkeys.push({
    id: credential.id,
    publicKey: credential.publicKey,
    created: new Date().toISOString(),
  });
  return { ok: true };
}

export function finishLogin({ users, credential, challenge }) {
  const row = takeChallenge(challenge);
  if (!row) return { error: "bad_challenge", status: 400 };
  const credId = String(credential.id || "");
  let user = null;
  let pk = null;
  for (const u of users) {
    const hit = (u.passkeys || []).find((p) => p.id === credId);
    if (hit) {
      user = u;
      pk = hit;
      break;
    }
  }
  if (!user || !pk) return { error: "unknown_passkey", status: 401 };
  let v;
  try {
    v = verifyAssertion({
      spkiB64: pk.publicKey,
      clientDataJSON: credential.clientDataJSON,
      authenticatorData: credential.authenticatorData,
      signature: credential.signature,
    });
  } catch {
    return { error: "bad_sig", status: 401 };
  }
  if (!v.ok) return { error: "bad_sig", status: 401 };
  if (v.client.challenge !== challenge) return { error: "challenge_mismatch", status: 400 };
  if (v.client.type !== "webauthn.get") return { error: "bad_client", status: 400 };
  return { ok: true, user };
}

export function allowCredentialsFor(user) {
  return (user.passkeys || []).map((p) => ({ type: "public-key", id: p.id }));
}
