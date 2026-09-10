/** One header, ticker, footer, one logo — every page. */
(function () {
  const NAV = [
    ["/", "Home"],
    ["/gc", "Compress"],
    ["/pricing", "Pricing"],
    ["/box", "Try"],
    ["/pay", "Pay"],
  ];
  const MORE = [
    ["/trustream", "TRUSTREAM logs"],
    ["/chamber", "Chamber"],
    ["/rider", "Agent-Rider"],
    ["/warrant", "Warrant"],
    ["/cuni", "CuNi"],
    ["/pcc", ".pcc archive"],
    ["/pulsar", "pulsar"],
    ["/docs", "API"],
    ["/press", "Press"],
    ["/about", "About"],
    ["/products", "All products"],
  ];
  const FALLBACK_NEWS = [
    { t: "Press", title: "Dual-licensed hosted compression — npm clients call the live host", href: "/press" },
    { t: "Silesia", title: "Official 12-file matrix — all pathways", href: "/silesia" },
    { t: "Bench", title: "Live hosted compression vs gzip-9 and brotli-11", href: "/bench" },
    { t: ".pcc", title: "Our archive, like zip — many files, our compression", href: "/pcc" },
    { t: "AWARE", title: "Hosted lossless compression — send a file, restore every byte", href: "/gc" },
    { t: "TRUSTREAM", title: "Live logs on the same plan", href: "/trustream" },
    { t: "Chamber", title: "Two-key lock for a JSON secret", href: "/chamber" },
    { t: "Rider", title: "Signed identity for AI agents", href: "/rider" },
    { t: "Warrant", title: "Mandate and receipts for a Rider", href: "/warrant" },
    { t: "CuNi", title: "Write once. Python, Go, and JS must match", href: "/cuni" },
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
    const more = MORE.map(([href, label]) => {
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
        <nav class="spl-nav" aria-label="Primary">${links}<details class="spl-drop"><summary>More</summary><div class="spl-drop-menu">${more}</div></details><span data-spl-auth></span></nav>
      </div>
    </header>`;
  }

  function ticker(items) {
    const bits = items
      .map((it) => `<a href="${it.href}"><b>${it.t}</b>${it.title}</a>`)
      .join("");
    return `<div class="spl-ticker" role="region" aria-label="Catalog">
      <div class="spl-ticker-track">${bits}${bits}</div>
    </div></div>`;
  }

  function footer() {
    return `<footer class="spl-footer" role="contentinfo">
    <div class="inner">
      <div>
        <h4>Company</h4>
        <a href="/">Home</a>
        <a href="/products">Products</a>
        <a href="/press">Press</a>
        <a href="/box">Try 24 hours</a>
        <a href="mailto:corey@slidphilabs.com">corey@slidphilabs.com</a>
      </div>
      <div>
        <h4>Compress</h4>
        <a href="/gc">Hosted compression</a>
        <a href="/compare">Compare prices</a>
        <a href="/bench">Bench</a>
        <a href="/docs">API</a>
        <a href="/pulsar">pulsar</a>
      </div>
      <div>
        <h4>Also</h4>
        <a href="/trustream">TRUSTREAM</a>
        <a href="/chamber">Chamber</a>
        <a href="/rider">Agent-Rider</a>
        <a href="/warrant">Warrant</a>
        <a href="/cuni">CuNi</a>
        <a href="/about">About</a>
      </div>
      <div>
        <h4>Agents</h4>
        <a href="/agents">For agents</a>
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
