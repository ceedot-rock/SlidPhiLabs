// Hosted transfer service — REFERENCE IMPLEMENTATION. NOT DEPLOYED.
//
// Implements the SPEC section 5 operations with the section 5 state machine:
//   CREATED -> PAYMENT_REQUIRED -> PAYMENT_CONFIRMED -> AVAILABLE -> DELIVERED
//   terminal: FAILED, EXPIRED, DELETED
//
// With billing disabled (the default, and the only supported mode without
// explicit approval) transfers go CREATED -> AVAILABLE directly and run free;
// receipts are marked { sandbox: true, settled: false }.
//
// Privacy bounds (documented, enforced):
// - TLS in transit is the deploy target's job; at rest, ciphertext is
//   AES-256-GCM under a service data key.
// - THE SERVICE CAN DECRYPT CONTENT. End-to-end encryption is NOT offered
//   in v1 — documented here, never implied.
// - Recipient binding: download requires a Rider credential whose agent_id
//   matches the transfer's declared recipient.
// - Transfer IDs are unguessable (trm_ + 128-bit random).
// - Logs carry transfer IDs, states, timestamps, byte counts — NEVER memory
//   payloads, credentials, or keys.
// - Expiry default 72h; the sweeper deletes expired objects idempotently.
// - DELETED removes ciphertext; the tombstone record is retained for
//   idempotency (documented as best-effort deletion, not cryptographic erasure).

