// Stable machine-readable error codes for @slidphi/memory.
// Every failure the library can produce carries one of these codes —
// suitable for API responses, logs, and tests. Codes are frozen.

export const CODES = Object.freeze({
  // ---- contract / schema ----
  UNKNOWN_FORMAT: 'UNKNOWN_FORMAT',
  UNKNOWN_VERSION: 'UNKNOWN_VERSION',
  UNKNOWN_FIELD: 'UNKNOWN_FIELD',
  OVERSIZED_PAYLOAD: 'OVERSIZED_PAYLOAD',
  TOO_MANY_ITEMS: 'TOO_MANY_ITEMS',
  TOO_DEEPLY_NESTED: 'TOO_DEEPLY_NESTED',
  ITEM_TOO_LARGE: 'ITEM_TOO_LARGE',
  UNSUPPORTED_KIND: 'UNSUPPORTED_KIND',
  UNSUPPORTED_CONTENT: 'UNSUPPORTED_CONTENT',
  INVALID_TIMESTAMP: 'INVALID_TIMESTAMP',
  FUTURE_TIMESTAMP: 'FUTURE_TIMESTAMP',
  INVALID_INPUT: 'INVALID_INPUT',
  MALFORMED: 'MALFORMED',
  // ---- signing / trust ----
  UNKNOWN_KEY: 'UNKNOWN_KEY',
  UNSUPPORTED_ALG: 'UNSUPPORTED_ALG',
  KEY_NOT_TRUSTED: 'KEY_NOT_TRUSTED',
  INVALID_SIGNATURE: 'INVALID_SIGNATURE',
  INVALID_PROOF: 'INVALID_PROOF',
  INVALID_TRUST_POLICY: 'INVALID_TRUST_POLICY',
  // ---- import ----
  EXPORT_ID_REUSE: 'EXPORT_ID_REUSE',
  DUPLICATE_EXPORT: 'DUPLICATE_EXPORT',
  CONFLICT: 'CONFLICT',
  // ---- identity / permission ----
  NOT_OWNER: 'NOT_OWNER',
  WRONG_RECIPIENT: 'WRONG_RECIPIENT',
  RIDER_EXPIRED: 'RIDER_EXPIRED',
  RIDER_REVOKED: 'RIDER_REVOKED',
  RIDER_INVALID: 'RIDER_INVALID',
  WARRANT_SCOPE: 'WARRANT_SCOPE',
  WARRANT_INVALID: 'WARRANT_INVALID',
  WARRANT_EXPIRED: 'WARRANT_EXPIRED',
  CAP_EXCEEDED: 'CAP_EXCEEDED',
  // ---- redaction ----
  REDACTED: 'REDACTED',
  // ---- hosted transfer ----
  TRANSFER_NOT_FOUND: 'TRANSFER_NOT_FOUND',
  TRANSFER_EXPIRED: 'TRANSFER_EXPIRED',
  INVALID_TRANSITION: 'INVALID_TRANSITION',
  PAYMENT_REQUIRED: 'PAYMENT_REQUIRED',
  BILLING_DISABLED: 'BILLING_DISABLED',
  SETTLEMENT_FAILED: 'SETTLEMENT_FAILED',
  DUPLICATE_REQUEST: 'DUPLICATE_REQUEST',
  LOCK_TIMEOUT: 'LOCK_TIMEOUT',
});

export class MemoryError extends Error {
  /** @param {string} code one of CODES @param {string} message human-readable @param {any} details extra context (never secrets) */
  constructor(code, message, details) {
    super(message);
    this.name = 'MemoryError';
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

/** Throw a MemoryError with the given code. */
export function fail(code, message, details) {
  throw new MemoryError(code, message, details);
}

/** True when `err` is a MemoryError with one of the given codes. */
export function isCode(err, ...codes) {
  return err instanceof MemoryError && codes.includes(err.code);
}
