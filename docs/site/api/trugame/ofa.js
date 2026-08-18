/**
 * POST /api/trugame/ofa
 * Machine door. Seed → accept → camp → fight → next. TG8 out.
 */
import { withProductBox } from "../lib/spl-box-gate.js";

import {
  acceptCard,
  doCamp,
  identity,
  nextCycle,
  packWorld,
  seedWorld,
  unpackWorld,
} from "../lib/ofa-sim.mjs";

const FOCI = new Set(["strike", "wrestle", "ground", "stamina", "rest"]);

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
}

function json(res, code, body) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function loadWorld(body) {
  if (body?.tg8) return unpackWorld(body.tg8);
  if (body?.world) return body.world;
  return seedWorld(Number(body?.seed) || 27);
}

function reply(world) {
  const tg8 = packWorld(world);
  return {
    ok: true,
    cell: "ofa",
    engine: "sim-ofa",
    format: "trugame-tg8",
    phase: world.phase,
    week: world.promotion.week,
    line: world.promotion.lastLine,
    halt: world.lastFight
      ? {
          method: world.lastFight.method,
          winnerId: world.lastFight.winnerId,
          score: [world.lastFight.scoreA, world.lastFight.scoreB],
          ticks: world.lastFight.ticks,
        }
      : null,
    identity: identity(world),
    tg8,
    world,
  };
}

async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  if (req.method === "GET") {
    return json(res, 200, {
      ok: true,
      cell: "ofa",
      loop: ["seed", "accept", "camp", "fight", "next"],
      post: {
        action: "seed | accept | decline | camp | next",
        focus: "strike | wrestle | ground | stamina | rest  (camp only)",
        seed: "number (seed only)",
        tg8: "prior pack (required after seed)",
      },
      law: "/webber",
      play: "https://www.slidphilabs.com/trugame/ofa",
    });
  }

  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "GET or POST" });
  }

  const body = req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body) ? req.body : {};
  const action = String(body.action || "seed").toLowerCase();

  try {
    if (action === "seed") {
      return json(res, 200, reply(seedWorld(Number(body.seed) || 27)));
    }

    let world = loadWorld(body);
    if (action === "accept") world = acceptCard(world, true);
    else if (action === "decline") world = acceptCard(world, false);
    else if (action === "camp" || action === "fight") {
      const focus = FOCI.has(body.focus) ? body.focus : "strike";
      world = doCamp(world, focus);
    } else if (action === "next") {
      world = nextCycle(world);
    } else {
      return json(res, 400, { ok: false, error: "unknown action", try: ["seed", "accept", "decline", "camp", "next"] });
    }
    return json(res, 200, reply(world));
  } catch (e) {
    return json(res, 400, { ok: false, error: String(e.message || e) });
  }
}

export default withProductBox(handler, 'trugame');
