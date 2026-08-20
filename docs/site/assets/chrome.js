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
    { t: "Try", title: "Any tool free for 24 hours", href: "/box" },
    { t: "Lock", title: "Chamber seals a secret behind two keys", href: "/chamber" },
    { t: "Shrink", title: "TRU8 compresses a file and restores it", href: "/tru8" },
    { t: "Play", title: "TruGame engine · $12 / $79", href: "/trugame" },
    { t: "Year", title: "Lab Pass $1,088 · all four", href: "/lab-pass" },
    { t: "Send", title: "Gate picks a lossless compressor per file", href: "/gate" },
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
        <a href="/box">Try 24h</a>
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
    <p class="legal">© Slid Phi Labs · 24-hour product box · TruGame engine seats · Powered by TRU8</p>
  </footer>`;
  }

  function inject() {
    if (document.body.classList.contains("spl-chrome")) return;
    const news = FALLBACK_NEWS;
    const top = header() + ticker(news);
    document.body.insertAdjacentHTML("afterbegin", top);
    if (!document.querySelector("footer.spl-footer")) {
      document.body.insertAdjacentHTML("beforeend", footer());
    }
    document.body.classList.add("spl-chrome");
    const btn = document.querySelector(".spl-nav-toggle");
    if (btn) {
      btn.addEventListener("click", () => {
        const open = btn.getAttribute("aria-expanded") === "true";
        btn.setAttribute("aria-expanded", open ? "false" : "true");
        document.querySelector(".spl-nav")?.classList.toggle("open", !open);
      });
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", inject);
  else inject();
})();
