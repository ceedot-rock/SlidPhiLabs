/** One header, ticker, footer, one logo — every page. */
(function () {
  const NAV = [
    ["/", "Home"],
    ["/gc", "Compress"],
    ["/docs", "API"],
    ["/pricing", "Pricing"],
    ["/pay", "Pay"],
  ];
  const MORE = [
    ["/trustream", "TRUSTREAM logs"],
    ["/pulsar", "pulsar download"],
    ["/specialist", "Zeros demo"],
    ["/chamber", "Chamber"],
    ["/rider", "Agent-Rider"],
    ["/cuni", "CuNi"],
    ["/lab-pass", "Lab Pass"],
    ["/about", "About"],
    ["/products", "All products"],
  ];
  const FALLBACK_NEWS = [
    { t: "Compress", title: "AWARE — shrink files for $49/mo, 200 GB, then 8¢/GB", href: "/gc" },
    { t: "Streams", title: "TRUSTREAM — live logs, same AWARE plan", href: "/trustream" },
    { t: "Seal", title: "Chamber — two-key JSON seal, $9/mo · $99/yr", href: "/chamber" },
    { t: "Identity", title: "Agent-Rider — signed agent identity, $79/mo · $790/yr", href: "/rider" },
    { t: "Language", title: "CuNi — write once, print many languages, $0", href: "/cuni" },
    { t: "Free", title: "pulsar — GPLv3 compressor; $490/yr to embed closed", href: "/pulsar" },
    { t: "Bundle", title: "Lab Pass — Chamber + AWARE + TruGame, $668/yr", href: "/lab-pass" },
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
        <a href="/box">Try 24 hours</a>
        <a href="mailto:corey@slidphilabs.com">corey@slidphilabs.com</a>
      </div>
      <div>
        <h4>Products</h4>
        <a href="/gc">AWARE</a>
        <a href="/trustream">TRUSTREAM</a>
        <a href="/chamber">Chamber</a>
        <a href="/rider">Agent-Rider</a>
        <a href="/cuni">CuNi</a>
        <a href="/pulsar">pulsar</a>
      </div>
      <div>
        <h4>Use</h4>
        <a href="/about">About</a>
        <a href="/humans">Humans</a>
        <a href="/pricing">Pricing</a>
        <a href="/docs">API</a>
      </div>
      <div>
        <h4>Also</h4>
        <a href="/lab-pass">Lab Pass</a>
        <a href="/compare">Price table</a>
        <a href="/license">License</a>
        <a href="/npm">npm</a>
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
