// planImport / applyImport — explicit, testable import transactions.
//
// planImport(envelope, destinationPolicy) is a DRY RUN: zero writes. It
// validates every item, detects duplicates/conflicts/idempotency state,
// and reports exactly what would change.
//
// applyImport(plan, authorizedContext) enforces identity + permission
// (Rider credential, optional Warrant for delegation), export-identity
// idempotency, and the conflict policy. Imported content is stored as
// inert data — never executed, fetched, or interpreted.
//
// Adapter interface: { name, version, probe(), has(export_id),
//   get(item_id), put(items, meta), digest() }
//   - has(export_id) -> { export_id, content_sha256 } | null
//   - get(item_id)  -> stored item | null
//   - put(items, { export_id, content_sha256 }) -> { written }
//   - digest()      -> hex sha256 over the adapter's item set (audit aid)

import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { CODES, MemoryError, fail } from './errors.mjs';
import { canonicalize, canonicalizeToBytes } from './canonical.mjs';
import { FORMAT, VERSION, KINDS, validateItem } from './schema.mjs';
import { verifyRiderCredential, claimsMatchSubject } from './rider.mjs';
import { validateWarrant, consumeWarrantCap } from './warrant.mjs';
import { atomicWriteFile } from './warrant.mjs';

export function contentDigestOfPayload(payload) {
  return createHash('sha256').update(canonicalizeToBytes(payload)).digest('hex');
}

function storedItemOf(row) {
  return {
    id: row.id,
    kind: row.kind,
    created_at: row.created_at,
    content: row.content,
    ...(row.provenance !== undefined ? { provenance: row.provenance } : {}),
  };
}

function sameContent(a, b) {
  return canonicalize(a) === canonicalize(b);
}

// ---------------- json-file adapter (generic reference) ----------------

export function jsonFileAdapter(dir, opts = {}) {
  const itemsDir = join(dir, 'items');
  const exportsDir = join(dir, 'exports');
  const safe = (s) => String(s).replace(/[^A-Za-z0-9_-]/g, '_');
  return {
    name: 'json-file',
    version: '1.0',
    dir,
    async probe() {
      mkdirSync(itemsDir, { recursive: true });
      mkdirSync(exportsDir, { recursive: true });
      return { ok: true, dir };
    },
    async has(export_id) {
      const p = join(exportsDir, safe(export_id) + '.json');
      if (!existsSync(p)) return null;
      try {
        const rec = JSON.parse(readFileSync(p, 'utf8'));
        return rec && rec.complete === true ? { export_id: rec.export_id, content_sha256: rec.content_sha256 } : null;
      } catch { return null; }
    },
    async get(item_id) {
      const p = join(itemsDir, safe(item_id) + '.json');
      if (!existsSync(p)) return null;
      try {
        return storedItemOf(JSON.parse(readFileSync(p, 'utf8')));
      } catch { return null; }
    },
    async put(items, meta) {
      mkdirSync(itemsDir, { recursive: true });
      mkdirSync(exportsDir, { recursive: true });
      const recPath = join(exportsDir, safe(meta.export_id) + '.json');
      // Record first (in-progress): a crash before completion leaves an
      // incomplete record, which has() ignores — re-import re-applies safely.
      atomicWriteFile(recPath, JSON.stringify({ export_id: meta.export_id, content_sha256: meta.content_sha256, complete: false, started_at: new Date().toISOString() }));
      let written = 0;
      for (const it of items) {
        atomicWriteFile(join(itemsDir, safe(it.id) + '.json'), JSON.stringify({ id: it.id, kind: it.kind, created_at: it.created_at, content: it.content, provenance: it.provenance, export_id: meta.export_id }));
        written++;
      }
      atomicWriteFile(recPath, JSON.stringify({ export_id: meta.export_id, content_sha256: meta.content_sha256, complete: true, item_count: written, imported_at: new Date().toISOString() }));
      return { written };
    },
    async digest() {
      const h = createHash('sha256');
      const files = existsSync(itemsDir) ? readdirSync(itemsDir).filter((f) => f.endsWith('.json')).sort() : [];
      for (const f of files) h.update(readFileSync(join(itemsDir, f)));
      return h.digest('hex');
    },
  };
}

// ---------------- sqlite adapter (real destination) ----------------

