/**
 * Shared chrome: current-page mark + mobile toggle.
 */
(() => {
  const header = document.querySelector("header.site-nav");
  if (!header) return;

  const path = (location.pathname.replace(/\/+$/, "") || "/").toLowerCase();
  const aliases = {
    "/chamber": ["/chamber"],
    "/demos": ["/demos", "/tru8"],
    "/pps": ["/pps", "/try"],
    "/license": ["/license"],
    "/about": ["/about"],
    "/": ["/", "/index.html", "/tru8"],
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
})();
