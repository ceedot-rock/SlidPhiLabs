/**
 * Slid Phi Labs — feel-at-home platform chrome
 * Door memory, welcome chip, dual-surface switcher, UTM-safe prefs.
 * Safe on any page; no-ops if DOM hooks missing.
 */
(function () {
  "use strict";
  var KEY = "spl_surface"; // 'human' | 'agent'
  var SEEN = "spl_intro_seen";
  var GREETED = "spl_greeted_session";

  function getPref() {
    try {
      return localStorage.getItem(KEY) || "";
    } catch (_) {
      return "";
    }
  }
  function setPref(v) {
    try {
      if (v === "human" || v === "agent") localStorage.setItem(KEY, v);
    } catch (_) {}
  }
  function pathSurface() {
    var p = (location.pathname || "/").replace(/\/$/, "") || "/";
    if (p === "/humans" || p.indexOf("/humans/") === 0) return "human";
    if (p === "/agents" || p.indexOf("/agents/") === 0) return "agent";
    if (p === "/api/agent" || p === "/platform.json" || p === "/llms.txt") return "agent";
    if (p === "/web" || p === "/pps" || p === "/try" || p === "/access" || p === "/standings") return "human";
    return "";
  }

  // Persist preference from explicit door clicks
  document.addEventListener(
    "click",
    function (e) {
      var a = e.target && e.target.closest ? e.target.closest("a[data-surface],a.door-human,a.door-agent") : null;
      if (!a) return;
      if (a.classList.contains("door-human") || a.getAttribute("data-surface") === "human") setPref("human");
      if (a.classList.contains("door-agent") || a.getAttribute("data-surface") === "agent") setPref("agent");
    },
    true
  );

  // Auto-remember by path
  var pathS = pathSurface();
  if (pathS) setPref(pathS);

  function ensureStyles() {
    if (document.getElementById("spl-platform-home-css")) return;
    var s = document.createElement("style");
    s.id = "spl-platform-home-css";
    s.textContent =
      "#spl-home-bar{position:fixed;left:12px;right:12px;bottom:12px;z-index:90;display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between;" +
      "padding:10px 14px;border-radius:14px;background:rgba(8,14,26,.94);border:1px solid rgba(232,197,71,.35);" +
      "box-shadow:0 12px 40px rgba(0,0,0,.45);backdrop-filter:blur(12px);font-family:IBM Plex Sans,system-ui,sans-serif;font-size:.84rem;color:#eef4fb}" +
      "#spl-home-bar .spl-msg{flex:1;min-width:12rem;color:#8fa3b8;line-height:1.4}" +
      "#spl-home-bar .spl-msg strong{color:#e8c547}" +
      "#spl-home-bar .spl-msg em{color:#5ef0df;font-style:normal}" +
      "#spl-home-bar .spl-actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center}" +
      "#spl-home-bar a.spl-btn{display:inline-flex;padding:7px 12px;border-radius:8px;font-weight:600;font-size:.78rem;text-decoration:none}" +
      "#spl-home-bar a.spl-gold{background:linear-gradient(180deg,#f0d56a,#e8c547);color:#1a1404}" +
      "#spl-home-bar a.spl-teal{background:linear-gradient(180deg,#5ef0df,#3dd6c6);color:#031018}" +
      "#spl-home-bar a.spl-ghost{border:1px solid rgba(61,214,198,.35);color:#eef4fb}" +
      "#spl-home-bar button.spl-x{background:transparent;border:0;color:#8fa3b8;font-size:1.1rem;cursor:pointer;padding:0 4px;line-height:1}" +
      "#spl-home-bar button.spl-x:hover{color:#e8c547}" +
      "@media(max-width:520px){#spl-home-bar{left:8px;right:8px;bottom:8px;flex-direction:column;align-items:stretch}}" +
      ".spl-skip{position:absolute;left:-9999px;top:auto;width:1px;height:1px;overflow:hidden}" +
      ".spl-skip:focus{position:fixed;left:12px;top:12px;z-index:200;width:auto;height:auto;padding:10px 14px;background:#e8c547;color:#1a1404;border-radius:8px;font-weight:700}" +
      ".spl-welcome-top{border-bottom:1px solid rgba(61,214,198,.2);background:rgba(12,21,36,.88);padding:8px 16px;font-size:.82rem;color:#8fa3b8;text-align:center;position:relative;z-index:40}" +
      ".spl-welcome-top strong{color:#e8c547}.spl-welcome-top a{color:#5ef0df;margin:0 4px}";
    document.head.appendChild(s);
  }

  function skipLink() {
    if (document.querySelector(".spl-skip")) return;
    var a = document.createElement("a");
    a.className = "spl-skip";
    a.href = "#main";
    a.textContent = "Skip to content";
    document.body.insertBefore(a, document.body.firstChild);
    // ensure main landmark
    if (!document.getElementById("main")) {
      var header = document.querySelector("header.hero, header, main");
      if (header && header.tagName.toLowerCase() === "main") header.id = "main";
      else if (header) header.id = header.id || "main";
      else {
        var first = document.querySelector("nav + *");
        if (first) first.id = "main";
      }
    }
  }

  function topWelcome() {
    if (document.querySelector(".spl-welcome-top")) return;
    var pref = getPref();
    var path = pathSurface();
    if (!pref && !path) return;
    var bar = document.createElement("div");
    bar.className = "spl-welcome-top";
    bar.setAttribute("role", "status");
    if (pref === "agent" || path === "agent") {
      bar.innerHTML =
        'Welcome home, <strong>agent</strong> · SoT <a href="/api/agent">/api/agent</a> · map <a href="/platform.json">platform.json</a> · human door <a href="/humans" data-surface="human">/humans</a>';
    } else if (pref === "human" || path === "human") {
      bar.innerHTML =
        'Welcome home · <strong>Pub Facing</strong> · free <a href="/web">web compress</a> · <a href="/standings">standings</a> · agents use <a href="/agents" data-surface="agent">/agents</a>';
    } else return;
    var nav = document.querySelector("nav");
    if (nav && nav.parentNode) nav.parentNode.insertBefore(bar, nav.nextSibling);
    else document.body.insertBefore(bar, document.body.firstChild);
  }

  function homeBar() {
    if (document.getElementById("spl-home-bar")) return;
    // Don't stack on intro lock first paint
    if (document.body.classList.contains("intro-lock")) {
      setTimeout(homeBar, 600);
      return;
    }
    var pref = getPref();
    var dismissed;
    try {
      dismissed = sessionStorage.getItem("spl_bar_dismiss") === "1";
    } catch (_) {
      dismissed = false;
    }
    if (dismissed) return;

    var bar = document.createElement("div");
    bar.id = "spl-home-bar";
    bar.setAttribute("role", "region");
    bar.setAttribute("aria-label", "Platform doors");

    var msg = document.createElement("div");
    msg.className = "spl-msg";
    if (pref === "human") {
      msg.innerHTML =
        "You're on the <strong>human</strong> path. Try free compress, then suite when ready. <em>One team · same lab.</em>";
    } else if (pref === "agent") {
      msg.innerHTML =
        "You're on the <strong>agent</strong> path. Start with discovery JSON, then x402. <em>Same products · machine rails.</em>";
    } else {
      msg.innerHTML =
        "<strong>New here?</strong> Two doors, one mission — pick Pub Facing or Agentic Minded. We'll remember.";
    }

    var actions = document.createElement("div");
    actions.className = "spl-actions";
    actions.innerHTML =
      '<a class="spl-btn spl-gold" href="/humans" data-surface="human">Pub Facing</a>' +
      '<a class="spl-btn spl-teal" href="/agents" data-surface="agent">Agentic Minded</a>' +
      '<a class="spl-btn spl-ghost" href="/api/agent">GET /api/agent</a>' +
      '<button type="button" class="spl-x" aria-label="Dismiss">×</button>';

    bar.appendChild(msg);
    bar.appendChild(actions);
    document.body.appendChild(bar);

    bar.querySelector(".spl-x").addEventListener("click", function () {
      bar.remove();
      try {
        sessionStorage.setItem("spl_bar_dismiss", "1");
      } catch (_) {}
    });
  }

  // Optional: soft redirect home → preferred hub once per browser (never force APIs)
  function softHomeHint() {
    var p = (location.pathname || "/").replace(/\/$/, "") || "/";
    if (p !== "/") return;
    var pref = getPref();
    if (!pref) return;
    try {
      if (sessionStorage.getItem(GREETED) === "1") return;
      sessionStorage.setItem(GREETED, "1");
    } catch (_) {}
    // Highlight matching door
    var sel = pref === "human" ? ".door-human" : ".door-agent";
    document.querySelectorAll(sel).forEach(function (el) {
      el.style.outline = "2px solid " + (pref === "human" ? "#e8c547" : "#5ef0df");
      el.style.outlineOffset = "2px";
    });
  }

  function boot() {
    ensureStyles();
    skipLink();
    topWelcome();
    homeBar();
    softHomeHint();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  // Export for debugging
  window.SPLPlatform = { getPref: getPref, setPref: setPref };
})();
