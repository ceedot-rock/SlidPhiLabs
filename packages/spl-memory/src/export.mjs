// exportMemory(input, signingContext) -> { envelope, redacted_count, item_count }
//
// Builds a MemoryPayloadV1, enforces the exclusion/redaction policy from
// SPEC section 1, validates strictly, then signs with ES256.
//
// Redaction is documented behavior, not silent loss: dropped items are
// counted in redacted_count, and the envelope never claims completeness.
// Redacted content is NEVER logged.

import { randomBytes } from 'node:crypto';
import { CODES, MemoryError, fail } from './errors.mjs';
import { canonicalize } from './canonical.mjs';
import { FORMAT, VERSION, validatePayload, validateItem, LIMITS } from './schema.mjs';
import { sign } from './keys.mjs';

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

export const SIGNING_DOMAIN = 'slidphi.memory/v1';
export const PROOF_FORMAT = 'slidphi.memory-proof';

// Key-name denylist: case-insensitive substring match against preference.key
// and every object key inside content (recursive).
const KEY_DENYLIST = Object.freeze([
  'password', 'passwd', 'pwd', 'secret', 'api_key', 'apikey', 'access_key',
  'auth_token', 'token', 'bearer', 'cookie', 'sessionid', 'session_id',
  'private_key', 'privatekey', 'ssn', 'social_security', 'card_number',
  'cardnumber', 'credit_card', 'cvv', 'cvc', 'pin_code', 'passphrase',
]);

// Value-shape heuristics: high-signal secret shapes.
const VALUE_PATTERNS = Object.freeze([
  /^sk-[A-Za-z0-9_-]{8,}/,            // OpenAI-style
  /^xox[bpas]-[A-Za-z0-9-]+/,         // Slack-style
  /^ghp_[A-Za-z0-9]{8,}/,             // GitHub PAT
  /^gho_[A-Za-z0-9]{8,}/,             // GitHub OAuth
  /^github_pat_[A-Za-z0-9_]{8,}/,     // GitHub fine-grained PAT
  /^AKIA[0-9A-Z]{16}$/,               // AWS access key id
  /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/, // PEM private key block
]);

// Content keys that indicate formats outside v1 (vectors, attachments,
// model weights, binary blobs) — no compatibility contract exists.
const COMPLEX_KEYS = Object.freeze([
  'vector', 'vectors', 'embedding', 'embeddings', 'weights', 'model_weights',
  'attachment', 'attachments', 'binary', 'blob', 'file_data', 'image_data',
  'audio_data', 'model',
]);

function keyHits(name) {
  const n = String(name).toLowerCase();
  return KEY_DENYLIST.some((k) => n.includes(k));
}

function valueHits(v) {
  return typeof v === 'string' && VALUE_PATTERNS.some((re) => re.test(v));
}

function deepSecretHit(content) {
  if (Array.isArray(content)) return content.some(deepSecretHit);
  if (content !== null && typeof content === 'object') {
    return Object.entries(content).some(
      ([k, v]) => keyHits(k) || valueHits(v) || deepSecretHit(v),
    );
  }
  return valueHits(content);
}

/** True when the item must be dropped under the exclusion policy. */
export function shouldRedact(item, extraKeys = []) {
  const extra = extraKeys.map((k) => String(k).toLowerCase());
  const keyHitExtra = (name) => extra.some((k) => String(name).toLowerCase().includes(k));
  if (item.kind === 'preference' && item.content && typeof item.content === 'object' && !Array.isArray(item.content)) {
    if (keyHits(item.content.key) || keyHitExtra(item.content.key)) return true;
  }
  if (deepSecretHit(item.content)) return true;
  // extra denylist against content keys
  if (extra.length) {
    const walk = (v) => {
      if (Array.isArray(v)) return v.some(walk);
      if (v !== null && typeof v === 'object') {
        return Object.entries(v).some(([k, val]) => keyHitExtra(k) || walk(val));
      }
      return false;
    };
    if (walk(item.content)) return true;
  }
  return false;
}

/** Locate a complex-format key (vectors/attachments/weights/...) — outside v1. */
export function findComplexKey(content, path = '$.content') {
  if (Array.isArray(content)) {
    for (let i = 0; i < content.length; i++) {
      const r = findComplexKey(content[i], `${path}[${i}]`);
      if (r) return r;
    }
    return null;
  }
  if (content !== null && typeof content === 'object') {
    for (const [k, v] of Object.entries(content)) {
      if (COMPLEX_KEYS.includes(String(k).toLowerCase())) return `${path}.${k}`;
      const r = findComplexKey(v, `${path}.${k}`);
      if (r) return r;
    }
  }
  return null;
}

