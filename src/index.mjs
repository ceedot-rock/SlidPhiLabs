/** Proprietary stub — no codec on public npm. https://www.slidphilabs.com/access */
const MSG =
  "slid-phi is proprietary (SlidPhiLabs). " +
  "Public npm only ships a stub. After purchase or Try Gate, you receive the real package. " +
  "https://www.slidphilabs.com/access";
function blocked() { throw new Error(MSG); }
export const encode = blocked;
export const decode = blocked;
export const encodeHybrid = blocked;
export const decodeHybrid = blocked;
export const OMNI_META = { stub: true, access: "https://www.slidphilabs.com/access" };
export default { encode, decode, encodeHybrid, decodeHybrid, OMNI_META };
console.warn("[SlidPhiLabs] Stub — no codec source. → https://www.slidphilabs.com/access");
