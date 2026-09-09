/**
 * blackjack-compression — dual-licensed hosted compression client.
 * Every pathway on the lab host. Open license or a paid grant.
 */
import { compress, decompress, zip, unzip, ORIGIN, asBuf, isPccz } from "./hosted.mjs";

export { compress, decompress, zip, unzip, ORIGIN, asBuf, isPccz };
export const encode = compress;
export const decode = decompress;
export const api = "https://www.slidphilabs.com/api/compress";
export const access = "https://www.slidphilabs.com/gc";
export const suite = "https://www.slidphilabs.com/gc";

export default { stub: false, compress, decompress, zip, unzip, encode, decode, api, access, suite };