import { randomBytes, createCipheriv, createDecipheriv, createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync, unlinkSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { CODES, MemoryError, fail } from './errors.mjs';
import { verifyRiderCredential } from './rider.mjs';
import { validateWarrant, consumeWarrantCap, withFileLock, atomicWriteFile } from './warrant.mjs';
import { generateKeyPair, sign } from './keys.mjs';

export const TRANSFER_TTL_MS = 72 * 60 * 60 * 1000; // 72h
export const PRICE_CENTS = 2;
export const RECEIPT_PURPOSE = 'slidphi.toll-receipt/v1';

const TRANSITIONS = Object.freeze({
  CREATED: ['PAYMENT_REQUIRED', 'AVAILABLE', 'FAILED', 'DELETED'],
  PAYMENT_REQUIRED: ['PAYMENT_CONFIRMED', 'FAILED', 'EXPIRED', 'DELETED'],
  PAYMENT_CONFIRMED: ['AVAILABLE', 'FAILED', 'EXPIRED', 'DELETED'],
  AVAILABLE: ['DELIVERED', 'EXPIRED', 'DELETED', 'FAILED'],
  DELIVERED: ['EXPIRED', 'DELETED'],
  FAILED: ['DELETED'],
  EXPIRED: ['DELETED'],
  DELETED: [],
});

function newTransferId() {
  return 'trm_' + randomBytes(16).toString('base64url');
}

export class TransferService {
  /**
   * @param {object} opts
   *   dir: storage root (required)
   *   billingEnabled: default false. DO NOT enable without explicit approval.
   *   riderVerify / warrantVerify: injected verifiers (tests/offline).
   *   now: () -> epoch ms (tests).
   */
  constructor(opts = {}) {
    if (!opts.dir) fail(CODES.INVALID_INPUT, 'TransferService requires { dir }');
    this.dir = opts.dir;
    this.billingEnabled = opts.billingEnabled === true;
    this.riderVerify = opts.riderVerify;
    this.warrantVerify = opts.warrantVerify;
    this.now = opts.now ?? Date.now;
    this.transfersDir = join(this.dir, 'transfers');
    this.cipherDir = join(this.dir, 'ciphertext');
    this.idemDir = join(this.dir, 'idempotency');
    this.capsDir = join(this.dir, 'caps');
    this.logPath = join(this.dir, 'transfers.log.jsonl');
    mkdirSync(this.transfersDir, { recursive: true });
    mkdirSync(this.cipherDir, { recursive: true });
    mkdirSync(this.idemDir, { recursive: true });
    mkdirSync(this.capsDir, { recursive: true });
    // Service data key + receipt signing key (reference only — generated per dir).
    const keyPath = join(this.dir, 'service-key.json');
    if (existsSync(keyPath)) {
      this.serviceKey = JSON.parse(readFileSync(keyPath, 'utf8'));
    } else {
      const kp = generateKeyPair();
      this.serviceKey = {
        dataKey: randomBytes(32).toString('base64'),
        receiptKeyId: 'toll-receipt-1',
        receiptPrivateJwk: kp.privateJwk,
        receiptPublicJwk: kp.publicJwk,
        created_at: new Date(this.now()).toISOString(),
      };
      atomicWriteFile(keyPath, JSON.stringify(this.serviceKey));
    }
  }

  // ---------- internal helpers ----------

  log(event, fields = {}) {
    // NEVER log payloads, plaintext, credentials, or keys. Only ids/states/counts.
    const { transfer_id, state, bytes, reason } = fields;
    appendFileSync(this.logPath, JSON.stringify({
      ts: new Date(this.now()).toISOString(), event, transfer_id, state, bytes, reason,
    }) + '\n');
  }

  readLog() {
    if (!existsSync(this.logPath)) return [];
    return readFileSync(this.logPath, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  }

  transferPath(id) { return join(this.transfersDir, id + '.json'); }
  cipherPath(id) { return join(this.cipherDir, id + '.json'); }
  lockPath(id) { return join(this.transfersDir, id + '.lock'); }

  loadTransfer(id) {
    const p = this.transferPath(id);
    if (!existsSync(p)) return null;
    try {
      return JSON.parse(readFileSync(p, 'utf8'));
    } catch { return null; }
  }

  saveTransfer(rec) {
    atomicWriteFile(this.transferPath(rec.transfer_id), JSON.stringify(rec));
  }

  async transition(rec, to, why) {
    const allowed = TRANSITIONS[rec.state] || [];
    if (!allowed.includes(to)) {
      fail(CODES.INVALID_TRANSITION, `cannot transition ${rec.state} -> ${to}`, { from: rec.state, to });
    }
    return withFileLock(this.lockPath(rec.transfer_id), () => {
      const cur = this.loadTransfer(rec.transfer_id);
      if (!cur) fail(CODES.TRANSFER_NOT_FOUND, 'transfer not found');
      const ok = (TRANSITIONS[cur.state] || []).includes(to);
      if (!ok) fail(CODES.INVALID_TRANSITION, `cannot transition ${cur.state} -> ${to}`, { from: cur.state, to });
      cur.state = to;
      cur.updated_at = new Date(this.now()).toISOString();
      if (why) cur.last_transition_reason = why;
      this.saveTransfer(cur);
      this.log('transition', { transfer_id: cur.transfer_id, state: to, reason: why });
      return cur;
    });
  }

  async authRider(credential, claimsOpt) {
    const r = await verifyRiderCredential(credential, { verify: this.riderVerify, claims: claimsOpt === true, now: this.now() });
    if (!r.ok) fail(r.code, `rider authentication failed: ${r.detail}`, { code: r.code });
    return { agent_id: r.agent_id, operator_id: r.operator_id };
  }

  encrypt(plaintext) {
    const key = Buffer.from(this.serviceKey.dataKey, 'base64');
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const data = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    return { iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: data.toString('base64') };
  }

  decrypt(pack) {
    const key = Buffer.from(this.serviceKey.dataKey, 'base64');
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(pack.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(pack.tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(pack.data, 'base64')), decipher.final()]);
  }

  signReceipt(receipt) {
    const bytes = Buffer.from(JSON.stringify(receipt), 'utf8');
    return sign(this.serviceKey.receiptPrivateJwk, bytes);
  }

  // ---------- operations ----------

  /**
   * createTransfer({ recipient_agent_id, idempotency_key }, auth)
   * auth: { rider, warrant?, claims?: boolean }
   * Idempotent on idempotency_key: replaying the same key returns the
   * original transfer (DUPLICATE_REQUEST is only raised on key reuse with
   * different parameters).
   */
  async createTransfer(request, auth = {}) {
    if (!request || typeof request.recipient_agent_id !== 'string' || !request.recipient_agent_id) {
      fail(CODES.INVALID_INPUT, 'request.recipient_agent_id is required');
    }
    if (typeof request.idempotency_key !== 'string' || !request.idempotency_key) {
      fail(CODES.INVALID_INPUT, 'request.idempotency_key is required');
    }
    const claims = await this.authRider(auth.rider, auth.claims);
    if (auth.warrant) await this.checkWarrant(auth.warrant, 'memory.transfer');

    // Idempotency: same key -> same transfer; different params -> DUPLICATE_REQUEST.
    // The check-and-create is lock-guarded so concurrent replays create exactly one transfer.
    const idemHash = createHash('sha256').update(request.idempotency_key).digest('hex');
    const idemPath = join(this.idemDir, idemHash + '.json');
    return withFileLock(idemPath + '.lock', async () => {
      if (existsSync(idemPath)) {
        const prior = JSON.parse(readFileSync(idemPath, 'utf8'));
        if (prior.recipient_agent_id !== request.recipient_agent_id) {
          fail(CODES.DUPLICATE_REQUEST, 'idempotency key reused with different parameters');
        }
        const rec = this.loadTransfer(prior.transfer_id);
        this.log('createTransfer.idempotent_replay', { transfer_id: prior.transfer_id, state: rec && rec.state });
        return { transfer_id: prior.transfer_id, state: rec ? rec.state : 'UNKNOWN', idempotent_replay: true };
      }

      const now = this.now();
      const rec = {
        transfer_id: newTransferId(),
        state: 'CREATED',
        created_at: new Date(now).toISOString(),
        updated_at: new Date(now).toISOString(),
        expires_at: new Date(now + TRANSFER_TTL_MS).toISOString(),
        owner: { agent_id: claims.agent_id, operator_id: claims.operator_id },
        recipient: { agent_id: request.recipient_agent_id },
        idempotency_key_hash: idemHash,
        bytes: 0,
        sandbox: !this.billingEnabled,
      };
      this.saveTransfer(rec);
      atomicWriteFile(idemPath, JSON.stringify({ transfer_id: rec.transfer_id, recipient_agent_id: request.recipient_agent_id }));
      this.log('create', { transfer_id: rec.transfer_id, state: 'CREATED' });

      if (!this.billingEnabled) {
        // Sandbox / disabled: free. Receipt marked sandbox:true, settled:false —
        // it NEVER claims a settlement happened. Persisted before transitioning.
        rec.receipt = this.makeReceipt(rec, { cents: 0, settled: false, sandbox: true });
        this.saveTransfer(rec);
        const cur = await this.transition(rec, 'AVAILABLE', 'billing disabled: free sandbox transfer');
        return { transfer_id: cur.transfer_id, state: cur.state, upload_url: `transfer://${cur.transfer_id}/upload`, receipt: cur.receipt };
      }
      const cur = await this.transition(rec, 'PAYMENT_REQUIRED', 'awaiting x402 settlement');
      return { transfer_id: cur.transfer_id, state: cur.state, upload_url: `transfer://${cur.transfer_id}/upload`, price_cents: PRICE_CENTS };
    });
  }

  /**
   * Upload the (already-signed) memory envelope bytes. Owner only.
   * Reference equivalent of PUT <upload_url>.
   */
  async uploadTransfer(transfer_id, plaintextBytes, auth = {}) {
    const claims = await this.authRider(auth.rider, auth.claims);
    const rec = this.loadTransfer(transfer_id);
    if (!rec || rec.owner.agent_id !== claims.agent_id) fail(CODES.TRANSFER_NOT_FOUND, 'transfer not found');
    if (!['CREATED', 'PAYMENT_REQUIRED', 'AVAILABLE', 'PAYMENT_CONFIRMED'].includes(rec.state)) {
      fail(CODES.INVALID_TRANSITION, `cannot upload in state ${rec.state}`);
    }
    const buf = Buffer.isBuffer(plaintextBytes) ? plaintextBytes : Buffer.from(plaintextBytes);
    const pack = this.encrypt(buf);
    atomicWriteFile(this.cipherPath(transfer_id), JSON.stringify(pack));
    rec.bytes = buf.length;
    rec.updated_at = new Date(this.now()).toISOString();
    this.saveTransfer(rec);
    this.log('upload', { transfer_id, state: rec.state, bytes: buf.length });
    return { transfer_id, bytes: buf.length, state: rec.state };
  }

  /**
   * recordSettlement(transfer_id, payment_ref, { verifyPayment }) — billing path.
   * State is persisted BEFORE the receipt is returned, so a crash after
   * settlement cannot lose the transition (recovery = reload from disk).
   * Duplicate notifications for the same payment_ref are idempotent.
   */
  async recordSettlement(transfer_id, payment_ref, opts = {}) {
    if (!this.billingEnabled) fail(CODES.BILLING_DISABLED, 'hosted billing is disabled; transfers run free in sandbox mode');
    if (!payment_ref) fail(CODES.INVALID_INPUT, 'payment_ref is required');
    const rec = this.loadTransfer(transfer_id);
    if (!rec) fail(CODES.TRANSFER_NOT_FOUND, 'transfer not found');
    // Duplicate notification fast path — before the state check, so replays
    // of an already-settled payment stay idempotent instead of erroring.
    if (rec.settlement && rec.settlement.payment_ref === payment_ref) {
      this.log('settlement.duplicate_notification', { transfer_id, state: rec.state });
      return { transfer_id, state: rec.state, receipt: rec.receipt, duplicate: true };
    }
    if (rec.state !== 'PAYMENT_REQUIRED') fail(CODES.INVALID_TRANSITION, `cannot settle in state ${rec.state}`);
    // Server-side verification of the payment rail — never trust the caller.
    let v = { verified: false, detail: 'no verifyPayment hook provided' };
    if (opts.verifyPayment) v = await opts.verifyPayment(payment_ref);
    if (!v || v.verified !== true) {
      await this.transition(rec, 'FAILED', `settlement verification failed: ${(v && v.detail) || 'unverified'}`);
      fail(CODES.SETTLEMENT_FAILED, `settlement not verified: ${(v && v.detail) || 'unverified'}`);
    }
    return withFileLock(this.lockPath(transfer_id), () => {
      const cur = this.loadTransfer(transfer_id);
      if (!cur) fail(CODES.TRANSFER_NOT_FOUND, 'transfer not found');
      if (cur.settlement && cur.settlement.payment_ref === payment_ref) {
        return { transfer_id, state: cur.state, receipt: cur.receipt, duplicate: true };
      }
      // Billable event: PAYMENT_CONFIRMED -> AVAILABLE (the hosting commitment).
      cur.state = 'PAYMENT_CONFIRMED';
      cur.settlement = { payment_ref, verified_at: new Date(this.now()).toISOString() };
      cur.receipt = this.makeReceipt(cur, { cents: PRICE_CENTS, settled: true, sandbox: false, payment_ref });
      cur.state = 'AVAILABLE';
      cur.updated_at = new Date(this.now()).toISOString();
      this.saveTransfer(cur); // persisted BEFORE returning — crash-safe
      this.log('settlement', { transfer_id, state: 'AVAILABLE', bytes: cur.bytes });
      return { transfer_id, state: 'AVAILABLE', receipt: cur.receipt };
    });
  }

  makeReceipt(rec, { cents, settled, sandbox, payment_ref }) {
    const body = {
      format: 'slidphi.toll-receipt',
      version: '1.0',
      purpose: RECEIPT_PURPOSE, // domain-separated from memory exports
      transfer_id: rec.transfer_id,
      cents,
      settled,   // NEVER true unless the rail confirmed it
      sandbox,   // true when billing disabled — no charge occurred
      ...(payment_ref ? { payment_ref } : {}),
      at: new Date(this.now()).toISOString(),
      key_id: this.serviceKey.receiptKeyId,
      alg: 'ES256',
    };
    const signature = this.signReceipt(body);
    return { ...body, signature };
  }

  async getTransferStatus(transfer_id, auth = {}) {
    const claims = await this.authRider(auth.rider, auth.claims);
    const rec = this.loadTransfer(transfer_id);
    // Do not reveal existence to non-parties: same code either way.
    if (!rec || (rec.owner.agent_id !== claims.agent_id && rec.recipient.agent_id !== claims.agent_id)) {
      fail(CODES.TRANSFER_NOT_FOUND, 'transfer not found');
    }
    return { transfer_id: rec.transfer_id, state: rec.state, expires_at: rec.expires_at, bytes: rec.bytes };
  }

  /**
   * downloadTransfer(transfer_id, recipientContext)
   * recipientContext: { rider, claims?: boolean }
   * Recipient-bound: the rider's agent_id must match the declared recipient.
   */
  async downloadTransfer(transfer_id, recipientContext = {}) {
    const claims = await this.authRider(recipientContext.rider, recipientContext.claims);
    const rec = this.loadTransfer(transfer_id);
    if (!rec || rec.recipient.agent_id !== claims.agent_id) {
      fail(CODES.WRONG_RECIPIENT, 'not the bound recipient for this transfer');
    }
    if (this.isExpired(rec)) {
      await this.expireTransfer(rec);
      fail(CODES.TRANSFER_EXPIRED, 'transfer expired');
    }
    if (rec.state !== 'AVAILABLE' && rec.state !== 'DELIVERED') {
      fail(CODES.INVALID_TRANSITION, `transfer not downloadable in state ${rec.state}`);
    }
    const packRaw = existsSync(this.cipherPath(transfer_id)) ? readFileSync(this.cipherPath(transfer_id), 'utf8') : null;
    if (!packRaw) fail(CODES.TRANSFER_NOT_FOUND, 'transfer payload missing');
    const bytes = this.decrypt(JSON.parse(packRaw));
    if (rec.state === 'AVAILABLE') {
      await this.transition(rec, 'DELIVERED', 'first download');
    }
    this.log('download', { transfer_id, state: 'DELIVERED', bytes: bytes.length });
    return { transfer_id, bytes, state: 'DELIVERED' };
  }

  async deleteTransfer(transfer_id, ownerContext = {}) {
    const claims = await this.authRider(ownerContext.rider, ownerContext.claims);
    const rec = this.loadTransfer(transfer_id);
    if (!rec || rec.owner.agent_id !== claims.agent_id) fail(CODES.TRANSFER_NOT_FOUND, 'transfer not found');
    await this.destroyTransfer(rec, 'owner delete');
    return { transfer_id, state: 'DELETED' };
  }

  isExpired(rec) {
    return Date.parse(rec.expires_at) <= this.now() && !['DELETED', 'EXPIRED'].includes(rec.state);
  }

  async expireTransfer(rec) {
    return withFileLock(this.lockPath(rec.transfer_id), () => {
      const cur = this.loadTransfer(rec.transfer_id);
      if (!cur || ['DELETED', 'EXPIRED'].includes(cur.state)) return cur;
      try { unlinkSync(this.cipherPath(cur.transfer_id)); } catch { /* already gone */ }
      cur.state = 'EXPIRED';
      cur.updated_at = new Date(this.now()).toISOString();
      this.saveTransfer(cur);
      this.log('expire', { transfer_id: cur.transfer_id, state: 'EXPIRED' });
      return cur;
    });
  }

  async destroyTransfer(rec, why) {
    return withFileLock(this.lockPath(rec.transfer_id), () => {
      try { unlinkSync(this.cipherPath(rec.transfer_id)); } catch { /* already gone */ }
      // Tombstone retained for idempotency. Ciphertext and content metadata
      // are removed; only routing metadata (owner/recipient ids) is kept so
      // repeat deletes stay authorized and idempotent.
      const tomb = {
        transfer_id: rec.transfer_id, state: 'DELETED', deleted_at: new Date(this.now()).toISOString(), reason: why,
        owner: rec.owner, recipient: rec.recipient,
      };
      this.saveTransfer(tomb);
      this.log('delete', { transfer_id: rec.transfer_id, state: 'DELETED', reason: why });
      return tomb;
    });
  }

  /** Idempotent sweeper: expire past-due transfers and delete expired ones. Safe to re-run. */
  async sweep() {
    const swept = [];
    const errors = [];
    let files = [];
    try { files = readdirSync(this.transfersDir).filter((f) => f.endsWith('.json')); } catch { return { swept, errors }; }
    for (const f of files) {
      const id = f.slice(0, -'.json'.length);
      if (id.endsWith('.lock')) continue;
      try {
        const rec = this.loadTransfer(id);
        if (!rec || rec.state === 'DELETED') continue;
        if (rec.state === 'EXPIRED' || this.isExpired(rec)) {
          await this.destroyTransfer(rec, 'sweeper: expired');
          swept.push(id);
        }
      } catch (e) {
        errors.push({ transfer_id: id, message: e.message });
      }
    }
    if (swept.length) this.log('sweep', { reason: `expired ${swept.length}` });
    return { swept, errors };
  }

  async checkWarrant(warrant, action) {
    const w = await validateWarrant(warrant, { action, verify: this.warrantVerify, now: this.now() });
    if (!w.ok) fail(w.code, `warrant rejected: ${w.detail}`, { code: w.code });
    if (w.warrant.max_calls !== undefined && w.warrant.max_calls !== null) {
      const cap = await consumeWarrantCap(w.warrant.id || 'warrant', this.capsDir, w.warrant.max_calls);
      if (!cap.ok) fail(cap.code, cap.detail, { code: cap.code });
    }
    return w.warrant;
  }
}