export function sqliteAdapter(dbPath, opts = {}) {
  if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec(`CREATE TABLE IF NOT EXISTS memory_items (
      item_id TEXT PRIMARY KEY,
      export_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      created_at TEXT NOT NULL,
      content_json TEXT NOT NULL,
      provenance_json TEXT,
      imported_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS memory_exports (
      export_id TEXT PRIMARY KEY,
      content_sha256 TEXT NOT NULL,
      item_count INTEGER NOT NULL,
      imported_at TEXT NOT NULL
    );`);
  const qHas = db.prepare('SELECT export_id, content_sha256 FROM memory_exports WHERE export_id = ?');
  const qGet = db.prepare('SELECT item_id, kind, created_at, content_json, provenance_json FROM memory_items WHERE item_id = ?');
  const qPutItem = db.prepare(`INSERT INTO memory_items (item_id, export_id, kind, created_at, content_json, provenance_json, imported_at)
      VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(item_id) DO UPDATE SET
        export_id=excluded.export_id, kind=excluded.kind, created_at=excluded.created_at,
        content_json=excluded.content_json, provenance_json=excluded.provenance_json, imported_at=excluded.imported_at`);
  const qPutExport = db.prepare(`INSERT INTO memory_exports (export_id, content_sha256, item_count, imported_at)
      VALUES (?, ?, ?, ?) ON CONFLICT(export_id) DO UPDATE SET
        content_sha256=excluded.content_sha256, item_count=excluded.item_count, imported_at=excluded.imported_at`);
  const qAll = db.prepare('SELECT item_id, content_json FROM memory_items ORDER BY item_id');
  const putTxn = (items, meta, now) => {
    db.exec('BEGIN IMMEDIATE');
    try {
      for (const it of items) {
        qPutItem.run(it.id, meta.export_id, it.kind, it.created_at, canonicalize(it.content),
          it.provenance === undefined ? null : canonicalize(it.provenance), now);
      }
      qPutExport.run(meta.export_id, meta.content_sha256, items.length, now);
      db.exec('COMMIT');
    } catch (e) {
      try { db.exec('ROLLBACK'); } catch { /* ignore */ }
      throw e;
    }
  };
  return {
    name: 'sqlite',
    version: '1.0',
    async probe() {
      qHas.get('__probe__');
      return { ok: true, dbPath };
    },
    async has(export_id) {
      const r = qHas.get(export_id);
      return r ? { export_id: r.export_id, content_sha256: r.content_sha256 } : null;
    },
    async get(item_id) {
      const r = qGet.get(item_id);
      if (!r) return null;
      return storedItemOf({
        id: r.item_id, kind: r.kind, created_at: r.created_at,
        content: JSON.parse(r.content_json),
        provenance: r.provenance_json ? JSON.parse(r.provenance_json) : undefined,
      });
    },
    async put(items, meta) {
      putTxn(items, meta, new Date().toISOString());
      return { written: items.length };
    },
    async digest() {
      const h = createHash('sha256');
      for (const r of qAll.all()) h.update(r.item_id + ':' + r.content_json + ';');
      return h.digest('hex');
    },
    close() { db.close(); },
  };
}

// ---------------- plan ----------------

/**
 * Dry run. Makes ZERO writes.
 * destinationPolicy: { adapter, subject, conflict?: 'skip'|'overwrite'|'error', allow_kinds?: string[] }
 */
