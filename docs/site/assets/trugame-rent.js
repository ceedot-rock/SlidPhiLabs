/** $3.99 / 7-day box on TruGames desks. Self-destructs. Buy Pass to keep playing. */
(function () {
  const BUY = {
    rent: { sku: "trugame-rent-week", label: "Rent 7 days · $3.99" },
    month: { sku: "trugame-month", label: "Keep it · $12 / month" },
    year: { sku: "trugame-year", label: "Year · $79" },
  };

  async function status() {
    const q = new URLSearchParams(location.search);
    const session = q.get("session_id") || q.get("session");
    const product = q.get("product") || "";
    if (session && session.startsWith("cs_")) {
      const r = await fetch("/api/rent-game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "activate", session, sku: product || "trugame-rent-week" }),
      });
      await r.json().catch(() => ({}));
      history.replaceState({}, "", location.pathname);
    }
    const s = await fetch("/api/rent-game").then((r) => r.json());
    return s;
  }

  async function checkout(sku) {
    const r = await fetch("/api/rent-game", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "checkout", sku }),
    });
    const j = await r.json();
    if (j.url) location.href = j.url;
    else alert(j.message || "Checkout unavailable. Email corey@slidphilabs.com");
  }

  function overlay(s) {
    const el = document.createElement("div");
    el.id = "rent-gate";
    el.style.cssText =
      "position:fixed;inset:0;background:rgba(10,16,32,.92);color:#e8f6f8;z-index:80;display:flex;align-items:center;justify-content:center;padding:1.2rem;font:16px/1.45 system-ui,sans-serif";
    const dead = s.door === "dead";
    el.innerHTML = `<div style="max-width:26rem">
      <p style="letter-spacing:.14em;text-transform:uppercase;font-size:.75rem;color:#00E5FF">TruGames</p>
      <h2 style="margin:.3rem 0 0.6rem">${dead ? "The week is up." : "Rent the desk."}</h2>
      <p style="color:#9ab">${dead ? "The 7-day box closed. Rent another week or keep the Pass." : "$3.99 opens every desk for 7 days. Then it dies unless you buy."}</p>
      <p>
        <button data-sku="trugame-rent-week">${BUY.rent.label}</button>
        <button data-sku="trugame-month">${BUY.month.label}</button>
        <button data-sku="trugame-year">${BUY.year.label}</button>
      </p>
    </div>`;
    el.querySelectorAll("button").forEach((b) => {
      b.style.cssText = "margin:.25rem .25rem 0 0;padding:.45rem .7rem;cursor:pointer";
      b.onclick = () => checkout(b.dataset.sku);
    });
    document.body.appendChild(el);
  }

  function banner(s) {
    const el = document.createElement("div");
    el.style.cssText =
      "position:sticky;top:0;z-index:40;background:#0d1828;color:#cfe;padding:.4rem 1rem;font:13px/1.4 system-ui,sans-serif;border-bottom:1px solid #1e3a4a";
    const hrs = s.hours_left != null ? s.hours_left.toFixed(1) : "";
    el.innerHTML =
      s.door === "pass"
        ? `Pass open · ${hrs} h left`
        : `Rental · ${s.days_left} days left · <a href="#" data-buy="trugame-month" style="color:#00E5FF">keep it $12</a>`;
    el.querySelector("[data-buy]")?.addEventListener("click", (e) => {
      e.preventDefault();
      checkout("trugame-month");
    });
    document.body.prepend(el);
  }

  window.TruGameRent = {
    async gate(opts) {
      const s = await status();
      if (s.box_open) {
        banner(s);
        return true;
      }
      if (opts && opts.play) {
        overlay(s);
        return false;
      }
      const strip = document.createElement("div");
      strip.style.cssText =
        "position:sticky;top:0;z-index:40;background:#0d1828;color:#cfe;padding:.5rem 1rem;font:14px/1.4 system-ui,sans-serif";
      strip.innerHTML =
        'Rent any desk <b>$3.99 / 7 days</b> · then it dies · <a href="#" data-r="trugame-rent-week" style="color:#00E5FF">rent</a> · <a href="#" data-r="trugame-month" style="color:#00E5FF">$12 month</a> · <a href="#" data-r="trugame-year" style="color:#00E5FF">$79 year</a>';
      strip.querySelectorAll("[data-r]").forEach((a) => {
        a.onclick = (e) => {
          e.preventDefault();
          checkout(a.getAttribute("data-r"));
        };
      });
      document.body.prepend(strip);
      return false;
    },
    checkout,
  };
})();
