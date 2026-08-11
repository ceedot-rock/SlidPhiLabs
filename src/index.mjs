/** Proprietary stub — no codec on public npm. Real package after payment.
 *  Free first 100 GB / job → https://www.slidphilabs.com/pps
 *  Access / support → https://www.slidphilabs.com/access
 */
const MSG =
  "slid-phi is proprietary (Slid Phi Labs). " +
  "Public npm only ships a stub. " +
  "Get the real package: free first 100 GB suite at https://www.slidphilabs.com/pps " +
  "or purchase support/access at https://www.slidphilabs.com/access";
function blocked() { throw new Error(MSG); }
export const encode = blocked;
export const decode = blocked;
export const encodeHybrid = blocked;
export const decodeHybrid = blocked;
export const OMNI_META = {
  stub: true,
  free_suite: "https://www.slidphilabs.com/pps",
  access: "https://www.slidphilabs.com/access",
  pricing: "free first 100 GB / job, then ~5¢/GB",
};
export default { encode, decode, encodeHybrid, decodeHybrid, OMNI_META };
console.warn("[SlidPhiLabs] Stub — no codec source. Free 100 GB suite → https://www.slidphilabs.com/pps");
