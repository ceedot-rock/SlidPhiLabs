/**
 * SlidPhiLabs / slid-phi package entry
 * Omni-Dormant v2 + classic hybrid API + portable bitstream
 */

export {
  encode as encodeOmni,
  decode as decodeOmni,
  encodeBytes,
  decodeBytes,
  OMNI_META,
} from "./omni_dormant_v2.mjs";

// Primary API aliases (H2)
export { encode, decode, OMNI_META as OMNI } from "./omni_dormant_v2.mjs";

// Classic / hybrid npm compat (H2)
export {
  encodeClassic,
  decodeClassic,
  encodeClassic11,
  decodeClassic11,
  encodeHybrid,
  decodeHybrid,
  HYBRID_META,
} from "./hybrid_locked.mjs";

// Bitstream (H1)
export {
  packBits,
  unpackBits,
  packFrame,
  unpackFrame,
  roundtripBits,
} from "./bitstream.mjs";

// rANS research + optional dispatcher path (H3)
export {
  encodeRansBlock,
  histogram,
  headerBitsEstimate,
  RANS_META,
} from "./rans_gaps.mjs";

// pathways_v2 is optional deep import — not all exports are default
export * as pathwaysV2 from "./pathways_v2.mjs";
