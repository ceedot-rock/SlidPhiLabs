/**
 * GET /api/x-oauth-callback
 * Exchange code using signed state (no cookie required) → post amp thread.
 */
import crypto from "crypto";

const TOKEN_URL = "https://api.twitter.com/2/oauth2/token";
const ME_URL = "https://api.twitter.com/2/users/me";
const TWEETS_URL = "https://api.twitter.com/2/tweets";

const THREAD = [
  `Site now breathes.

Compression that knows it is alive.

ZRW zeros×10k → 8 B
gzip-9: 73 B · brotli-11: 13 B
ramp ~141× vs brotli

Live proof bar · standings · metrics
https://www.slidphilabs.com`,

  `What just went live:

• Hero leads with the 8 B claim
• Proof bar: ratio · cycles · self-tunes · last path
• Standings first-paint (no Loading…)
• GET /api/phi/metrics → alive:true
• Headers: X-Slid-Engine: alive

Pulse: https://www.slidphilabs.com/api/phi/metrics
Standings: https://www.slidphilabs.com/standings`,

  `One product. Two doors.

Humans → free web · standings · suite
https://www.slidphilabs.com/humans

Agents → GET /api/agent · x402 · OmniWave
https://www.slidphilabs.com/agents

Same lab. Same 8 B proof. Different rails.`,

  `IP Guard: outcomes only.

Free first 100 GB suite, then ~5¢/GB under ~9¢ egress.
Try free web: https://www.slidphilabs.com/web
Why 8 B: https://www.slidphilabs.com/blog/2026-08-07-why-8b-matters

Exact codecs. Agentic infrastructure.
Compression that knows it is alive.
@slidphilabs`,
];

