/**
 * Zero Range Wave — license gates
 * Free Gate: max 25 issued keys (tracked offline in FREE_KEYS.json by publisher)
 * Paid: Starting Gate / Pro Starter / l33t Unlimited
 *
 * Usage:
 *   import { assertLicense, setLicenseKey, Tiers } from './license.js'
 *   setLicenseKey(process.env.ZRW_LICENSE)
 *   assertLicense({ op: 'compress', n: arr.length, livestream: false })
 */

export const Tiers = Object.freeze({
  FREE: "free_gate",
  STARTING: "starting_gate",
  PRO: "pro_starter",
  L33T: "l33t_unlimited",
});

/** Free Gate allotment — never issue more than this many free keys. */
export const FREE_LICENSE_CAP = 25;

export const LIMITS = Object.freeze({
  [Tiers.FREE]: {
    label: "Free Gate",
    priceUsd: 0,
    products: 1,
    opsPerMonth: 100_000,
    maxIntsPerCall: 10_000,
    livestream: false,
    commercial: false,
    buyUrl: null,
  },
  [Tiers.STARTING]: {
    label: "Starting Gate",
    priceUsd: 79,
    products: 1,
    opsPerMonth: 5_000_000,
    maxIntsPerCall: 100_000,
    livestream: false,
    commercial: true,
    buyUrl: "https://buy.stripe.com/28EfZic3z69i3P72Wc6wE0b",
  },
  [Tiers.PRO]: {
    label: "Pro Starter",
    priceUsd: 249,
    products: 5,
    opsPerMonth: 50_000_000,
    maxIntsPerCall: 1_000_000,
    livestream: true,
    commercial: true,
    buyUrl: "https://buy.stripe.com/cNidRaebHbtC71j8gw6wE0c",
  },
  [Tiers.L33T]: {
    label: "l33t Unlimited",
    priceUsd: 699,
    products: Infinity,
    opsPerMonth: Infinity,
    maxIntsPerCall: Infinity,
    livestream: true,
    commercial: true,
    redistribution: true,
    buyUrl: "https://buy.stripe.com/14AeVe9Vr8hqadvbsI6wE0d",
  },
});

/** In-memory monthly op counter (process-local; production should use durable store). */
const state = {
  key: null,
  tier: Tiers.FREE,
  opsThisMonth: 0,
  monthKey: monthStamp(),
};

function monthStamp() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`;
}

function rollMonth() {
  const m = monthStamp();
  if (m !== state.monthKey) {
    state.monthKey = m;
    state.opsThisMonth = 0;
  }
}

/**
 * Parse license key format:
 *   ZRW-<TIER>-<PAYLOAD>
 * Tier codes: FREE | START | PRO | L33T
 * Free keys should be issued only until FREE_LICENSE_CAP is reached (publisher side).
 */
export function parseLicenseKey(key) {
  if (!key || typeof key !== "string") return { tier: Tiers.FREE, valid: false };
  const parts = key.trim().toUpperCase().split("-");
  if (parts[0] !== "ZRW" || parts.length < 2) {
    return { tier: Tiers.FREE, valid: false };
  }
  const code = parts[1];
  const map = {
    FREE: Tiers.FREE,
    START: Tiers.STARTING,
    STARTING: Tiers.STARTING,
    GATE: Tiers.STARTING,
    PRO: Tiers.PRO,
    STARTER: Tiers.PRO,
    L33T: Tiers.L33T,
    LEET: Tiers.L33T,
    UNLIMITED: Tiers.L33T,
  };
  const tier = map[code] || Tiers.FREE;
  // Placeholder validation: non-empty payload after tier for paid; FREE accepts FREE-xxxx
  const payload = parts.slice(2).join("-");
  const valid =
    tier === Tiers.FREE
      ? payload.length >= 4
      : payload.length >= 8;
  return { tier, valid, payload };
}

export function setLicenseKey(key) {
  const parsed = parseLicenseKey(key);
  state.key = key || null;
  state.tier = parsed.valid ? parsed.tier : Tiers.FREE;
  return { ...parsed, limits: LIMITS[state.tier] };
}

export function getLicenseInfo() {
  rollMonth();
  return {
    tier: state.tier,
    limits: LIMITS[state.tier],
    opsThisMonth: state.opsThisMonth,
    freeCap: FREE_LICENSE_CAP,
  };
}

/**
 * @param {{ op?: string, n?: number, livestream?: boolean }} opts
 * @throws {Error} on limit breach
 */
export function assertLicense(opts = {}) {
  rollMonth();
  const { n = 0, livestream = false } = opts;
  const lim = LIMITS[state.tier] || LIMITS[Tiers.FREE];

  if (livestream && !lim.livestream) {
    const upgrade = LIMITS[Tiers.PRO].buyUrl;
    throw new Error(
      `ZRW: livestream not included in ${lim.label}. Upgrade Pro Starter: ${upgrade}`,
    );
  }

  if (n > lim.maxIntsPerCall) {
    throw new Error(
      `ZRW: max ${lim.maxIntsPerCall} ints/call on ${lim.label} (got ${n}). Upgrade: ${lim.buyUrl || LIMITS[Tiers.STARTING].buyUrl}`,
    );
  }

  if (state.opsThisMonth >= lim.opsPerMonth) {
    throw new Error(
      `ZRW: monthly op limit (${lim.opsPerMonth}) reached for ${lim.label}. Upgrade: ${lim.buyUrl || LIMITS[Tiers.STARTING].buyUrl}`,
    );
  }

  state.opsThisMonth += 1;
  return true;
}

export function recordOp() {
  rollMonth();
  state.opsThisMonth += 1;
}
