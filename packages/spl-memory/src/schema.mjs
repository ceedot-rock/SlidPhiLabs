// MemoryPayloadV1 contract: JSON Schema (draft 2020-12 style, informational)
// plus a zero-dependency validatePayload() that enforces every rule in
// SPEC section 1, including the rules JSON Schema alone cannot express
// (cross-field uniqueness, byte limits, clock-skew bound, depth limit).
//
// validatePayload(payload, opts) -> { ok, errors: [{ path, code, message }] }
// opts.now: epoch ms used for the 5-minute future bound (default Date.now()).

import { CODES } from './errors.mjs';
import { canonicalizeToBytes } from './canonical.mjs';

export const FORMAT = 'slidphi.memory';
export const VERSION = '1.0';

export const LIMITS = Object.freeze({
  maxPayloadBytes: 1048576, // 1 MiB serialized
  maxItems: 10000,
  maxDepth: 10, // object/array nesting levels inside content
  maxItemContentBytes: 65536, // 64 KiB serialized per item content
  maxExtensionValueBytes: 4096,
  futureSkewMs: 5 * 60 * 1000,
});

export const KINDS = Object.freeze(['message', 'preference', 'fact', 'task_state']);

const RE = {
  exportId: /^mem_[A-Za-z0-9_-]{1,64}$/,
  itemId: /^[A-Za-z0-9_-]{1,64}$/,
  rfc3339UtcMs: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
  extKey: /^[a-z0-9]+(\.[a-z0-9]+)+\/[A-Za-z0-9_-]+$/,
  semverish: /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/,
};

const TOP_FIELDS = ['format', 'version', 'export_id', 'created_at', 'issuer', 'subject', 'source', 'items', 'extensions'];
const ITEM_FIELDS = ['id', 'kind', 'created_at', 'content', 'provenance'];

