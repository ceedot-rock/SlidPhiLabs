/** Generic 500s with request ids. Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 *
 * Responses carry { error: <generic>, request_id }; the exception text goes
 * to server logs only, never to the client.
 */
import { randomUUID } from "node:crypto";

export function requestId(req) {
  const h = req && req.headers
    ? (req.headers["x-request-id"] || req.headers["X-Request-Id"])
    : "";
  if (typeof h === "string" && h !== "" && h.length <= 128) return h;
  return randomUUID();
}

/** Log the real error server-side; returns the id to embed in the response. */
export function logInternal(req, route, err) {
  const id = requestId(req);
  try {
    console.error(JSON.stringify({
      level: "error",
      route,
      request_id: id,
      error: String((err && err.stack) || err).slice(0, 2000),
    }));
  } catch {
    /* logging never fails the request */
  }
  return id;
}
