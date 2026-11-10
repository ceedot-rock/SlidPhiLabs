/** Post-deploy smoke gate. Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.
 *
 * Usage: node docs/site/scripts/smoke.mjs <base-url>
 * Probes health (contract), catalog, and one paid verb. A bad deploy fails
 * loudly: any probe returning 5xx, a wrong shape, or a timeout exits non-zero.
 * The paid probe compresses 8 zero bytes (free fill frame): it exercises the
 * paid path without spending quota.
 */
const base = (process.argv[2] || "").replace(/\/+$/, "");
if (!base) {
  console.error("usage: node smoke.mjs <base-url>");
  process.exit(2);
}

async function get(path) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20000);
  try {
    const r = await fetch(base + path, { signal: ctrl.signal });
    const text = await r.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* non-JSON is itself a failure below */ }
    return { status: r.status, json, text: text.slice(0, 200) };
  } catch (e) {
    return { status: 0, json: null, text: String((e && e.message) || e) };
  } finally {
    clearTimeout(t);
  }
}

async function post(path, body) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 30000);
  try {
    const r = await fetch(base + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const text = await r.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* handled below */ }
    return { status: r.status, json, text: text.slice(0, 200) };
  } catch (e) {
    return { status: 0, json: null, text: String((e && e.message) || e) };
  } finally {
    clearTimeout(t);
  }
}

const failures = [];
function check(name, cond, detail = "") {
  if (cond) console.log(`ok: ${name}`);
  else {
    console.error(`FAIL: ${name} ${detail}`);
    failures.push(name);
  }
}

const health = await get("/api/health");
check("health 200", health.status === 200, `got ${health.status}`);
check("health contract", !!health.json && typeof health.json.status === "string",
  health.text);

const agent = await get("/api/agent");
check("agent discovery 200", agent.status === 200, `got ${agent.status}`);

const catalog = await get("/api/x402-products");
check("catalog 200", catalog.status === 200, `got ${catalog.status}`);

const paid = await post("/api/compress", { data_b64: Buffer.alloc(8).toString("base64") });
check("paid verb not 5xx", paid.status < 500, `got ${paid.status} ${paid.text}`);
check("paid verb JSON", !!paid.json, paid.text);

if (failures.length) {
  console.error(`smoke FAILED: ${failures.join(", ")}`);
  process.exit(1);
}
console.log("smoke passed");
