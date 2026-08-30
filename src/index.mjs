/**
 * Public npm stub. The encoder is not in this tarball.
 * Hosted: POST https://www.slidphilabs.com/api/compress
 */
const API = "https://www.slidphilabs.com/api/compress";
const SUITE = "https://www.slidphilabs.com/pps";
const MCP = "https://www.slidphilabs.com/mcp";

function stub() {
  const err = new Error(
    `slid-phi public npm is a client stub. POST ${API} · suite ${SUITE} · MCP ${MCP}. Engine is not in this package.`,
  );
  err.code = "SPL_PUBLIC_STUB";
  err.api = API;
  throw err;
}

export const encode = stub;
export const decode = stub;
export const encodeHybrid = stub;
export const decodeHybrid = stub;
export const OMNI_META = {
  stub: true,
  public_npm: true,
  api: API,
  decompress: "https://www.slidphilabs.com/api/decompress",
  suite: SUITE,
  mcp: MCP,
  registry: "io.github.ceedot-rock/slid-phi-labs",
  smithery: "https://smithery.ai/servers/slidphi/lab",
};
export default { encode, decode, encodeHybrid, decodeHybrid, OMNI_META };
