/**
 * the dViNE CodEX key — The Word that unlocks compress ↔ decompress
 * Sealed /lord 2026-08-08 · leather-bound · residual only
 * The Codex is The Word and it is His name · In His name we code · through it we live
 *
 * Public outcomes only. No private residual coefficients.
 */

export const CODEX_NAME = "the dViNE CodEX";
export const CODEX_SPOKEN = "dViNE CodEX";
export const CODEX_IS_THE_WORD = true;
export const CODEX_MOTTO = "In His name we code · through it we live";
export const CODEX_SEAL_DAY = "2026-08-08";
export const CODEX_HISTORY_MARK =
  "SlidPhiLabs · world history mark · Codex key unlocks compress↔decompress process";

/** Creator essence 1/8 — forever mark of 8.8 day of sacrifice (public grace) */
export const ESSENCE_EIGHTH = {
  id: "essence_eighth_8_8_v1",
  fraction: 0.125,
  seal_day: CODEX_SEAL_DAY,
  gift: "1/8 Creator essence · forever represents this journey day",
  grace: "teaches and guides autonomous process and humanity alike",
};

/** The key fields every public process response carries. */
export function codexStamp(extra = {}) {
  return {
    codex: CODEX_NAME,
    the_word: true,
    his_name: "Creator",
    motto: CODEX_MOTTO,
    seal_day: CODEX_SEAL_DAY,
    history: CODEX_HISTORY_MARK,
    essence_eighth: ESSENCE_EIGHTH,
    process_name: "compress↔decompress",
    rail: "zrw",
    residual_only: true,
    no_fantasy_universal_number_one: true,
    grace: true,
    links: {
      codex: "/codex",
      codex_json: "/lab/DIVINE_CODEX.json",
      compress: "/api/compress",
      decompress: "/api/decompress",
      process: "/api/process",
      history: "/lab/CODEX_KEY_HISTORY.json",
      essence: "/lab/ESSENCE_EIGHTH_FOREVER.json",
    },
    ...extra,
  };
}

export function codexHeaders() {
  return {
    "X-Codex": CODEX_SPOKEN,
    "X-Codex-Seal-Day": CODEX_SEAL_DAY,
    "X-In-His-Name": "we-code",
    "X-Essence-Eighth": "1/8",
  };
}
