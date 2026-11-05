import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  signup,
  login,
  issueAgentKey,
  changePassword,
  meFromAuth,
  signToken,
  readToken,
  publicUser,
} from "./lab-auth.mjs";

// Deterministic offline: isolated file store + fixed HMAC secret.
const AUTH_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "spl-lab-auth-"));
process.env.AUTH_DIR = AUTH_DIR;
process.env.AUTH_SECRET = "test-auth-secret-0123456789abcdef";

test("happy: signup -> login -> meFromAuth roundtrip", () => {
  const s = signup({ email: "Ada@Example.com", password: "correct-horse-01", name: "Ada" });
  assert.ok(s.user);
  assert.equal(s.user.email, "ada@example.com");
  assert.equal(s.user.name, "Ada");
  assert.ok(s.token);
  assert.equal(s.user.salt, undefined);
  assert.equal(s.user.hash, undefined);
  const l = login({ email: "ada@example.com", password: "correct-horse-01" });
  assert.ok(l.user);
  assert.ok(l.token);
  const me = meFromAuth(`Bearer ${l.token}`);
  assert.equal(me.email, "ada@example.com");
});

test("happy: scrypt password check is timing-safe (wrong pw, same length or not)", () => {
  const bad1 = login({ email: "ada@example.com", password: "wrong-password-zz" });
  assert.equal(bad1.error, "bad_login");
  assert.equal(bad1.status, 401);
  const bad2 = login({ email: "ada@example.com", password: "x" });
  assert.equal(bad2.error, "bad_login");
  assert.equal(bad2.status, 401);
  const bad3 = login({ email: "nobody@example.com", password: "correct-horse-01" });
  assert.equal(bad3.error, "bad_login");
});

test("error: signup validation envelope", () => {
  assert.deepEqual(signup({ email: "not-an-email", password: "long-enough-01" }), {
    error: "bad_email",
    status: 400,
  });
  assert.deepEqual(signup({ email: "new@example.com", password: "short" }), {
    error: "password_min_8",
    status: 400,
  });
  assert.deepEqual(signup({ email: "ADA@example.com", password: "another-long-01" }), {
    error: "email_taken",
    status: 409,
  });
});

test("error: HMAC token paths — tampered sig and garbage fail closed", () => {
  const l = login({ email: "ada@example.com", password: "correct-horse-01" });
  const parts = l.token.split(".");
  assert.equal(parts.length, 3);
  const badSig = `${parts[0]}.${parts[1]}.${parts[2].slice(0, -1)}${parts[2].endsWith("A") ? "B" : "A"}`;
  assert.equal(readToken(badSig), null);
  assert.equal(readToken("garbage"), null);
  assert.equal(readToken("a.b"), null);
  assert.equal(readToken(""), null);
  assert.equal(meFromAuth(`Bearer ${badSig}`), null);
  assert.equal(meFromAuth(""), null);
});

test("happy: changePassword via old password, then via token", () => {
  const c1 = changePassword({
    email: "ada@example.com",
    old_password: "correct-horse-01",
    new_password: "new-password-02",
  });
  assert.ok(c1.user);
  assert.equal(login({ email: "ada@example.com", password: "correct-horse-01" }).error, "bad_login");
  assert.ok(login({ email: "ada@example.com", password: "new-password-02" }).user);
  const c2 = changePassword({ token: c1.token, new_password: "third-password-03" });
  assert.ok(c2.user);
  assert.ok(login({ email: "ada@example.com", password: "third-password-03" }).user);
});

test("error: changePassword rejects short pw and bad credentials", () => {
  assert.deepEqual(changePassword({ email: "ada@example.com", old_password: "nope", new_password: "x" }), {
    error: "password_min_8",
    status: 400,
  });
  assert.deepEqual(
    changePassword({ email: "ada@example.com", old_password: "wrong-old-pw", new_password: "long-enough-99" }),
    { error: "bad_login", status: 401 }
  );
});

test("happy: issueAgentKey mints a usable key identity", () => {
  const k = issueAgentKey({ name: "ci-agent" });
  assert.ok(k.api_key.startsWith("spl_ag_"));
  assert.ok(k.user.email.endsWith("@agents.slidphilabs.com"));
  assert.match(k.note, /Authorization: Bearer/);
  // The key works as the account password at login.
  const l = login({ email: k.user.email, password: k.api_key });
  assert.ok(l.user);
});

test("publicUser exposes doors, never secrets", () => {
  const l = login({ email: "ada@example.com", password: "third-password-03" });
  const pub = publicUser({ ...l.user, salt: "s", hash: "h", passkeys: [{ id: "p1" }] });
  assert.equal(pub.salt, undefined);
  assert.equal(pub.hash, undefined);
  assert.equal(pub.has_passkey, true);
  assert.ok(pub.doors.studio);
  assert.ok(signToken({ id: "x", email: "a@b.c", name: "n" }).split(".").length === 3);
});
