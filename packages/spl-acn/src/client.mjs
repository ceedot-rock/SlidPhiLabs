/**
 * SPL:ACN MCP API client — one runtime for the hosted Agent Commerce Network.
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 *
 * Reads the server card, calls MCP tools, and speaks the lab's envelopes:
 * claim-token auth on paid seats, x402 402 answers surfaced as
 * payment_required instead of throws. Pure except through the injectable
 * fetchFn: no default network beyond the call itself, no disk.
 * Fail-closed throughout — bad input, tool errors, and transport faults
 * all refuse with a reason, never a half result.
 */

export const MCP_SDK_VERSION = "0.1.0";
export const MCP_ENDPOINT = "https://www.slidphilabs.com/api/mcp";

function text(v) {
  return v == null ? "" : String(v);
}

/**
 * Create a client. endpoint defaults to the hosted card; apiKey is the
 * spl1.* claim token for paid seats (omit it for free tools); fetchFn
 * defaults to the global fetch and is stubbed in tests.
 */
export function createMcpClient(opts = {}) {
  const endpoint =
    typeof opts.endpoint === "string" && opts.endpoint ? opts.endpoint : MCP_ENDPOINT;
  const apiKey = typeof opts.apiKey === "string" && opts.apiKey ? opts.apiKey : null;
  const fetchFn =
    typeof opts.fetchFn === "function"
      ? opts.fetchFn
      : typeof fetch === "function"
        ? fetch.bind(globalThis)
        : null;

  async function send({ method = "GET", body } = {}) {
    if (!fetchFn) return { ok: false, reason: "no_fetch" };
    let res;
    try {
      res = await fetchFn(endpoint, {
        method,
        headers: {
          ...(body === undefined ? {} : { "content-type": "application/json" }),
          ...(apiKey ? { authorization: "Bearer " + apiKey } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch {
      return { ok: false, reason: "network_failed" };
    }
    let data = null;
    try {
      data = await res.json();
    } catch {
      return { ok: false, reason: "bad_response", status: res.status };
    }
    return { ok: true, res, data };
  }

  return {
    endpoint,

    /** Read the server card (GET). */
    async card() {
      const out = await send();
      if (!out.ok) return out;
      if (!out.res.ok || !out.data || typeof out.data !== "object") {
        return { ok: false, reason: "card_failed", status: out.res.status };
      }
      return { ok: true, card: out.data };
    },

    /** Call one MCP tool by name. 402 answers come back as payment_required. */
    async callTool(name, args = {}) {
      const tool = text(name).trim();
      if (!tool) return { ok: false, reason: "bad_tool" };
      if (args !== undefined && (typeof args !== "object" || args === null || Array.isArray(args))) {
        return { ok: false, reason: "bad_args" };
      }
      const out = await send({
        method: "POST",
        body: { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: tool, arguments: args || {} } },
      });
      if (!out.ok) return out;
      if (out.res.status === 402) {
        return {
          ok: false,
          reason: "payment_required",
          ...(out.data && typeof out.data === "object" && out.data.accepts ? { accepts: out.data.accepts } : {}),
        };
      }
      if (!out.res.ok) return { ok: false, reason: "call_failed", status: out.res.status };
      const data = out.data;
      if (!data || typeof data !== "object") return { ok: false, reason: "bad_response" };
      if (data.error) {
        return {
          ok: false,
          reason: "tool_error",
          ...(typeof data.error.code === "number" ? { code: data.error.code } : {}),
          ...(typeof data.error.message === "string" ? { message: data.error.message } : {}),
        };
      }
      if (!("result" in data)) return { ok: false, reason: "bad_response" };
      return { ok: true, result: data.result };
    },
  };
}
