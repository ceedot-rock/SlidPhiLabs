/** One lab session for every Slid Phi product. */
(function () {
  const AUTH = "https://www.slidphilabs.com/api/auth";
  const HOME = "https://www.slidphilabs.com";
  const KEY = "spl_lab_token";

  async function me() {
    const t = localStorage.getItem(KEY);
    if (!t) return null;
    try {
      const r = await fetch(AUTH, { headers: { Authorization: "Bearer " + t } });
      const j = await r.json();
      return j.ok ? j.user : null;
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

  function paint(el, user) {
    if (!el) return;
    const next = encodeURIComponent(location.href);
    if (user) {
      el.innerHTML =
        '<a href="' +
        HOME +
        '/account">' +
        (user.name || user.email).replace(/[<>]/g, "") +
        "</a>";
    } else {
      el.innerHTML =
        '<a href="' + HOME + "/signup?next=" + next + '">Sign up</a>';
    }
  }

  async function mount() {
    const user = await me();
    document.querySelectorAll("[data-spl-auth]").forEach((el) => paint(el, user));
    return user;
  }

  window.SPLAuth = {
    me,
    signup: (f) => send("signup", f),
    login: (f) => send("login", f),
    logout() {
      localStorage.removeItem(KEY);
      location.reload();
    },
    token: () => localStorage.getItem(KEY),
    mount,
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})();
