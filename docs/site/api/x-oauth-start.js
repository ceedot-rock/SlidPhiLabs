/**
 * GET /api/x-oauth-start
 * PKCE verifier embedded in signed `state` (no cookie — survives X redirect).
 */
import crypto from "crypto";

const AUTH = "https://x.com/i/oauth2/authorize";
const SCOPES = "tweet.read tweet.write users.read offline.access";

function b64url(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(String(input), "utf8");
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function sign(obj, secret) {
  const data = b64url(JSON.stringify(obj));
  const sig = crypto.createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${sig}`;
}

function redirectUri(req) {
  const host = (req.headers["x-forwarded-host"] || req.headers.host || "www.slidphilabs.com")
    .toString()
    .split(",")[0]
    .trim();
  const proto = (req.headers["x-forwarded-proto"] || "https").toString().split(",")[0];
  // Always prefer www for consistent portal registration
  const h = host.replace(/^slidphilabs\.com$/i, "www.slidphilabs.com");
  return `${proto}://${h}/api/x-oauth-callback`;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.statusCode = 405;
    return res.end("method_not_allowed");
  }

  const clientId = process.env.X_CLIENT_ID || process.env.X_OAUTH2_CLIENT_ID;
  const cookieSecret =
    process.env.X_OAUTH_COOKIE_SECRET ||
    process.env.X_CLIENT_SECRET ||
    "slid-phi-oauth-dev";

  if (!clientId) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    return res.end("X_CLIENT_ID missing on Vercel");
  }

  const verifier = b64url(crypto.randomBytes(32));
  const challenge = b64url(crypto.createHash("sha256").update(verifier).digest());
  const nonce = b64url(crypto.randomBytes(12));
  const exp = Date.now() + 15 * 60 * 1000;
  const state = sign({ v: verifier, n: nonce, exp }, cookieSecret);
  const redir = redirectUri(req);

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redir,
    scope: SCOPES,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });

  res.statusCode = 302;
  res.setHeader("Location", `${AUTH}?${params.toString()}`);
  // also drop cookie as backup (optional)
  res.setHeader(
    "Set-Cookie",
    `x_pkce=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=900; Domain=.slidphilabs.com`
  );
  return res.end();
}
