/** One lab session for every Slid Phi product. Token rides in #spl= across origins. */
(function () {
  const AUTH = "https://www.slidphilabs.com/api/auth";
  const HOME = "https://www.slidphilabs.com";
  const KEY = "spl_lab_token";
  const AR = "spl_ar_key";

  function capture() {
    const u = new URL(location.href);
    let t = u.searchParams.get("spl") || "";
    if (location.hash.indexOf("spl=") === 1) t = decodeURIComponent(location.hash.slice(5).split("&")[0]);
    if (!t) return;
    localStorage.setItem(KEY, t);
    u.searchParams.delete("spl");
    const clean = u.pathname + (u.searchParams.toString() ? "?" + u.searchParams.toString() : "");
    history.replaceState({}, "", clean);
  }

  function withToken(href, token) {
    if (!href || !token) return href;
    try {
      const u = new URL(href, location.href);
      if (u.origin === location.origin && u.hostname === location.hostname) return u.href;
      u.hash = "spl=" + encodeURIComponent(token);
      return u.toString();
    } catch {
      return href;
    }
  }

  async function me() {
    const t = localStorage.getItem(KEY);
    if (!t) return null;
    try {
      const r = await fetch(AUTH, { headers: { Authorization: "Bearer " + t } });
      const j = await r.json();
      if (!j.ok) {
        localStorage.removeItem(KEY);
        return null;
      }
      return j.user;
    } catch {
      return null;
    }
  }

  async function send(action, fields) {
    const r = await fetch(AUTH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...fields }),
    });
    const j = await r.json().catch(() => ({}));
    if (j.token) localStorage.setItem(KEY, j.token);
    return j;
  }

  function goAfter(token) {
    const n = new URLSearchParams(location.search).get("next") || HOME + "/account";
    location.href = withToken(n, token);
  }

  function paint(el, user) {
    if (!el) return;
    const next = encodeURIComponent(location.href.split("#")[0]);
    const tok = localStorage.getItem(KEY);
    if (user) {
      const acc = withToken(HOME + "/account", tok);
      el.innerHTML =
        '<a href="' +
        acc +
        '">' +
        String(user.name || user.email).replace(/[<>]/g, "") +
        '</a> · <button type="button" data-spl-logout style="background:none;border:0;color:inherit;cursor:pointer;font:inherit;padding:0">Log out</button>';
      el.querySelector("[data-spl-logout]")?.addEventListener("click", () => {
        localStorage.removeItem(KEY);
        localStorage.removeItem(AR);
        location.reload();
      });
    } else {
      el.innerHTML =
        '<a href="' +
        HOME +
        "/signup?next=" +
        next +
        '">Sign up</a> · <a href="' +
        HOME +
        "/login?next=" +
        next +
        '">Log in</a>';
    }
  }

  async function provisionRider(user) {
    if (!/agentrider\.(fly\.dev|vercel\.app)$/.test(location.hostname)) return;
    if (localStorage.getItem(AR)) return;
    try {
      const r = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: user.name || user.email, type: "human", operator_id: user.id }),
      });
      const j = await r.json().catch(() => ({}));
      if (j.api_key) localStorage.setItem(AR, j.api_key);
      if (j.agent_id) localStorage.setItem("spl_ar_id", j.agent_id);
    } catch {
      /* register is best-effort */
    }
  }

  async function mount() {
    capture();
    const user = await me();
    document.querySelectorAll("[data-spl-auth]").forEach((el) => paint(el, user));
    if (user) await provisionRider(user);
    return user;
  }

  window.SPLAuth = {
    me,
    signup: (f) => send("signup", f),
    login: (f) => send("login", f),
    logout() {
      localStorage.removeItem(KEY);
      localStorage.removeItem(AR);
      location.reload();
    },
    token: () => localStorage.getItem(KEY),
    withToken,
    goAfter,
    mount,
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})();
