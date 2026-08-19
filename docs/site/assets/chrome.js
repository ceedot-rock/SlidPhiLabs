/** One header, ticker, footer, one logo — every page. */
(function () {
  const NAV = [
    ["/", "Home"],
    ["/products", "Products"],
    ["/box", "Try"],
    ["/pricing", "Pricing"],
    ["/docs", "API"],
    ["/games", "Games"],
  ];
  const FALLBACK_NEWS = [
    { t: "Try", title: "24-hour black box — download any product", href: "/box" },
    { t: "News", title: "TruGames rent $3.99 / 7 days", href: "/games" },
    { t: "Live", title: "Front campaign desk", href: "/trugame/front" },
    { t: "Seat", title: "Lab Pass $1,088 · 365 days", href: "/lab-pass" },
    { t: "Seat", title: "Gate Year $790", href: "/gate" },
    { t: "Seat", title: "TRU8 Year $990 · Chamber $490", href: "/license" },
  ];

  function path() {
    let p = location.pathname;
    if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
    return p || "/";
  }

  function header() {
    const here = path();
    const links = NAV.map(([href, label]) => {
      const cur = href === here || (href !== "/" && here.startsWith(href));
      return `<a href="${href}"${cur ? ' aria-current="page"' : ""}>${label}</a>`;
    }).join("");
    return `<a class="spl-skip" href="#main">Skip to content</a>
    <div class="spl-top">
    <header class="spl-header" role="banner">
      <div class="bar">
        <a class="spl-brand" href="/" aria-label="Slid Phi Labs home">
          <img src="/assets/logos/logo-slid-phi-labs.jpg" width="36" height="36" alt=""/>
          <span>Slid Phi Labs</span>
        </a>
        <button class="spl-nav-toggle" type="button" aria-expanded="false" aria-label="Menu"></button>
        <nav class="spl-nav" aria-label="Primary">${links}</nav>
      </div>
    </header>`;
  }

  function ticker(items) {
    const bits = items
      .map((it) => `<a href="${it.href}"><b>${it.t}</b>${it.title}</a>`)
      .join("");
    return `<div class="spl-ticker" role="region" aria-label="Lab news">
      <div class="spl-ticker-track">${bits}${bits}</div>
    </div></div>`;
  }

  function footer() {
    return `<footer class="spl-footer" role="contentinfo">
      <div class="inner">
        <div>
          <h4>Lab</h4>
          <a href="/">Home</a>
          <a href="/products">Products</a>
          <a href="/box">Try 24h box</a>
          <a href="/about">About</a>
          <a href="mailto:corey@slidphilabs.com">corey@slidphilabs.com</a>
        </div>
        <div>
          <h4>Products</h4>
          <a href="/chamber">Chamber</a>
          <a href="/tru8">TRU8</a>
          <a href="/gate">Gate</a>
          <a href="/lab-pass">Lab Pass</a>
          <a href="/pps">Suite</a>
        </div>
        <div>
          <h4>Use</h4>
          <a href="/box">Try 24h</a>
          <a href="/pricing">Pricing</a>
          <a href="/docs">API</a>
          <a href="/games">Games</a>
        </div>
        <div>
          <h4>Agents</h4>
          <a href="/api/agent">/api/agent</a>
          <a href="/llms.txt">llms.txt</a>
          <a href="/api/box">/api/box</a>
        </div>
      </div>
      <p class="legal">© Slid Phi Labs · 24-hour product box · Powered by TRU8</p>
    </footer>`;
  }

  function stripOld() {
    document.querySelectorAll("header.site-nav, body > footer.wrap").forEach((n) => n.remove());
    document.querySelectorAll("img.brand-logo, .hero img[src*='logo-slid-phi-labs']").forEach((n) => {
      if (!n.closest(".spl-header")) n.remove();
    });
  }

  function mapNews(data) {
    const items = [];
    for (const it of data.items || []) {
      items.push({
        t: it.type === "project" ? "Project" : "News",
        title: it.title,
        href: it.href || "/updates",
      });
    }
    return items.length ? items : FALLBACK_NEWS;
  }

  async function loadNews() {
    try {
      const [u, p] = await Promise.all([
        fetch("/updates.json").then((r) => r.json()),
        fetch("/projects.json").then((r) => r.json()).catch(() => ({})),
      ]);
      const items = mapNews(u);
      for (const pr of p.projects || []) {
        if (pr.status === "live" || pr.status === "new") {
          items.unshift({ t: "Project", title: pr.name + (pr.price ? " · " + pr.price : ""), href: pr.url || "/products" });
        }
      }
      return items.slice(0, 12);
    } catch {
      return FALLBACK_NEWS;
    }
  }

  async function mount() {
    if (document.querySelector(".spl-header")) return;
    document.body.classList.add("spl-chrome");
    stripOld();
    const news = await loadNews();
    const wrap = document.createElement("div");
    wrap.innerHTML = header() + ticker(news);
    document.body.insertBefore(wrap, document.body.firstChild);
    const main = document.querySelector("main");
    if (main && !main.id) main.id = "main";
    stripOld();
    if (!document.querySelector(".spl-footer")) {
      document.body.insertAdjacentHTML("beforeend", footer());
    }
    const tog = document.querySelector(".spl-nav-toggle");
    const hdr = document.querySelector(".spl-header");
    if (tog && hdr) {
      tog.addEventListener("click", () => {
        const on = hdr.classList.toggle("open");
        tog.setAttribute("aria-expanded", on ? "true" : "false");
      });
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})();
