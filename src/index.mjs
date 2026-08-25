/** Host work: real encode. Public npm may still ship a stub. IP Guard = public dump only. */
export { encode, decode } from "../docs/site/api/lib/spl-codec.mjs";
export const encodeHybrid = encode;
export const decodeHybrid = decode;
export const OMNI_META = {
  stub: false,
  host_work: true,
  public_npm_stub: true,
  suite: "https://www.slidphilabs.com/pps",
  pricing: "free first 100 GB / job, then ~5¢/GB",
};
export default { encode, decode, encodeHybrid, decodeHybrid, OMNI_META };
