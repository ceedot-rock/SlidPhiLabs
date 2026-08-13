/**
 * TRU8 / Slid Phi Labs — dynamic metadata
 * Loads /metadata.json and applies title, description, OG, Twitter, canonical,
 * product meta, and JSON-LD for the current path. Safe no-op if fetch fails.
 * Include on any page: <script src="/assets/dynamic-meta.js" defer></script>
 */
(function () {
  "use strict";

  function pathKey() {
    var p = (location.pathname || "/").replace(/\/$/, "") || "/";
    if (p === "") p = "/";
    return p;
  }

  function ensureMeta(attr, key, value) {
    if (!value) return;
    var sel =
      attr === "property"
        ? 'meta[property="' + key + '"]'
        : 'meta[name="' + key + '"]';
    var el = document.head.querySelector(sel);
    if (!el) {
      el = document.createElement("meta");
      el.setAttribute(attr, key);
      document.head.appendChild(el);
    }
    el.setAttribute("content", value);
  }

  function ensureLink(rel, href) {
    if (!href) return;
    var el = document.head.querySelector('link[rel="' + rel + '"]');
    if (!el) {
      el = document.createElement("link");
      el.setAttribute("rel", rel);
      document.head.appendChild(el);
    }
    el.setAttribute("href", href);
  }

  function ensureJsonLd(graph) {
    if (!graph || !graph.length) return;
    var existing = document.head.querySelector('script[type="application/ld+json"][data-dynamic-meta]');
    if (existing) existing.remove();
    var s = document.createElement("script");
    s.type = "application/ld+json";
    s.setAttribute("data-dynamic-meta", "1");
    s.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@graph": graph,
    });
    document.head.appendChild(s);
  }

  function apply(meta, route) {
    var d = meta.default || {};
    var r = route || {};
    var title = r.title || d.title;
    var description = r.description || d.description;
    var ogTitle = r.og_title || r.title || d.og_title || d.title;
    var ogDesc = r.og_description || r.description || d.og_description || d.description;
    var twTitle = r.twitter_title || ogTitle;
    var twDesc = r.twitter_description || ogDesc;
    var image = r.og_image || d.og_image || meta.logo;
    var canonical = r.canonical || d.canonical || meta.site + pathKey();
    var productLine = r.product_line || d.product_line;

    if (title) document.title = title;
    ensureMeta("name", "description", description);
    ensureMeta("name", "theme-color", meta.theme_color || "#0A0A0A");
    ensureMeta("name", "product", meta.product || "TRU8 Black-Box");
    ensureMeta("name", "product-line", productLine);
    ensureMeta("name", "twitter:card", "summary_large_image");
    ensureMeta("name", "twitter:site", meta.twitter || "@slidphilabs");
    ensureMeta("name", "twitter:title", twTitle);
    ensureMeta("name", "twitter:description", twDesc);
    ensureMeta("name", "twitter:image", image);
    ensureMeta("property", "og:type", "website");
    ensureMeta("property", "og:site_name", "TRU8 · " + (meta.brand || "Slid Phi Labs"));
    ensureMeta("property", "og:title", ogTitle);
    ensureMeta("property", "og:description", ogDesc);
    ensureMeta("property", "og:url", canonical);
    ensureMeta("property", "og:image", image);
    ensureLink("canonical", canonical);
    if (meta.logo_64) ensureLink("icon", meta.logo_64);
    if (meta.logo_180) ensureLink("apple-touch-icon", meta.logo_180);

    var schema = meta.schema || {};
    var graph = [];
    if (schema.organization) {
      var org = Object.assign({}, schema.organization);
      if (meta.logo) org.logo = meta.logo;
      graph.push(org);
    }
    if (schema.software) {
      var soft = Object.assign({}, schema.software);
      soft.author = { "@id": "https://www.slidphilabs.com/#org" };
      graph.push(soft);
    }
    graph.push({
      "@type": "WebSite",
      "@id": "https://www.slidphilabs.com/#website",
      url: meta.site || "https://www.slidphilabs.com/",
      name: meta.product || "TRU8",
      description: description,
      publisher: { "@id": "https://www.slidphilabs.com/#org" },
    });
    ensureJsonLd(graph);

    // Expose for debugging / other scripts
    window.TRU8Meta = {
      path: pathKey(),
      title: title,
      description: description,
      unlock_url: meta.unlock_url,
      trial_days: meta.trial_days,
      unlock_price_usd: meta.unlock_price_usd,
      raw: meta,
      route: r,
    };
  }

  function boot() {
    fetch("/metadata.json", { credentials: "omit", cache: "no-cache" })
      .then(function (res) {
        if (!res.ok) throw new Error("metadata " + res.status);
        return res.json();
      })
      .then(function (meta) {
        var key = pathKey();
        var route = (meta.routes && (meta.routes[key] || meta.routes[key + "/"])) || {};
        apply(meta, route);
      })
      .catch(function (err) {
        if (typeof console !== "undefined" && console.warn) {
          console.warn("[dynamic-meta]", err && err.message ? err.message : err);
        }
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
