/** Production boot gate. Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 *
 * Import for side effects at the top of any handler that honors a dev
 * bypass: a production boot with the bypass armed throws at load, before
 * any request is served. Staging keeps the dry-run rail.
 */
const bypassArmed = process.env.X402_DEV_BYPASS === "1";
const isProd = process.env.NODE_ENV === "production";

if (isProd && bypassArmed) {
  throw new Error(
    "refusing boot: X402_DEV_BYPASS=1 is not allowed with NODE_ENV=production"
  );
}

export const PROD_GUARD_OK = true;
