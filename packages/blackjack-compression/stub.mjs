/**
 * Public npm stub. Engine is not in this package.
 */
const API = "https://www.slidphilabs.com/api/compress";
const ACCESS = "https://www.slidphilabs.com/access";
const SUITE = "https://www.slidphilabs.com/pps";

function stub() {
  const err = new Error(
    `blackjack-compression public npm is a stub. POST ${API} · suite ${SUITE} · access ${ACCESS}`,
  );
  err.code = "SPL_PUBLIC_STUB";
  err.api = API;
  throw err;
}

export const compress = stub;
export const decompress = stub;
export const encode = stub;
export const decode = stub;
export default { stub: true, compress, decompress, encode, decode, api: API, access: ACCESS, suite: SUITE };
