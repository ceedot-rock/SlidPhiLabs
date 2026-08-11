/** IP Guard — engine private. Public surface is a stub only. */
const MSG = "bitstream helpers are proprietary (Slid Phi Labs). Public repo ships stubs only. Free first 100 GB → https://www.slidphilabs.com/pps  |  Access → https://www.slidphilabs.com/access";
function blocked() { throw new Error(MSG); }
export const BitWriter = blocked;
export const BitReader = blocked;
export const packBits = blocked;
export const unpackBits = blocked;
export default { BitWriter, BitReader, packBits, unpackBits, stub: true };
