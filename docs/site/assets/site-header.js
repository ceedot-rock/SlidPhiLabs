/**
 * Shared chrome: current-page mark, mobile toggle, lab news ticker.
 */
(() => {
  const header = document.querySelector("header.site-nav");
  if (header) {
    const path = (location.pathname.replace(/\/+$/, "") || "/").toLowerCase();
    const aliases = {
      "/sios": ["/sios", "/si-os", "/synthetic"],
      "/chamber": ["/chamber"],
      "/demos": ["/demos", "/tru8"],
      "/pps": ["/pps", "/try"],
      "/license": ["/license"],
      "/about": ["/about"],
      "/updates": ["/updates"],
      "/games": ["/games"],
      "/": ["/", "/index.html"],
    };

    header.querySelectorAll("nav.nav-links a").forEach((a) => {
      const href = (a.getAttribute("href") || "").split("?")[0].replace(/\/+$/, "") || "/";
      const keys = aliases[href] || [href];
      const on = keys.some((k) => (k === "/" ? path === "/" : path === k || path.startsWith(k + "/")));
      if (on) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });

    const toggle = header.querySelector(".nav-toggle");
    if (toggle) {
      toggle.addEventListener("click", () => {
        const open = header.classList.toggle("open");
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
      });
      header.querySelectorAll("nav.nav-links a").forEach((a) => {
        a.addEventListener("click", () => {
          header.classList.remove("open");
          toggle.setAttribute("aria-expanded", "false");
        });
      });
    }

    const onScroll = () => header.classList.toggle("scrolled", window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  const KIND = { product: "Product", works: "In works", news: "News", proof: "Proof", games: "Games" };

  function esc(s) {
    return String(s || "").replace(/[&<>"']/g, (c) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ));
  }

  function mountBar() {
    let bar = document.querySelector(".lab-news");
    if (bar) return bar;
    bar = document.createElement("div");
    bar.className = "lab-news";
    bar.setAttribute("role", "region");
    bar.setAttribute("aria-label", "Lab news");
    bar.innerHTML =
      '<a class="lab-news-kicker" href="/updates">Lab news</a>' +
      '<div class="lab-news-viewport">' +
      '<div class="lab-news-track"></div>' +
      "</div>";
    if (header) header.appendChild(bar);
    else document.body.insertBefore(bar, document.body.firstChild);
    return bar;
  }

  function render(bar, items) {
    const track = bar.querySelector(".lab-news-track");
    if (!track || !items.length) return;
    const html = items
      .map((i) => {
        const kind = KIND[i.kind] || "News";
        const href = i.href || "/updates";
        const ext = /^https?:\/\//i.test(href) && href.indexOf(location.origin) !== 0;
        return (
          '<a class="lab-news-item" data-kind="' +
          esc(i.kind || "news") +
          '" href="' +
          esc(href) +
          '"' +
          (ext ? ' target="_blank" rel="noopener"' : "") +
          "><span class=\"lab-news-kind\">" +
          esc(kind) +
          "</span><span class=\"lab-news-title\">" +
          esc(i.title) +
          "</span></a>"
        );
      })
      .join("");
    track.innerHTML = html + html;
    track.style.setProperty("--lab-news-s", Math.max(36, items.length * 8) + "s");
    bar.hidden = false;
  }

  async function pull() {
    const tryUrls = ["/api/lab-news", "/updates.json"];
    for (const url of tryUrls) {
      try {
        const r = await fetch(url, { cache: "no-store" });
        if (!r.ok) continue;
        const data = await r.json();
        let items = data.items || [];
        if (url === "/updates.json") {
          items = items.map((i) => ({
            id: i.id,
            date: i.date,
            kind: i.type === "plan" ? "works" : i.type === "games" ? "games" : i.type === "news" ? "news" : "product",
            title: i.title,
            href: i.href,
          }));
        }
        items = items.filter((i) => i && i.title).slice(0, 20);
        if (items.length) return items;
      } catch {
        /* next source */
      }
    }
    return [];
  }

  async function boot() {
    const bar = mountBar();
    const paint = async () => {
      const items = await pull();
      if (items.length) render(bar, items);
    };
    await paint();
    setInterval(paint, 6 * 60 * 1000);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") paint();
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
