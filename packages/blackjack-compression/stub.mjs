/** IP Guard — blackjack-compression is proprietary (Slid Phi Labs).
 *  Public package is a stub only.
 *  Free first 100 GB / job → https://www.slidphilabs.com/pps
 *  Access / private install → https://www.slidphilabs.com/access
 */
const MSG =
  "blackjack-compression is proprietary (Slid Phi Labs). " +
  "Public npm ships a stub only. " +
  "Free first 100 GB suite: https://www.slidphilabs.com/pps  |  Access: https://www.slidphilabs.com/access";
function blocked() { throw new Error(MSG); }
export const compress = blocked;
export const decompress = blocked;
export const compressBytes = blocked;
export const decompressBytes = blocked;
export const compressFileV3 = blocked;
export const decompressFileV3 = blocked;
export const compressSet = blocked;
export const decompressSet = blocked;
export const AdaptiveCodec = blocked;
export const BlackjackCodec = blocked;
export function selfTest() { return false; }
export default {
  compress, decompress, compressBytes, decompressBytes,
  compressFileV3, decompressFileV3, compressSet, decompressSet,
  AdaptiveCodec, BlackjackCodec, selfTest, stub: true,
};
console.warn("[SlidPhiLabs] blackjack-compression stub — real engine private. → https://www.slidphilabs.com/pps");
