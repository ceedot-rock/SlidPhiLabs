/**
 * slid-phi 2.1.0 — package entry
 * Primary: Omni-Dormant v2.1 (dense default=auto, Uint8Array bitstream)
 * Compat: hybrid_locked classic API
 */

export {
  encode,
  decode,
  encodeBytes,
  decodeBytes,
  OMNI_META,
  packBits,
  unpackBits,
  BitWriter,
  BitReader,
} from "./omni.mjs";

export {
  encodeClassic,
  decodeClassic,
  encodeClassic11,
  decodeClassic11,
  encodeHybrid,
  decodeHybrid,
  HYBRID_META,
} from "./hybrid_locked.mjs";

export {
  encodeRansBlock,
  histogram,
  headerBitsEstimate,
  RANS_META,
} from "./rans_gaps.mjs";
