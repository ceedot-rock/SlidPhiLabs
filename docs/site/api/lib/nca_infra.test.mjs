import test from "node:test";
import assert from "node:assert/strict";
import {
  AGENT_SEATS,
  INFRA_SEATS,
  residualFromProcess,
  ncaTick,
  ncaReport,
  attachNca,
  ncaBindApp,
  ncaHeaders,
} from "./nca_infra.mjs";

// Decorative-only dashboard coat: assert public-safe shape and pure-function
// behavior. The module holds process-wide tick state, so assertions use
// ranges/types rather than exact plane values.

test("happy: residualFromProcess is pure and clamped to [0,1]", () => {
  assert.equal(residualFromProcess({}), 0.12);
  assert.equal(residualFromProcess(), 0.12);
  const clean = residualFromProcess({ ok: true, mirror_error: 0, ms: 10, score: 100, roundtrip: true });
  assert.ok(clean >= 0 && clean <= 1);
  const bad = residualFromProcess({ ok: false, fail: 100, soft: 100, ms: 99999, roundtrip: false, score: 0 });
  assert.equal(bad, 1);
  assert.ok(residualFromProcess({ ok: false }) > residualFromProcess({}));
  assert.ok(residualFromProcess({ ms: 5000 }) > residualFromProcess({ ms: 5 }));
  assert.ok(residualFromProcess({ score: 50 }) > residualFromProcess({ score: 100 }));
});

test("happy: seats are frozen public labels", () => {
  assert.ok(Object.isFrozen(AGENT_SEATS));
  assert.ok(Object.isFrozen(INFRA_SEATS));
  assert.equal(AGENT_SEATS.phi, 40);
  assert.ok(INFRA_SEATS.health != null);
});

test("happy: ncaTick advances the coat and stays on-plane", () => {
  const a = ncaTick("health", { ok: true, ms: 5 });
  assert.equal(a.point, "health");
  assert.ok(Number.isInteger(a.plane) && a.plane >= 0 && a.plane < 360);
  assert.ok(a.residual_public >= 0 && a.residual_public <= 1);
  assert.ok(a.collapse >= 0 && a.collapse <= 1);
  assert.ok(a.depth >= 8 && a.depth <= 16);
  assert.ok(a.ticks >= 1);
  assert.ok(a.at);
  const b = ncaTick("health", { ok: true, ms: 5 });
  assert.equal(b.ticks, a.ticks + 1);
  // Free-form points do not throw.
  const free = ncaTick("custom-point", { ok: false });
  assert.equal(free.point, "custom-point");
  assert.ok(free.residual_public > a.residual_public);
});

test("happy: ncaReport carries the public-safe cloak shape", () => {
  const r = ncaReport({ point: "metrics", obs: { ok: true }, app: "test-app" });
  assert.equal(r.schema, "spl.nca.infra.v1");
  assert.equal(r.ok, true);
  assert.equal(r.public_safe, true);
  assert.equal(r.app, "test-app");
  assert.deepEqual(r.cadence, [33, 66, 999]);
  assert.equal(r.cloak.on, true);
  assert.equal(r.cloak.depth_target, 12);
  assert.ok(r.agent_seats.phi === "phi@p40");
  assert.ok(r.infra_seats.health === "health@p10");
  assert.ok(Array.isArray(r.recent_points));
});

test("happy: attachNca stamps the body and passes non-objects through", () => {
  const body = { ok: true, app: "test-app" };
  const out = attachNca(body, "process", { ok: true });
  assert.equal(out, body);
  assert.equal(out.nca.schema, "spl.nca.infra.v1");
  assert.ok(out.nca_seat);
  assert.ok(Number.isInteger(out.nca_plane));
  assert.equal(attachNca(null), null);
  assert.equal(attachNca("x"), "x");
});

test("happy: ncaBindApp + ncaHeaders", () => {
  assert.equal(ncaBindApp("probe-app"), "probe-app");
  const h = ncaHeaders();
  assert.equal(h["X-SPL-NCA"], "infra.v1");
  assert.ok(h["X-SPL-NCA-Plane"] != null);
  assert.ok(h["X-SPL-NCA-Seat"]);
  assert.ok(h["X-SPL-NCA-Depth"] != null);
  ncaBindApp("test-app");
});

test("error: summarizeObs drops unknown keys, keeps known ones", () => {
  const rec = ncaTick("status", { ok: true, secret_cookie: "nope", path: "/x" });
  assert.equal(rec.obs.secret_cookie, undefined);
  assert.equal(rec.obs.path, "/x");
  assert.equal(rec.obs.ok, true);
});