export async function planImport(envelope, destinationPolicy) {
  if (!destinationPolicy || !destinationPolicy.adapter) fail(CODES.INVALID_INPUT, 'destinationPolicy.adapter is required');
  const adapter = destinationPolicy.adapter;
  const conflict = destinationPolicy.conflict ?? 'skip';
  if (!['skip', 'overwrite', 'error'].includes(conflict)) fail(CODES.INVALID_INPUT, 'conflict must be skip|overwrite|error');
  const allowKinds = destinationPolicy.allow_kinds;

  const base = {
    ok: false, reason: undefined, accepted: [], rejected: [],
    unsupported_kinds: [], conflicts: [],
    expected_changes: { inserts: 0, updates: 0, skips: 0 },
    adapter_version: `${adapter.name}@${adapter.version}`,
    export_id: undefined, content_digest: undefined,
    envelope, adapter, destinationPolicy, // carried through for applyImport
  };

  const payload = envelope && envelope.payload;
  if (!payload || typeof payload !== 'object') {
    return { ...base, reason: CODES.MALFORMED };
  }
  if (payload.format !== FORMAT) return { ...base, reason: CODES.UNKNOWN_FORMAT };
  if (payload.version !== VERSION) return { ...base, reason: CODES.UNKNOWN_VERSION };
  const exportId = payload.export_id;
  base.export_id = exportId;
  let digest;
  try {
    digest = contentDigestOfPayload(payload);
  } catch {
    return { ...base, reason: CODES.MALFORMED };
  }
  base.content_digest = digest;

  // Export-identity idempotency, checked before any per-item work.
  let prior = null;
  try {
    prior = await adapter.has(exportId);
  } catch (e) {
    return { ...base, reason: CODES.INVALID_INPUT, detail: `adapter.has failed: ${e.message}` };
  }
  if (prior) {
    if (prior.content_sha256 === digest) {
      return { ...base, ok: true, reason: CODES.DUPLICATE_EXPORT, expected_changes: { inserts: 0, updates: 0, skips: (payload.items || []).length } };
    }
    return { ...base, reason: CODES.EXPORT_ID_REUSE };
  }

  if (!Array.isArray(payload.items)) return { ...base, reason: CODES.MALFORMED };
  const seenIds = new Set();
  for (let i = 0; i < payload.items.length; i++) {
    const item = payload.items[i];
    const id = item && item.id;
    const errs = validateItem(item, { path: `$.items[${i}]` });
    if (errs.length) {
      const kindErr = errs.find((e) => e.code === CODES.UNSUPPORTED_KIND);
      base.rejected.push({ id: typeof id === 'string' ? id : `#${i}`, reason: kindErr ? CODES.UNSUPPORTED_KIND : errs[0].code, errors: errs });
      if (kindErr && !base.unsupported_kinds.includes(item.kind)) base.unsupported_kinds.push(item.kind);
      continue;
    }
    if (allowKinds && !allowKinds.includes(item.kind)) {
      base.rejected.push({ id, reason: CODES.UNSUPPORTED_KIND });
      if (!base.unsupported_kinds.includes(item.kind)) base.unsupported_kinds.push(item.kind);
      continue;
    }
    if (seenIds.has(id)) {
      base.rejected.push({ id, reason: CODES.INVALID_INPUT, errors: [{ path: `$.items[${i}].id`, code: CODES.INVALID_INPUT, message: 'duplicate item id' }] });
      continue;
    }
    seenIds.add(id);
    let existing = null;
    try {
      existing = await adapter.get(id);
    } catch (e) {
      base.rejected.push({ id, reason: CODES.INVALID_INPUT, errors: [{ path: `$.items[${i}]`, code: CODES.INVALID_INPUT, message: `adapter.get failed: ${e.message}` }] });
      continue;
    }
    if (existing && !sameContent({ kind: existing.kind, content: existing.content }, { kind: item.kind, content: item.content })) {
      const c = { item_id: id, resolution: conflict };
      base.conflicts.push(c);
      if (conflict === 'skip') {
        base.expected_changes.skips++;
        continue; // not accepted for write
      }
      if (conflict === 'error') {
        return { ...base, reason: CODES.CONFLICT, conflicts: base.conflicts };
      }
      // overwrite
      base.expected_changes.updates++;
      base.accepted.push(item);
    } else if (existing) {
      base.expected_changes.skips++; // identical content already present
    } else {
      base.expected_changes.inserts++;
      base.accepted.push(item);
    }
  }
  base.ok = true;
  return base;
}

// ---------------- apply ----------------

/**
 * authorizedContext: { rider, warrant?, riderVerify?, warrantVerify?, now? }
 *   rider: credential string, or claims object with opts-claims test seam
 *          ({ agent_id, operator_id, exp?, revoked? } + claims:true).
 * Enforces: rider valid -> subject binding (or warrant delegation) ->
 * idempotency -> conflict policy -> per-item apply with error reporting.
 */
