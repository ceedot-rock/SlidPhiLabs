/**
 * slid-phi — dual-licensed hosted compression client.
 * Open license or a paid grant. The host runs every pathway.
 */
import { compress, decompress, zip, unzip, ORIGIN, asBuf, isPccz } from "./hosted.mjs";

export { compress, decompress, zip, unzip, ORIGIN, asBuf, isPccz };
export const encode = compress;
export const decodeFn = decompress;

export const OMNI_META = {
  stub: false,
  dual_license: "AGPL-3.0-or-later OR Slid Phi Labs Commercial",
  api: "https://www.slidphilabs.com/api/compress",
  decompress: "https://www.slidphilabs.com/api/decompress",
  mcp: "https://www.slidphilabs.com/mcp",
  licensing: "https://www.slidphilabs.com/licensing.json",
  product: "https://www.slidphilabs.com/gc",
};

export { decompress as decode };

export default { compress, decompress, zip, unzip, encode, decode: decompress, OMNI_META, isPccz };
