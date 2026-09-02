/** One header, ticker, footer, one logo — every page. */
(function () {
  const NAV = [
    ["/", "Home"],
    ["/products", "Products"],
    ["/about", "About"],
    ["/pricing", "Pricing"],
    ["/box", "Try"],
  ];
  const FALLBACK_NEWS = [
    { t: "Lab", title: "Slid Phi Labs — tools that check", href: "/about" },
    { t: "Language", title: "CuNi — one source, three runtimes, or refuse", href: "/cuni" },
    { t: "Seal", title: "Chamber — two keys for a JSON secret", href: "/chamber" },
    { t: "Identity", title: "Agent-Rider — signed agent credentials", href: "/rider" },
    { t: "Compress", title: "AWARE — hosted lossless compressor", href: "/gc" },
    { t: "Meter", title: "Suite — 6.9 GB / 3 h then ~5¢/GB", href: "/pps" },
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
        <nav class="spl-nav" aria-label="Primary">${links}<span data-spl-auth></span></nav>
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
        <a href="/cuni">CuNi</a>
        <a href="/chamber">Chamber</a>
        <a href="/rider">Agent-Rider</a>
        <a href="/gc">AWARE compressor</a>
        <a href="/pps">Suite</a>
        <a href="/lab-pass">Lab Pass</a>
      </div>
      <div>
        <h4>Use</h4>
        <a href="/about">About the lab</a>
        <a href="/humans">Humans</a>
        <a href="/pricing">Pricing</a>
        <a href="/docs">API</a>
      </div>
      <div>
        <h4>Agents</h4>
        <a href="/agents">Agent door</a>
        <a href="/api/agent">/api/agent</a>
        <a href="/llms.txt">llms.txt</a>
        <a href="/mcp">/mcp</a>
      </div>
    </div>
    <p class="legal">© Slid Phi Labs · Cherry Hill · corey@slidphilabs.com</p>
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
    if (!document.querySelector('script[src*="lab-auth.js"]')) {
      const s = document.createElement("script");
      s.src = "/assets/lab-auth.js?v=3";
      document.body.appendChild(s);
    }
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