export async function applyImport(plan, authorizedContext = {}) {
  if (!plan || !plan.envelope) fail(CODES.INVALID_INPUT, 'applyImport requires a plan from planImport()');
  if (!plan.ok) fail(CODES.INVALID_INPUT, `cannot apply a failed plan (reason: ${plan.reason})`, { reason: plan.reason });
  const adapter = plan.adapter;
  const payload = plan.envelope.payload;
  const now = authorizedContext.now ?? Date.now();

  // 1. Identity: authenticate the Rider credential.
  const riderRes = await verifyRiderCredential(authorizedContext.rider, {
    verify: authorizedContext.riderVerify,
    claims: authorizedContext.claims === true,
    now,
  });
  if (!riderRes.ok) fail(riderRes.code, `rider authentication failed: ${riderRes.detail}`, { code: riderRes.code });
  const claims = { agent_id: riderRes.agent_id, operator_id: riderRes.operator_id };

  // 2. Permission: the caller must own the memory subject — or present a
  //    warrant delegating memory.import.
  const envelopeSubject = payload.subject;
  const destSubject = plan.destinationPolicy.subject;
  const ownsEnvelope = claimsMatchSubject(claims, envelopeSubject);
  const ownsDest = !destSubject || claimsMatchSubject(claims, destSubject);
  if (!ownsEnvelope || !ownsDest) {
    if (!authorizedContext.warrant) {
      fail(CODES.NOT_OWNER, 'rider identity does not own the memory subject', { agent_id: claims.agent_id });
    }
    const w = await validateWarrant(authorizedContext.warrant, {
      action: 'memory.import',
      verify: authorizedContext.warrantVerify,
      now,
    });
    if (!w.ok) fail(w.code, `warrant rejected: ${w.detail}`, { code: w.code });
    if (w.warrant.max_calls !== undefined && w.warrant.max_calls !== null) {
      const ledgerDir = authorizedContext.capLedgerDir ?? join(adapter.dir ?? '.', '.caps');
      const cap = await consumeWarrantCap(w.warrant.id || 'warrant', ledgerDir, w.warrant.max_calls);
      if (!cap.ok) fail(cap.code, cap.detail, { code: cap.code });
    }
  }

  // 3. Idempotency, re-checked at apply time (plan may be stale).
  const prior = await adapter.has(payload.export_id);
  if (prior) {
    if (prior.content_sha256 === plan.content_digest) {
      return {
        applied: 0, skipped_duplicates: plan.accepted.length + plan.expected_changes.skips,
        errors: [], receipt: importReceipt(plan, 0, 0), duplicate: true,
      };
    }
    fail(CODES.EXPORT_ID_REUSE, `export_id ${payload.export_id} already imported with different content`);
  }

  // 4. Batch put; each adapter owns its atomicity (sqlite: single
  //    transaction; json-file: export record completes last, so a crash
  //    leaves an incomplete record that a retry re-applies cleanly).
  //    A throwing adapter may attach .itemErrors for per-item reporting.
  let written = 0;
  const errors = [];
  try {
    const r = await adapter.put(plan.accepted, { export_id: payload.export_id, content_sha256: plan.content_digest });
    written = r.written;
  } catch (e) {
    const itemErrors = Array.isArray(e.itemErrors) && e.itemErrors.length
      ? e.itemErrors
      : [{ id: '*', reason: e.code || CODES.INVALID_INPUT, message: `adapter.put failed: ${e.message}` }];
    return {
      applied: 0, skipped_duplicates: 0, errors: itemErrors,
      receipt: importReceipt(plan, 0, itemErrors.length), partial: true,
    };
  }
  if (written !== plan.accepted.length) {
    errors.push({ id: '*', reason: CODES.INVALID_INPUT, message: `adapter wrote ${written}/${plan.accepted.length} items` });
  }
  const failed = errors.length;
  return {
    applied: failed ? 0 : written,
    skipped_duplicates: plan.expected_changes.skips,
    errors,
    receipt: importReceipt(plan, failed ? 0 : written, failed),
    ...(failed ? { partial: true } : {}),
  };
}

function importReceipt(plan, applied, failed) {
  return {
    format: 'slidphi.memory-import-receipt',
    version: '1.0',
    export_id: plan.export_id,
    content_digest: plan.content_digest,
    adapter: plan.adapter_version,
    applied,
    failed,
    at: new Date().toISOString(),
  };
}
