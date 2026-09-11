/**
 * OFA machine sim for /api/trugame/ofa.
 * Canonical engine: Sports-sims packages/sim-ofa (bit-exact CI there).
 * packWorld returns base64 TG8 for the JSON door.
 */
export {
  leftover,
  makeTissue,
  tickTissue,
  imprint,
  SENSE,
  SPEAK,
} from "./ofa/cell.mjs";
export { chamberSeal, chamberUnseal } from "./ofa/chamber.mjs";
export {
  seedWorld,
  acceptCard,
  doCamp,
  nextCycle,
  identity,
  unpackWorld,
  FOCI,
} from "./ofa/world.mjs";

import { packWorld as packWorldBlob } from "./ofa/world.mjs";

/** @returns {string} base64 TG8\x01 */
export function packWorld(world) {
  return packWorldBlob(world).tg8;
}