export function rfc3339Now() {
  return new Date().toISOString(); // YYYY-MM-DDTHH:mm:ss.sssZ
}

function newExportId() {
  return 'mem_' + randomBytes(16).toString('base64url');
}

/**
 * @param {object} input { issuer?, subject, source, items[], export_id?, created_at?, extensions?, redact? }
 *   redact: true (default) | false | { extra_keys?: string[] }
 * @param {object} signingContext { key_id, privateKey, issuer? }
 * @returns {{ envelope, redacted_count, item_count }}
 * @throws {MemoryError} on any validation or policy failure.
 */
export function exportMemory(input, signingContext) {
  if (!input || typeof input !== 'object') fail(CODES.INVALID_INPUT, 'input must be an object');
  if (!signingContext || typeof signingContext !== 'object') fail(CODES.INVALID_INPUT, 'signingContext must be an object');
  const { key_id, privateKey } = signingContext;
  if (typeof key_id !== 'string' || key_id.length < 1 || key_id.length > 128) {
    fail(CODES.INVALID_INPUT, 'signingContext.key_id must be 1–128 chars');
  }
  if (!privateKey) fail(CODES.INVALID_INPUT, 'signingContext.privateKey is required');

  const issuer = input.issuer ?? signingContext.issuer;
  if (typeof issuer !== 'string' || issuer.length < 1 || issuer.length > 128) {
    fail(CODES.INVALID_INPUT, 'issuer is required (input.issuer or signingContext.issuer), 1–128 chars');
  }
  if (!Array.isArray(input.items)) fail(CODES.INVALID_INPUT, 'input.items must be an array');

  const redactOpt = input.redact ?? true;
  const redactEnabled = redactOpt !== false;
  const extraKeys = (redactOpt && typeof redactOpt === 'object' && Array.isArray(redactOpt.extra_keys)) ? redactOpt.extra_keys : [];

  const createdAt = input.created_at ?? rfc3339Now();
  const kept = [];
  let redactedCount = 0;

  for (let i = 0; i < input.items.length; i++) {
    const rawIn = input.items[i];
    const raw = isPlainObject(rawIn) ? { ...rawIn, created_at: rawIn.created_at ?? createdAt } : rawIn;
    const itemErrs = validateItem(raw, { path: `$.items[${i}]` });
    if (itemErrs.length) {
      fail(CODES.INVALID_INPUT, `input item ${i} invalid`, { errors: itemErrs });
    }
    const complexAt = findComplexKey(raw.content);
    if (complexAt) {
      fail(CODES.UNSUPPORTED_CONTENT, `item ${raw.id}: complex format outside v1 at ${complexAt}`, { id: raw.id, path: complexAt });
    }
    if (redactEnabled && shouldRedact(raw, extraKeys)) {
      redactedCount++;
      continue; // dropped, counted, never logged
    }
    kept.push({
      id: raw.id,
      kind: raw.kind,
      created_at: raw.created_at ?? createdAt,
      content: raw.content,
      ...(raw.provenance !== undefined ? { provenance: raw.provenance } : {}),
    });
  }

  const payload = {
    format: FORMAT,
    version: VERSION,
    export_id: input.export_id ?? newExportId(),
    created_at: createdAt,
    issuer,
    subject: input.subject,
    source: input.source,
    items: kept,
    ...(input.extensions !== undefined ? { extensions: input.extensions } : {}),
  };

  const v = validatePayload(payload);
  if (!v.ok) {
    fail(CODES.INVALID_INPUT, 'built payload failed validation', { errors: v.errors });
  }

  const signingInput = canonicalize({ domain: SIGNING_DOMAIN, alg: 'ES256', key_id, payload });
  let signature;
  try {
    signature = sign(privateKey, Buffer.from(signingInput, 'utf8'));
  } catch (e) {
    fail(CODES.INVALID_INPUT, `signing failed: ${e.message}`);
  }

  const envelope = {
    payload,
    proof: {
      format: PROOF_FORMAT,
      version: VERSION,
      alg: 'ES256',
      key_id,
      signature,
      signed_at: rfc3339Now(),
    },
  };
  return { envelope, redacted_count: redactedCount, item_count: kept.length };
}

// Re-exported for tests / policy introspection.
export { LIMITS };