function b64url(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(String(input), "utf8");
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function unsign(token, secret) {
  const raw = String(token || "");
  const i = raw.lastIndexOf(".");
  if (i < 1) return null;
  const data = raw.slice(0, i);
  const sig = raw.slice(i + 1);
  const expect = crypto.createHmac("sha256", secret).update(data).digest("base64url");
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expect);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    let b64 = data.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    return JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

function html(title, body, ok) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${title}</title>
<style>
body{font-family:system-ui,sans-serif;background:#050b16;color:#eef4fb;padding:40px 20px;max-width:42rem;margin:0 auto;line-height:1.5}
h1{color:${ok ? "#3ecf8e" : "#ff8a7a"};font-size:1.35rem}
a{color:#5ef0df}pre{font-family:ui-monospace,monospace;font-size:.78rem;color:#5ef0df;word-break:break-all;white-space:pre-wrap}
.box{background:#0c1524;border:1px solid rgba(61,214,198,.25);border-radius:12px;padding:14px;margin:12px 0}
.muted{color:#8fa3b8}
</style></head><body>
<h1>${title}</h1>
${body}
<p class="muted"><a href="/api/x-oauth-start">Try again</a> · <a href="/">Home</a> · <a href="https://x.com/slidphilabs">@slidphilabs</a></p>
</body></html>`;
}

function redirectUri(req) {
  const host = (req.headers["x-forwarded-host"] || req.headers.host || "www.slidphilabs.com")
    .toString()
    .split(",")[0]
    .trim()
    .replace(/^slidphilabs\.com$/i, "www.slidphilabs.com");
  const proto = (req.headers["x-forwarded-proto"] || "https").toString().split(",")[0];
  return `${proto}://${host}/api/x-oauth-callback`;
}

function q(req, key) {
  if (req.query && req.query[key] != null) {
    const v = req.query[key];
    return Array.isArray(v) ? v[0] : String(v);
  }
  try {
    const u = new URL(req.url || "", "https://www.slidphilabs.com");
    return u.searchParams.get(key);
  } catch {
    return null;
  }
}

async function exchange({ code, verifier, clientId, clientSecret, redir }) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redir,
    code_verifier: verifier,
    client_id: clientId,
  });
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const r = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${auth}`,
    },
    body,
  });
  const text = await r.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  if (!r.ok) {
    const err = new Error(
      data.error_description || data.error || text.slice(0, 400)
    );
    err.data = data;
    err.status = r.status;
    throw err;
  }
  return data;
}

async function getMe(access) {
  const r = await fetch(ME_URL, {
    headers: { Authorization: `Bearer ${access}` },
  });
  const data = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(data));
  return data.data || {};
}

async function postTweet(access, text, replyTo) {
  const payload = { text };
  if (replyTo) payload.reply = { in_reply_to_tweet_id: replyTo };
  const r = await fetch(TWEETS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${access}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = await r.json();
  if (!r.ok) {
    const err = new Error(JSON.stringify(data));
    err.data = data;
    err.status = r.status;
    throw err;
  }
  return data.data;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") {
    res.statusCode = 405;
    return res.end("method_not_allowed");
  }

  const clientId = process.env.X_CLIENT_ID || process.env.X_OAUTH2_CLIENT_ID;
  const clientSecret =
    process.env.X_CLIENT_SECRET || process.env.X_OAUTH2_CLIENT_SECRET;
  const cookieSecret =
    process.env.X_OAUTH_COOKIE_SECRET || clientSecret || "slid-phi-oauth-dev";
  const autoPost = String(process.env.X_AUTO_POST || "1") !== "0";
  const redir = redirectUri(req);

  const code = q(req, "code");
  const state = q(req, "state");
  const oauthErr = q(req, "error");
  const oauthDesc = q(req, "error_description");

  const page = (status, title, body, ok) => {
    res.statusCode = status;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.end(html(title, body, ok));
  };

  if (oauthErr) {
    return page(
      400,
      "X denied access",
      `<div class="box"><p><strong>${oauthErr}</strong></p><p class="muted">${oauthDesc || ""}</p></div>
       <p>Portal must allow Read and write + callback:</p>
       <pre class="box">${redir}</pre>`,
      false
    );
  }

  if (!code || !state) {
    return page(
      400,
      "Missing code",
      `<p>Start here (do not open this callback URL by itself):</p>
       <p><a href="/api/x-oauth-start"><strong>/api/x-oauth-start</strong></a></p>`,
      false
    );
  }

  if (!clientId || !clientSecret) {
    return page(
      500,
      "Server misconfigured",
      `<p>X_CLIENT_ID / X_CLIENT_SECRET missing on Vercel.</p>`,
      false
    );
  }

  const pkce = unsign(state, cookieSecret);
  if (!pkce || !pkce.v) {
    return page(
      400,
      "Bad state",
      `<p>Signed state failed. Usually: old link, or cookie secret rotated mid-login.</p>
       <p><a href="/api/x-oauth-start">Start fresh once</a></p>`,
      false
    );
  }
  if (Date.now() > (pkce.exp || 0)) {
    return page(
      400,
      "Login timed out",
      `<p>Authorize within 15 minutes of starting.</p>
       <p><a href="/api/x-oauth-start">Start again</a></p>`,
      false
    );
  }

  let tokens;
  try {
    tokens = await exchange({
      code,
      verifier: pkce.v,
      clientId,
      clientSecret,
      redir,
    });
  } catch (e) {
    return page(
      400,
      "Token exchange failed",
      `<pre class="box">${String(e.message || e).slice(0, 900)}</pre>
       <p class="muted">Common: callback URI in portal must be <strong>exactly</strong>:</p>
       <pre class="box">${redir}</pre>
       <p><a href="/api/x-oauth-start">Try again</a> (codes are one-shot).</p>`,
      false
    );
  }

  let user = { username: "?" };
  try {
    user = await getMe(tokens.access_token);
  } catch (e) {
    user = { username: "?", error: String(e.message || e) };
  }

  const ids = [];
  let postError = null;
  if (autoPost) {
    try {
      let replyTo = null;
      for (const text of THREAD) {
        const t = await postTweet(tokens.access_token, text, replyTo);
        ids.push(t.id);
        replyTo = t.id;
      }
    } catch (e) {
      postError = String(e.message || e).slice(0, 1200);
    }
  }

  const links = ids
    .map(
      (id, i) =>
        `<li><a target="_blank" rel="noopener" href="https://x.com/${user.username || "i"}/status/${id}">Post ${i + 1} →</a></li>`
    )
    .join("");

  const pack = b64url(
    JSON.stringify({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_in: tokens.expires_in,
      scope: tokens.scope,
      username: user.username,
      at: new Date().toISOString(),
    })
  );

  if (ids.length === THREAD.length) {
    return page(
      200,
      `Posted as @${user.username}`,
      `<div class="box"><p>Amp thread is live (${ids.length} posts).</p><ul>${links}</ul></div>
       <p class="muted">Optional host pack:</p><pre class="box" style="max-height:6rem;overflow:auto">${pack}</pre>`,
      true
    );
  }

  return page(
    200,
    `Connected @${user.username} — post failed`,
    `<p>Auth worked. Auto-post did not finish.</p>
     ${postError ? `<pre class="box">${postError}</pre>` : ""}
     <p class="muted">Often: Free tier / pay-per-use not enabled for create tweet, or missing tweet.write.</p>
     <p class="muted">Token pack (paste to engineer):</p>
     <pre class="box" style="max-height:8rem;overflow:auto">${pack}</pre>`,
    false
  );
}
