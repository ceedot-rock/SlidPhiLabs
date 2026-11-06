/**
 * Depot store — live gitdepot-hub blob client for ACN runs.
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 *
 * Publish run artifacts and fetch them back by content hash through the
 * team's depot hub. Pure except through the injectable fetchFn: no endpoint
 * or key means { ok:false, reason:"adapter_required" } with zero network.
 * Fail-closed: bad input, network faults, and server errors all refuse with
 * a reason — never a half-published entry. Keys travel in the Authorization
 * header only and are never echoed back in results.
 */
import { createHash } from "node:crypto";

export const DEPOT_STORE_VERSION = "0.1.0";
export const DEPOT_STORE_OPS = ["publish", "retrieve", "list"];
export const DEPOT_STORE_MAX_BYTES = 1_073_741_824;

function text(v) {
  return v == null ? "" : String(v);
}

function validSha(v) {
  return /^[0-9a-f]{64}$/.test(text(v));
}

function validName(v) {
  const s = text(v).trim();
  return s.length >= 1 && s.length <= 128 ? s : null;
}

function sha256hex(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

function toBytes(input) {
  if (Buffer.isBuffer(input)) return input;
  if (input instanceof Uint8Array) return Buffer.from(input);
  if (typeof input === "string") return Buffer.from(input, "utf8");
  return null;
}

/**
 * Create a depot client. endpoint is the hub origin (e.g.
 * https://host), key is the member bearer key. fetchFn defaults to the
 * global fetch when one exists; tests inject a stub.
 */
export function createDepotStore(opts = {}) {
  const endpoint =
    typeof opts.endpoint === "string" ? opts.endpoint.replace(/\/+$/, "") : "";
  const key = typeof opts.key === "string" ? opts.key : "";
  const fetchFn =
    typeof opts.fetchFn === "function"
      ? opts.fetchFn
      : typeof fetch === "function"
        ? fetch.bind(globalThis)
        : null;

  async function call(path, { method = "GET", body } = {}) {
    if (!endpoint || !key || !fetchFn) {
      return { ok: false, reason: "adapter_required" };
    }
    let res;
    try {
      res = await fetchFn(endpoint + path, {
        method,
        headers: {
          authorization: "Bearer " + key,
          ...(body === undefined ? {} : { "content-type": "application/json" }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch {
      return { ok: false, reason: "network_failed" };
    }
    return { ok: true, res };
  }

  async function readError(res) {
    try {
      const data = await res.json();
      if (data && typeof data.error === "string" && data.error) {
        return data.error;
      }
    } catch {
      // fall through to status reason
    }
    return "request_failed";
  }

  return {
    endpoint,
    ops: DEPOT_STORE_OPS.slice(),

    /** Publish bytes under a name. Accepts { name, bytes|blob_b64, sha256?, size?, provenance? }. */
    async publish(input = {}) {
      const name = validName(input.name);
      if (!name) return { ok: false, reason: "bad-name" };
      let bytes = null;
      if (input.bytes !== undefined) {
        bytes = toBytes(input.bytes);
        if (!bytes) return { ok: false, reason: "bad-bytes" };
      } else if (typeof input.blob_b64 === "string") {
        try {
          bytes = Buffer.from(input.blob_b64, "base64");
        } catch {
          return { ok: false, reason: "bad-bytes" };
        }
      } else {
        return { ok: false, reason: "bad-bytes" };
      }
      if (bytes.byteLength > DEPOT_STORE_MAX_BYTES) {
        return { ok: false, reason: "too-large" };
      }
      const digest = sha256hex(bytes);
      if (input.sha256 !== undefined && text(input.sha256).toLowerCase() !== digest) {
        return { ok: false, reason: "sha-mismatch" };
      }
      if (input.size !== undefined && Number(input.size) !== bytes.byteLength) {
        return { ok: false, reason: "size-mismatch" };
      }
      const out = await call("/api/depot/publish", {
        method: "POST",
        body: {
          name,
          sha256: digest,
          size: bytes.byteLength,
          ...(input.provenance !== undefined ? { provenance: input.provenance } : {}),
          blob_b64: bytes.toString("base64"),
        },
      });
      if (!out.ok) return out;
      let data;
      try {
        data = await out.res.json();
      } catch {
        return { ok: false, reason: "bad-response" };
      }
      if (!out.res.ok || !data || data.published !== name) {
        return { ok: false, reason: (data && data.error) || "publish-failed" };
      }
      return {
        ok: true,
        name: data.published,
        sha256: typeof data.sha256 === "string" ? data.sha256 : digest,
        size: Number(data.size) || bytes.byteLength,
        ...(typeof data.team === "string" ? { team: data.team } : {}),
      };
    },

    /** Fetch a blob by content hash. Returns { ok:true, sha256, size, bytes }. */
    async retrieve(sha256) {
      if (!validSha(sha256)) return { ok: false, reason: "bad-sha" };
      const out = await call("/api/blob/" + text(sha256).toLowerCase());
      if (!out.ok) return out;
      if (!out.res.ok) return { ok: false, reason: await readError(out.res) };
      let buf;
      try {
        buf = Buffer.from(await out.res.arrayBuffer());
      } catch {
        return { ok: false, reason: "bad-response" };
      }
      return { ok: true, sha256: text(sha256).toLowerCase(), size: buf.byteLength, bytes: buf };
    },

    /** List the team's depot entries. */
    async list() {
      const out = await call("/api/depot/list");
      if (!out.ok) return out;
      let data;
      try {
        data = await out.res.json();
      } catch {
        return { ok: false, reason: "bad-response" };
      }
      if (!out.res.ok || !data || !Array.isArray(data.depots)) {
        return { ok: false, reason: (data && data.error) || "list-failed" };
      }
      return {
        ok: true,
        ...(typeof data.team === "string" ? { team: data.team } : {}),
        depots: data.depots,
      };
    },
  };
}
