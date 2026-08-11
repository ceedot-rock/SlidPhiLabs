/** IP Guard — engine private. Public surface is a stub only. */
const MSG = "hybrid_locked is proprietary (Slid Phi Labs). Public repo ships stubs only. Free first 100 GB → https://www.slidphilabs.com/pps  |  Access → https://www.slidphilabs.com/access";
function blocked() { throw new Error(MSG); }
export const encode = blocked;
export const decode = blocked;
export default { encode, decode, stub: true };
