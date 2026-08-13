/**
 * Slid Phi Labs — live proof bar + standings hydrate helper
 * Polls /api/phi/metrics + /standings.json. Static fallbacks already match published 8 B records.
 */
(function slidProofInit() {
  const $all = (sel, root) =>
    Array.from((root || document).querySelectorAll(sel));

  function setText(sel, val) {
    if (val == null || val === "") return;
    $all(sel).forEach((el) => {
      el.textContent = String(val);
    });
  }

  function pickZerosBytes(s) {
    if (!s || typeof s !== "object") return null;
    // scorecard: zeros_10k lab_value "8 B"
    const sc = (s.scorecard || []).find(
      (r) =>
        r &&
        /zeros_10k/i.test(r.metric || "") &&
        /ZRW/i.test(r.lab || "")
    );
    if (sc && sc.lab_value) {
      const m = String(sc.lab_value).match(/(\d+)\s*B/i);
      if (m) return m[1];
    }
    // records
    const rec = (s.records || []).find(
      (r) => r && /zeros/i.test(r.corpus || r.title || "")
    );
    if (rec && rec.value) {
      const m = String(rec.value).match(/(\d+)\s*B/i);
      if (m) return m[1];
    }
    return (
      s?.records?.zeros_10k?.zrw_bytes ??
      s?.zrw?.zeros_10k ??
      null
    );
  }

  async function pulse() {
    try {
      const [metricsRes, standingsRes] = await Promise.allSettled([
        fetch("/api/phi/metrics", { cache: "no-store" }),
        fetch("/standings.json", { cache: "no-store" }),
      ]);

      if (metricsRes.status === "fulfilled" && metricsRes.value.ok) {
        const m = await metricsRes.value.json();
        if (m.ratio != null)
          setText("[data-slid=ratio]", Number(m.ratio).toFixed(2));
        if (m.cycles != null) setText("[data-slid=cycles]", m.cycles);
        if (m.self_tune_count != null)
          setText("[data-slid=tunes]", m.self_tune_count);
        if (m.last_path) setText("[data-slid=path]", m.last_path);
        if (m.flagship_zeros_10k_zrw_bytes != null)
          setText(
            "[data-slid=zrw-zeros]",
            m.flagship_zeros_10k_zrw_bytes + " B"
          );
        $all("[data-slid=alive]").forEach((el) => {
          el.textContent = m.alive ? "alive" : "—";
          el.classList.toggle("gold", !!m.alive);
        });
      }

      if (standingsRes.status === "fulfilled" && standingsRes.value.ok) {
        const s = await standingsRes.value.json();
        window.__STANDINGS__ = s;
        const z = pickZerosBytes(s);
        if (z != null) setText("[data-slid=zrw-zeros]", z + " B");
        if (s.version) setText("[data-slid=standings-ver]", "v" + s.version);
        if (s.updated) setText("[data-slid=standings-updated]", s.updated);
        // optional page hydrate hook
        if (typeof window.slidHydrateStandings === "function") {
          try {
            window.slidHydrateStandings(s);
          } catch (e) {
            console.warn("slidHydrateStandings", e);
          }
        }
      }
    } catch (_) {
      /* keep static fallbacks */
    }
    setTimeout(pulse, 4000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", pulse);
  } else {
    pulse();
  }
})();
