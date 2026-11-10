/** Paid-route CORS allowlist. Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 *
 * Browsers only: a request with no Origin header (curl, server-to-server
 * agents) is unaffected. A foreign Origin gets no ACAO header, so the
 * browser blocks the read. Localhost is allowed outside production for
 * local development.
 */
const PROD_ORIGINS = new Set([
  "https://www.slidphilabs.com",
  "https://slidphilabs.com",
]);

export function isAllowedOrigin(origin, env = process.env) {
  if (typeof origin !== "string" || origin === "") return false;
  if (PROD_ORIGINS.has(origin)) return true;
  if (env && env.NODE_ENV === "production") return false;
  try {
    const u = new URL(origin);
    return (u.hostname === "localhost" || u.hostname === "127.0.0.1");
  } catch {
    return false;
  }
}

/** Echo the origin only when allowlisted. Keeps each route's methods. */
export function paidCors(req, res, methods, allowHeaders = "Content-Type",
  extraHeaders = {}, exposeHeaders = "") {
  const origin = req && req.headers
    ? (req.headers.origin || req.headers.Origin || "")
    : "";
  if (isAllowedOrigin(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", methods);
  res.setHeader("Access-Control-Allow-Headers", allowHeaders);
  if (exposeHeaders) res.setHeader("Access-Control-Expose-Headers", exposeHeaders);
  for (const [k, v] of Object.entries(extraHeaders)) res.setHeader(k, v);
  return undefined;
}
