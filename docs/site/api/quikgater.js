/** GET /api/quikgater — live status of the fetch worker + render box. */
const WORKER = "https://quikgater-worker.ceedotrock.workers.dev";
const RENDER = "https://quikgater-browser-worker.fly.dev";

async function ping(url, init) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 4000);
  try {
    const r = await fetch(url, { ...init, signal: ac.signal, redirect: "manual" });
    return { ok: r.status < 500, status: r.status };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  } finally {
    clearTimeout(t);
  }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== "GET") {
    res.statusCode = 405;
    return res.end(JSON.stringify({ ok: false, error: "GET only" }));
  }
  const [missing, unpaid, health] = await Promise.all([
    ping(WORKER + "/"),
    ping(WORKER + "/?url=" + encodeURIComponent("https://example.com")),
    ping(RENDER + "/health"),
  ]);
  const live = missing.status === 400 && unpaid.status === 402 && health.ok;
  res.statusCode = 200;
  res.end(
    JSON.stringify({
      ok: true,
      product: "quikgater",
      live,
      worker: WORKER,
      render: RENDER,
      checks: {
        missing_url: missing,
        unpaid_example: unpaid,
        render_health: health,
      },
      expect: "missing URL → 400 · URL without payment → 402",
      page: "https://www.slidphilabs.com/quikgater",
      source: "https://github.com/ceedot-rock/quikgater",
    }),
  );
}
