import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  beginChallenge,
  publicKeyCredentialCreationOptions,
  finishRegister,
  finishLogin,
  allowCredentialsFor,
} from "./lab-passkeys.mjs";

// Deterministic offline: isolated challenge store. Register path verifies
// clientData (origin/type/challenge) without network; signature verification
// on the login path is exercised through its fail-closed error branches.
const AUTH_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "spl-lab-passkeys-"));
process.env.AUTH_DIR = AUTH_DIR;

const ORIGIN = "https://www.slidphilabs.com";
const clientData = (type, challenge) =>
  Buffer.from(JSON.stringify({ type, challenge, origin: ORIGIN })).toString("base64url");

// TODO: verifyAssertion parses authenticatorData but never checks rpIdHash
// (sha256("www.slidphilabs.com")), the flags UP/UV bits, or signCount — and a
// registered credential stores only { id, publicKey, created }, so counter
// continuity cannot be verified from the stored credential today. If those
// checks are added, cover: wrong rpIdHash -> reject, UP flag clear -> reject,
// stored counter + decreasing counter -> reject.

test("happy: beginChallenge shape", () => {
  const c = beginChallenge({ email: "Ada@Example.com", purpose: "register" });
  assert.equal(c.rpId, "www.slidphilabs.com");
  assert.equal(c.rpName, "Slid Phi Labs");
  assert.ok(c.challenge.length >= 32);
  assert.equal(c.timeout, 120000);
  assert.equal(c.userVerification, "preferred");
});

test("happy: creation options carry challenge + user + params", () => {
  const o = publicKeyCredentialCreationOptions({
    user: { id: "u-1" },
    email: "ada@example.com",
    name: "Ada",
  });
  assert.ok(o.challenge);
  assert.equal(o.user.name, "ada@example.com");
  assert.deepEqual(o.pubKeyCredParams, [
    { type: "public-key", alg: -7 },
    { type: "public-key", alg: -257 },
  ]);
  assert.equal(o.attestation, "none");
});

test("happy: finishRegister stores the passkey on the user", () => {
  const { challenge } = beginChallenge({ email: "ada@example.com", purpose: "register" });
  const user = { id: "u-1", email: "ada@example.com" };
  const r = finishRegister({
    user,
    challenge,
    credential: { id: "cred-1", publicKey: Buffer.from("fake-spki").toString("base64url"), clientDataJSON: clientData("webauthn.create", challenge) },
  });
  assert.deepEqual(r, { ok: true });
  assert.equal(user.passkeys.length, 1);
  assert.equal(user.passkeys[0].id, "cred-1");
  assert.ok(user.passkeys[0].created);
  assert.deepEqual(allowCredentialsFor(user), [{ type: "public-key", id: "cred-1" }]);
});

test("error: finishRegister fail-closed envelopes", () => {
  const user = { id: "u-9" };
  assert.deepEqual(
    finishRegister({ user, challenge: "no-such-challenge", credential: { id: "x", publicKey: "y", clientDataJSON: clientData("webauthn.create", "no-such-challenge") } }),
    { error: "bad_challenge", status: 400 }
  );
  // Challenge mismatch between row and clientData.
  const a = beginChallenge({ email: "a@b.c", purpose: "register" });
  assert.deepEqual(
    finishRegister({
      user,
      challenge: a.challenge,
      credential: { id: "x", publicKey: "eQ", clientDataJSON: clientData("webauthn.create", "other-challenge") },
    }),
    { error: "challenge_mismatch", status: 400 }
  );
  // Wrong ceremony type.
  const b = beginChallenge({ email: "a@b.c", purpose: "register" });
  assert.deepEqual(
    finishRegister({
      user,
      challenge: b.challenge,
      credential: { id: "x", publicKey: "eQ", clientDataJSON: clientData("webauthn.get", b.challenge) },
    }),
    { error: "bad_client", status: 400 }
  );
  // Missing public key material.
  const c = beginChallenge({ email: "a@b.c", purpose: "register" });
  assert.deepEqual(
    finishRegister({
      user,
      challenge: c.challenge,
      credential: { id: "x", clientDataJSON: clientData("webauthn.create", c.challenge) },
    }),
    { error: "need_publicKey", status: 400 }
  );
  // Bad origin in clientData.
  const d = beginChallenge({ email: "a@b.c", purpose: "register" });
  const evil = Buffer.from(
    JSON.stringify({ type: "webauthn.create", challenge: d.challenge, origin: "https://evil.example" })
  ).toString("base64url");
  assert.deepEqual(
    finishRegister({ user, challenge: d.challenge, credential: { id: "x", publicKey: "eQ", clientDataJSON: evil } }),
    { error: "bad_client", status: 400 }
  );
  // Challenges are single-use.
  const e = beginChallenge({ email: "a@b.c", purpose: "register" });
  const cred = { id: "x", publicKey: "eQ", clientDataJSON: clientData("webauthn.create", e.challenge) };
  assert.deepEqual(finishRegister({ user: { id: "u-1" }, challenge: e.challenge, credential: cred }), { ok: true });
  assert.deepEqual(finishRegister({ user: { id: "u-1" }, challenge: e.challenge, credential: cred }), {
    error: "bad_challenge",
    status: 400,
  });
});

test("error: finishLogin fail-closed without a valid ceremony", () => {
  assert.deepEqual(
    finishLogin({ users: [], challenge: "nope", credential: { id: "cred-1" } }),
    { error: "bad_challenge", status: 400 }
  );
  const { challenge } = beginChallenge({ email: "ada@example.com", purpose: "login" });
  assert.deepEqual(
    finishLogin({ users: [{ id: "u-1", passkeys: [{ id: "cred-1", publicKey: "eQ" }] }], challenge, credential: { id: "unknown-cred" } }),
    { error: "unknown_passkey", status: 401 }
  );
});

test("error: finishLogin rejects garbage signature material as bad_sig", () => {
  const { challenge } = beginChallenge({ email: "ada@example.com", purpose: "login" });
  const users = [{ id: "u-1", passkeys: [{ id: "cred-1", publicKey: Buffer.from("not-a-key").toString("base64url") }] }];
  const r = finishLogin({
    users,
    challenge,
    credential: {
      id: "cred-1",
      clientDataJSON: clientData("webauthn.get", challenge),
      authenticatorData: Buffer.from("not-auth-data").toString("base64url"),
      signature: Buffer.from("not-a-sig").toString("base64url"),
    },
  });
  assert.equal(r.status, 401);
  assert.ok(r.error === "bad_sig");
});