// --- JSON Schema (draft 2020-12 style). Informational: the normative
// enforcement is validatePayload() below, which also checks byte limits,
// uniqueness, depth, and the clock-skew bound. ---
export const MemoryPayloadV1Schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://www.slidphilabs.com/schemas/slidphi.memory/1.0.json',
  title: 'MemoryPayloadV1',
  type: 'object',
  required: ['format', 'version', 'export_id', 'created_at', 'issuer', 'subject', 'source', 'items'],
  additionalProperties: false,
  properties: {
    format: { const: 'slidphi.memory' },
    version: { const: '1.0' },
    export_id: { type: 'string', pattern: '^mem_[A-Za-z0-9_-]{1,64}$' },
    created_at: { type: 'string', format: 'date-time' },
    issuer: { type: 'string', minLength: 1, maxLength: 128 },
    subject: {
      type: 'object',
      required: ['agent_id', 'operator_id'],
      additionalProperties: false,
      properties: {
        agent_id: { type: 'string', minLength: 1, maxLength: 128 },
        operator_id: { type: 'string', minLength: 1, maxLength: 128 },
      },
    },
    source: {
      type: 'object',
      required: ['platform', 'adapter_version'],
      additionalProperties: false,
      properties: {
        platform: { type: 'string', minLength: 1, maxLength: 64 },
        adapter_version: { type: 'string', minLength: 1, maxLength: 32 },
      },
    },
    items: {
      type: 'array',
      maxItems: 10000,
      items: {
        type: 'object',
        required: ['id', 'kind', 'created_at', 'content'],
        additionalProperties: false,
        properties: {
          id: { type: 'string', pattern: '^[A-Za-z0-9_-]{1,64}$' },
          kind: { enum: ['message', 'preference', 'fact', 'task_state'] },
          created_at: { type: 'string', format: 'date-time' },
          content: { type: 'object' },
          provenance: {
            type: 'object',
            required: ['source_id'],
            additionalProperties: false,
            properties: {
              source_id: { type: 'string', minLength: 1, maxLength: 256 },
              observed_at: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
    },
    extensions: {
      type: 'object',
      propertyNames: { pattern: '^[a-z0-9]+(\\.[a-z0-9]+)+/[A-Za-z0-9_-]+$' },
    },
  },
};

// ---------- validation ----------

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/** Strict RFC 3339 UTC with milliseconds: YYYY-MM-DDTHH:mm:ss.sssZ, real calendar date. */
export function parseRfc3339Utc(s) {
  if (typeof s !== 'string' || !RE.rfc3339UtcMs.test(s)) return null;
  const ms = Date.parse(s);
  if (!Number.isFinite(ms)) return null;
  // Reject impossible calendar dates that Date.parse normalizes (e.g. month 13).
  const d = new Date(ms);
  const [datePart, timePart] = s.split('T');
  const [Y, M, D] = datePart.split('-').map(Number);
  const [h, mi, secMs] = timePart.slice(0, -1).split(':');
  const sec = Number(secMs.split('.')[0]);
  if (
    d.getUTCFullYear() !== Y || d.getUTCMonth() + 1 !== M || d.getUTCDate() !== D ||
    d.getUTCHours() !== Number(h) || d.getUTCMinutes() !== Number(mi) || d.getUTCSeconds() !== sec
  ) return null;
  return ms;
}

function checkTimestamp(errors, value, path, now) {
  const ms = parseRfc3339Utc(value);
  if (ms === null) {
    errors.push({ path, code: CODES.INVALID_TIMESTAMP, message: 'must be RFC 3339 UTC (YYYY-MM-DDTHH:mm:ss.sssZ)' });
    return;
  }
  if (ms > now + LIMITS.futureSkewMs) {
    errors.push({ path, code: CODES.FUTURE_TIMESTAMP, message: 'must not be more than 5 minutes in the future' });
  }
}

function checkLen(errors, value, path, min, max, what) {
  if (typeof value !== 'string' || value.length < min || value.length > max) {
    errors.push({ path, code: CODES.INVALID_INPUT, message: `${what} must be a string of ${min}–${max} chars` });
    return false;
  }
  return true;
}

/** Nesting depth of JSON value: scalar 0, each object/array level +1. */
export function jsonDepth(v) {
  if (Array.isArray(v)) return 1 + v.reduce((m, e) => Math.max(m, jsonDepth(e)), 0);
  if (isPlainObject(v)) {
    const ks = Object.keys(v);
    return 1 + ks.reduce((m, k) => Math.max(m, jsonDepth(v[k])), 0);
  }
  return 0;
}

function validateContent(errors, kind, content, path) {
  if (!isPlainObject(content)) {
    errors.push({ path, code: CODES.INVALID_INPUT, message: 'content must be an object' });
    return;
  }
  const size = Buffer.byteLength(canonicalizeToBytes(content));
  if (size > LIMITS.maxItemContentBytes) {
    errors.push({ path, code: CODES.ITEM_TOO_LARGE, message: `serialized content ${size} bytes exceeds 65536` });
  }
  if (jsonDepth(content) > LIMITS.maxDepth) {
    errors.push({ path, code: CODES.TOO_DEEPLY_NESTED, message: `content nesting exceeds ${LIMITS.maxDepth} levels` });
  }
  const noExtra = (allowed) => {
    for (const k of Object.keys(content)) {
      if (!allowed.includes(k)) errors.push({ path: `${path}.${k}`, code: CODES.UNKNOWN_FIELD, message: `unknown content field ${k}` });
    }
  };
  if (kind === 'message') {
    noExtra(['role', 'text']);
    if (!['user', 'agent', 'system'].includes(content.role)) {
      errors.push({ path: `${path}.role`, code: CODES.INVALID_INPUT, message: 'role must be user|agent|system' });
    }
    checkLen(errors, content.text, `${path}.text`, 1, 8192, 'text');
  } else if (kind === 'preference') {
    noExtra(['key', 'value']);
    checkLen(errors, content.key, `${path}.key`, 1, 128, 'key');
    if (!('value' in content)) {
      errors.push({ path: `${path}.value`, code: CODES.INVALID_INPUT, message: 'value is required' });
    } else {
      const vs = Buffer.byteLength(canonicalizeToBytes(content.value));
      if (vs > LIMITS.maxExtensionValueBytes) {
        errors.push({ path: `${path}.value`, code: CODES.ITEM_TOO_LARGE, message: `serialized value ${vs} bytes exceeds 4096` });
      }
    }
  } else if (kind === 'fact') {
    noExtra(['statement', 'confidence']);
    checkLen(errors, content.statement, `${path}.statement`, 1, 4096, 'statement');
    if ('confidence' in content && (typeof content.confidence !== 'number' || content.confidence < 0 || content.confidence > 1)) {
      errors.push({ path: `${path}.confidence`, code: CODES.INVALID_INPUT, message: 'confidence must be a number 0–1' });
    }
  } else if (kind === 'task_state') {
    noExtra(['task', 'state', 'detail']);
    checkLen(errors, content.task, `${path}.task`, 1, 256, 'task');
    if (!['open', 'done', 'blocked'].includes(content.state)) {
      errors.push({ path: `${path}.state`, code: CODES.INVALID_INPUT, message: 'state must be open|done|blocked' });
    }
    if ('detail' in content) checkLen(errors, content.detail, `${path}.detail`, 1, 2048, 'detail');
  }
  // unknown kinds are reported by the caller (UNSUPPORTED_KIND); content unchecked.
}

/** Validate a single item. Returns array of error entries (empty = valid). */
export function validateItem(item, opts = {}) {
  const errors = [];
  const now = opts.now ?? Date.now();
  const path = opts.path ?? 'items[]';
  if (!isPlainObject(item)) {
    errors.push({ path, code: CODES.MALFORMED, message: 'item must be an object' });
    return errors;
  }
  for (const k of Object.keys(item)) {
    if (!ITEM_FIELDS.includes(k)) errors.push({ path: `${path}.${k}`, code: CODES.UNKNOWN_FIELD, message: `unknown item field ${k}` });
  }
  if (typeof item.id !== 'string' || !RE.itemId.test(item.id)) {
    errors.push({ path: `${path}.id`, code: CODES.INVALID_INPUT, message: 'id must match [A-Za-z0-9_-]{1,64}' });
  }
  const kindOk = KINDS.includes(item.kind);
  if (!kindOk) {
    errors.push({ path: `${path}.kind`, code: CODES.UNSUPPORTED_KIND, message: `unsupported kind ${JSON.stringify(item.kind)}` });
  }
  checkTimestamp(errors, item.created_at, `${path}.created_at`, now);
  if ('content' in item) {
    if (kindOk) validateContent(errors, item.kind, item.content, `${path}.content`);
  } else {
    errors.push({ path: `${path}.content`, code: CODES.INVALID_INPUT, message: 'content is required' });
  }
  if ('provenance' in item && item.provenance !== undefined) {
    const p = item.provenance;
    const pp = `${path}.provenance`;
    if (!isPlainObject(p)) {
      errors.push({ path: pp, code: CODES.INVALID_INPUT, message: 'provenance must be an object' });
    } else {
      for (const k of Object.keys(p)) {
        if (!['source_id', 'observed_at'].includes(k)) errors.push({ path: `${pp}.${k}`, code: CODES.UNKNOWN_FIELD, message: `unknown provenance field ${k}` });
      }
      checkLen(errors, p.source_id, `${pp}.source_id`, 1, 256, 'source_id');
      if ('observed_at' in p) checkTimestamp(errors, p.observed_at, `${pp}.observed_at`, now);
    }
  }
  return errors;
}

/** Full payload validation. Returns { ok, errors: [{ path, code, message }] }. */
export function validatePayload(payload, opts = {}) {
  const errors = [];
  const now = opts.now ?? Date.now();
  if (!isPlainObject(payload)) {
    return { ok: false, errors: [{ path: '$', code: CODES.MALFORMED, message: 'payload must be an object' }] };
  }
  for (const k of Object.keys(payload)) {
    if (!TOP_FIELDS.includes(k)) {
      errors.push({ path: `$.${k}`, code: CODES.UNKNOWN_FIELD, message: `unknown top-level field ${k} (outside extensions)` });
    }
  }
  if (payload.format !== FORMAT) {
    errors.push({ path: '$.format', code: CODES.UNKNOWN_FORMAT, message: `format must be ${FORMAT}` });
  }
  if (payload.version !== VERSION) {
    errors.push({ path: '$.version', code: CODES.UNKNOWN_VERSION, message: `version must be ${VERSION}` });
  }
  if (typeof payload.export_id !== 'string' || !RE.exportId.test(payload.export_id)) {
    errors.push({ path: '$.export_id', code: CODES.INVALID_INPUT, message: 'export_id must match mem_[A-Za-z0-9_-]{1,64}' });
  }
  checkTimestamp(errors, payload.created_at, '$.created_at', now);
  checkLen(errors, payload.issuer, '$.issuer', 1, 128, 'issuer');
  const subj = payload.subject;
  if (!isPlainObject(subj)) {
    errors.push({ path: '$.subject', code: CODES.INVALID_INPUT, message: 'subject must be an object' });
  } else {
    for (const k of Object.keys(subj)) {
      if (!['agent_id', 'operator_id'].includes(k)) errors.push({ path: `$.subject.${k}`, code: CODES.UNKNOWN_FIELD, message: `unknown subject field ${k}` });
    }
    checkLen(errors, subj.agent_id, '$.subject.agent_id', 1, 128, 'agent_id');
    checkLen(errors, subj.operator_id, '$.subject.operator_id', 1, 128, 'operator_id');
  }
  const src = payload.source;
  if (!isPlainObject(src)) {
    errors.push({ path: '$.source', code: CODES.INVALID_INPUT, message: 'source must be an object' });
  } else {
    for (const k of Object.keys(src)) {
      if (!['platform', 'adapter_version'].includes(k)) errors.push({ path: `$.source.${k}`, code: CODES.UNKNOWN_FIELD, message: `unknown source field ${k}` });
    }
    checkLen(errors, src.platform, '$.source.platform', 1, 64, 'platform');
    if (checkLen(errors, src.adapter_version, '$.source.adapter_version', 1, 32, 'adapter_version') &&
        !RE.semverish.test(src.adapter_version)) {
      errors.push({ path: '$.source.adapter_version', code: CODES.INVALID_INPUT, message: 'adapter_version must be semver-ish (x.y.z)' });
    }
  }
  const items = payload.items;
  if (!Array.isArray(items)) {
    errors.push({ path: '$.items', code: CODES.INVALID_INPUT, message: 'items must be an array' });
  } else {
    if (items.length > LIMITS.maxItems) {
      errors.push({ path: '$.items', code: CODES.TOO_MANY_ITEMS, message: `item count ${items.length} exceeds ${LIMITS.maxItems}` });
    }
    const seen = new Set();
    // Cap per-item validation work to avoid pathological inputs; the
    // TOO_MANY_ITEMS error above already fails the payload.
    const n = Math.min(items.length, LIMITS.maxItems);
    for (let i = 0; i < n; i++) {
      const path = `$.items[${i}]`;
      for (const e of validateItem(items[i], { now, path })) errors.push(e);
      const id = items[i] && items[i].id;
      if (typeof id === 'string') {
        if (seen.has(id)) errors.push({ path: `${path}.id`, code: CODES.INVALID_INPUT, message: `duplicate item id ${id}` });
        seen.add(id);
      }
    }
  }
  if ('extensions' in payload && payload.extensions !== undefined) {
    const ext = payload.extensions;
    if (!isPlainObject(ext)) {
      errors.push({ path: '$.extensions', code: CODES.INVALID_INPUT, message: 'extensions must be an object' });
    } else {
      for (const k of Object.keys(ext)) {
        if (!RE.extKey.test(k)) {
          errors.push({ path: `$.extensions.${k}`, code: CODES.INVALID_INPUT, message: 'extension key must be reverse-domain namespaced (a.b/c)' });
        } else {
          const vs = Buffer.byteLength(canonicalizeToBytes(ext[k]));
          if (vs > LIMITS.maxExtensionValueBytes) {
            errors.push({ path: `$.extensions.${k}`, code: CODES.ITEM_TOO_LARGE, message: `extension value ${vs} bytes exceeds 4096` });
          }
        }
      }
    }
  }
  // Total serialized size (JCS bytes), checked last.
  try {
    const total = Buffer.byteLength(canonicalizeToBytes(payload));
    if (total > LIMITS.maxPayloadBytes) {
      errors.push({ path: '$', code: CODES.OVERSIZED_PAYLOAD, message: `serialized payload ${total} bytes exceeds ${LIMITS.maxPayloadBytes}` });
    }
  } catch (e) {
    errors.push({ path: '$', code: CODES.MALFORMED, message: `payload is not canonicalizable: ${e.message}` });
  }
  return { ok: errors.length === 0, errors };
}
