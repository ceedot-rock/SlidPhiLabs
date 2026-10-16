// @slidphi/memory — public API.
//
// Local format operations (export/verify/import) are free and never touch
// the network. Hosted transfer is a reference implementation (not deployed);
// hosted billing is disabled.

export { CODES, MemoryError, fail, isCode } from './errors.mjs';
export { canonicalize, canonicalizeToBytes } from './canonical.mjs';
export {
  FORMAT, VERSION, LIMITS, KINDS, MemoryPayloadV1Schema,
  validatePayload, validateItem, parseRfc3339Utc, jsonDepth,
} from './schema.mjs';
export { generateKeyPair, sign, verify, publicKeyFrom, privateKeyFrom } from './keys.mjs';
export { exportMemory, shouldRedact, findComplexKey, rfc3339Now, SIGNING_DOMAIN, PROOF_FORMAT } from './export.mjs';
export { verifyMemoryExport, normalizeTrustPolicy, revokeKeyFromPolicy } from './verify.mjs';
export { jsonFileAdapter, sqliteAdapter, planImport, applyImport, contentDigestOfPayload } from './import.mjs';
export { verifyRiderCredential, claimsMatchSubject } from './rider.mjs';
export { validateWarrant, consumeWarrantCap, withFileLock, atomicWriteFile } from './warrant.mjs';
export { TransferService, TRANSFER_TTL_MS, PRICE_CENTS, RECEIPT_PURPOSE } from './transfer.mjs';
export { getStatus, clearStatusCache } from './status.mjs';
