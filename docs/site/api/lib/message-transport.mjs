/**
 * Message transport 0.1.0 — outbox/inbox file queues with at-least-once delivery.
 * Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 *
 * Deterministic, offline: messages are JSON files under <dir>/outbox and
 * <dir>/inbox. deliver() moves each outbox file to the recipient inbox
 * resolved through an injectable routing table ({ sender -> recipient },
 * default identity). Delivery is at-least-once: a copy stays in the
 * outbox under .acked bookkeeping until ack(ack_id) confirms receipt.
 * The fs surface ({ readdir, readFile, writeFile, rename, unlink }) and
 * the id/now fns are injectable; the default store is in-memory so unit
 * tests need no disk. All methods return envelopes and fail closed.
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync, renameSync, unlinkSync, mkdirSync } from "node:fs";
import { join } from "node:path";

export const MESSAGE_TRANSPORT_VERSION = "0.1.0";

/**
 * File-backed fs adapter option for createMessageTransport({ fs }).
 * Maps the transport's fs surface onto node:fs under root so outbox/inbox
 * queues survive restarts. Missing directories read as empty (ENOENT ->
 * []), matching the in-memory default's behavior. Deterministic offline:
 * no network, sync calls only.
 */
export function createNodeFs(root) {
  const base = String(root || "queue-data");
  const full = (p) => join(base, String(p).split("/").filter((s) => s && s !== "." && s !== "..").join("/"));
  const ensureDir = (dir) => mkdirSync(full(dir), { recursive: true });
  return {
    readdir: (dir) => {
      try {
        return readdirSync(full(dir)).sort();
      } catch (err) {
        if (err && (err.code === "ENOENT" || /no such file/i.test(String(err && err.message)))) return [];
        throw err;
      }
    },
    readFile: (p) => readFileSync(full(p), "utf8"),
    writeFile: (p, s) => {
      const rel = String(p);
      ensureDir(rel.split("/").slice(0, -1).join("/"));
      writeFileSync(full(rel), String(s), "utf8");
    },
    rename: (a, b) => {
      ensureDir(String(b).split("/").slice(0, -1).join("/"));
      renameSync(full(a), full(b));
    },
    unlink: (p) => unlinkSync(full(p)),
  };
}

function text(v) {
  return v == null ? "" : String(v).trim();
}

function createMemoryFs() {
  const files = new Map(); // path -> string
  return {
    readdir: (dir) => {
      const prefix = `${dir}/`;
      const names = [];
      for (const p of files.keys()) {
        if (p.startsWith(prefix) && !p.slice(prefix.length).includes("/")) {
          names.push(p.slice(prefix.length));
        }
      }
      return names.sort();
    },
    readFile: (p) => {
      if (!files.has(p)) {
        const err = new Error(`ENOENT: ${p}`);
        err.code = "ENOENT";
        throw err;
      }
      return files.get(p);
    },
    writeFile: (p, s) => {
      files.set(p, String(s));
    },
    rename: (a, b) => {
      if (!files.has(a)) {
        const err = new Error(`ENOENT: ${a}`);
        err.code = "ENOENT";
        throw err;
      }
      files.set(b, files.get(a));
      files.delete(a);
    },
    unlink: (p) => {
      files.delete(p);
    },
  };
}

function cleanMessage(msg) {
  if (!msg || typeof msg !== "object") return null;
  const from = text(msg.from);
  const to = text(msg.to);
  const body = msg.body;
  if (!from || body === undefined) return null;
  return { from, to: to || null, body };
}

/**
 * Create a transport. opts: { dir, fs, routes, idFn, nowFn }.
 * routes maps sender -> recipient inbox name; missing senders deliver
 * to their own inbox (identity default).
 */
export function createMessageTransport(opts = {}) {
  const dir = text(opts.dir) || "queue";
  const fs = opts.fs ?? createMemoryFs();
  const routes = opts.routes && typeof opts.routes === "object" ? opts.routes : {};
  let counter = 0;
  const idFn =
    typeof opts.idFn === "function"
      ? opts.idFn
      : (seed) => createHash("sha256").update(String(seed)).digest("hex").slice(0, 16);
  const nowFn = typeof opts.nowFn === "function" ? opts.nowFn : () => Date.now();

  const outbox = `${dir}/outbox`;
  const inboxOf = (recipient) => `${dir}/inbox/${recipient}`;

  function recipientFor(from, declaredTo) {
    const mapped = text(routes[from]);
    if (mapped) return mapped;
    if (declaredTo) return declaredTo;
    return from;
  }

  return {
    dir,
    enqueue(msg) {
      const clean = cleanMessage(msg);
      if (!clean) return { ok: false, reason: "bad_message" };
      counter += 1;
      const ackId = idFn(`${clean.from}:${nowFn()}:${counter}`);
      if (!text(ackId)) return { ok: false, reason: "bad_ack_id" };
      const record = { ack_id: ackId, queued_at: nowFn(), acked: false, ...clean };
      try {
        fs.writeFile(`${outbox}/${ackId}.json`, JSON.stringify(record));
      } catch {
        return { ok: false, reason: "write_error" };
      }
      return { ok: true, ack_id: ackId };
    },
    /** Move every unacked outbox file to its recipient inbox. Keeps the outbox copy until ack(). */
    deliver() {
      let names;
      try {
        names = fs.readdir(outbox);
      } catch {
        return { ok: false, reason: "read_error" };
      }
      const delivered = [];
      for (const name of names) {
        if (!name.endsWith(".json")) continue;
        let record;
        try {
          record = JSON.parse(fs.readFile(`${outbox}/${name}`));
        } catch {
          return { ok: false, reason: "corrupt_entry", file: name };
        }
        if (!record || record.acked) continue;
        const recipient = recipientFor(record.from, record.to);
        if (!recipient) return { ok: false, reason: "unknown_recipient", file: name };
        try {
          fs.writeFile(`${inboxOf(recipient)}/${record.ack_id}.json`, JSON.stringify(record));
        } catch {
          return { ok: false, reason: "write_error", file: name };
        }
        delivered.push({ ack_id: record.ack_id, recipient });
      }
      return { ok: true, delivered };
    },
    /** List inbox files for a recipient. */
    inbox(recipient) {
      const r = text(recipient);
      if (!r) return { ok: false, reason: "bad_recipient" };
      let names;
      try {
        names = fs.readdir(inboxOf(r));
      } catch {
        return { ok: true, messages: [] };
      }
      const messages = [];
      for (const name of names) {
        if (!name.endsWith(".json")) continue;
        try {
          messages.push(JSON.parse(fs.readFile(`${inboxOf(r)}/${name}`)));
        } catch {
          return { ok: false, reason: "corrupt_entry", file: name };
        }
      }
      return { ok: true, messages };
    },
    /** Confirm receipt: drops the outbox copy so redelivery stops. */
    ack(ackId) {
      const id = text(ackId);
      if (!id) return { ok: false, reason: "bad_ack_id" };
      try {
        const raw = fs.readFile(`${outbox}/${id}.json`);
        const record = JSON.parse(raw);
        fs.unlink(`${outbox}/${id}.json`);
        return { ok: true, ack_id: id, recipient: recipientFor(record.from, record.to) };
      } catch {
        return { ok: false, reason: "unknown_ack_id" };
      }
    },
    pending() {
      let names;
      try {
        names = fs.readdir(outbox);
      } catch {
        return { ok: true, pending: [] };
      }
      return { ok: true, pending: names.filter((n) => n.endsWith(".json")).sort() };
    },
  };
}

export { createMemoryFs };
