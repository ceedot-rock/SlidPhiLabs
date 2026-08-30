/**
 * POST { action: "signup"|"login", email, password, name? }
 * GET  Authorization: Bearer  → { user }
 */
import { cors, signup, login, meFromAuth, issueAgentKey, changePassword, loadUsers, saveUsers, signToken, publicUser } from "./lib/lab-auth.mjs";
import {
  beginChallenge,
  publicKeyCredentialCreationOptions,
  finishRegister,
  finishLogin,
  allowCredentialsFor,
} from "./lib/lab-passkeys.mjs";

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  cors(req, res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method === "GET") {
    const q = (req.query && req.query.token) || "";
    const user = meFromAuth(req.headers.authorization || (q ? "Bearer " + q : ""));
    if (!user) return json(res, 401, { ok: false, error: "need_login" });
    return json(res, 200, { ok: true, user });
  }
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "method" });
  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  body = body || {};
  const action = String(body.action || "login");
  try {
    if (action === "signup") {
      const out = signup(body);
      if (out.error) return json(res, out.status || 400, { ok: false, error: out.error });
      return json(res, 201, { ok: true, ...out });
    }
    if (action === "agent_key") {
      const out = issueAgentKey({ name: body.name });
      return json(res, 201, { ok: true, ...out });
    }
    if (action === "passkey_register_begin") {
      const user = meFromAuth(req.headers.authorization || "");
      if (!user) return json(res, 401, { ok: false, error: "need_login" });
      const db = loadUsers();
      const full = db.users.find((u) => u.id === user.id);
      if (!full) return json(res, 401, { ok: false, error: "need_login" });
      return json(res, 200, {
        ok: true,
        publicKey: publicKeyCredentialCreationOptions({
          user: full,
          email: full.email,
          name: full.name,
        }),
      });
    }
    if (action === "passkey_register_finish") {
      const user = meFromAuth(req.headers.authorization || "");
      if (!user) return json(res, 401, { ok: false, error: "need_login" });
      const db = loadUsers();
      const full = db.users.find((u) => u.id === user.id);
      if (!full) return json(res, 401, { ok: false, error: "need_login" });
      const out = finishRegister({
        user: full,
        credential: body.credential || {},
        challenge: body.challenge,
      });
      if (out.error) return json(res, out.status || 400, { ok: false, error: out.error });
      saveUsers(db);
      return json(res, 200, { ok: true, user: publicUser(full) });
    }
    if (action === "passkey_login_begin") {
      const email = String(body.email || "").trim().toLowerCase();
      const ch = beginChallenge({ email, purpose: "login" });
      const db = loadUsers();
      const full = email ? db.users.find((u) => u.email === email) : null;
      return json(res, 200, {
        ok: true,
        publicKey: {
          ...ch,
          allowCredentials: full ? allowCredentialsFor(full) : [],
        },
      });
    }
    if (action === "passkey_login_finish") {
      const db = loadUsers();
      const out = finishLogin({
        users: db.users,
        credential: body.credential || {},
        challenge: body.challenge,
      });
      if (out.error) return json(res, out.status || 401, { ok: false, error: out.error });
      return json(res, 200, { ok: true, user: publicUser(out.user), token: signToken(out.user) });
    }
    if (action === "change_password") {
      const auth = String(req.headers.authorization || "");
      const out = changePassword({
        email: body.email,
        old_password: body.old_password,
        new_password: body.new_password,
        token: auth,
      });
      if (out.error) return json(res, out.status || 400, { ok: false, error: out.error });
      return json(res, 200, { ok: true, ...out });
    }
    const out = login(body);
    if (out.error) return json(res, out.status || 401, { ok: false, error: out.error });
    return json(res, 200, { ok: true, ...out });
  } catch (e) {
    return json(res, 500, { ok: false, error: "auth_failed" });
  }
}
