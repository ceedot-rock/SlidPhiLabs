/** One lab session for every Slid Phi product. Token rides in #spl= across origins. */
(function () {
  var AUTH = "https://www.slidphilabs.com/api/auth";
  var HOME = "https://www.slidphilabs.com";
  var KEY = "spl_lab_token";
  var AR = "spl_ar_key";

  function capture() {
    var u = new URL(location.href);
    var t = u.searchParams.get("spl") || "";
    if (location.hash.indexOf("spl=") === 1) {
      t = decodeURIComponent(location.hash.slice(5).split("&")[0]);
    }
    if (!t) return;
    localStorage.setItem(KEY, t);
    u.searchParams.delete("spl");
    var clean = u.pathname + (u.searchParams.toString() ? "?" + u.searchParams.toString() : "");
    history.replaceState({}, "", clean);
  }

  function withToken(href, token) {
    if (!href || !token) return href;
    try {
      var u = new URL(href, location.href);
      if (u.origin === location.origin && u.hostname === location.hostname) return u.href;
      u.hash = "spl=" + encodeURIComponent(token);
      return u.toString();
    } catch (e) {
      return href;
    }
  }

  function me() {
    var t = localStorage.getItem(KEY);
    if (!t) return Promise.resolve(null);
    return fetch(AUTH, { headers: { Authorization: "Bearer " + t } })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j.ok) {
          localStorage.removeItem(KEY);
          return null;
        }
        return j.user;
      })
      .catch(function () { return null; });
  }

  function send(action, fields) {
    var headers = { "Content-Type": "application/json" };
    var tok = localStorage.getItem(KEY);
    if (tok) headers.Authorization = "Bearer " + tok;
    var body = { action: action };
    for (var k in fields) body[k] = fields[k];
    return fetch(AUTH, { method: "POST", headers: headers, body: JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return {}; }); })
      .then(function (j) {
        if (j.token) localStorage.setItem(KEY, j.token);
        return j;
      });
  }

  function b64url(buf) {
    var b = buf instanceof ArrayBuffer ? new Uint8Array(buf) : buf;
    var s = btoa(String.fromCharCode.apply(null, b));
    return s.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  }

  function unb64(s) {
    var pad = s.replace(/-/g, "+").replace(/_/g, "/");
    var bin = atob(pad);
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out.buffer;
  }

  function passkeyRegister() {
    return send("passkey_register_begin", {}).then(function (begin) {
      if (!begin.ok) return begin;
      var opt = begin.publicKey;
      var challenge = opt.challenge;
      opt.challenge = unb64(opt.challenge);
      opt.user.id = unb64(opt.user.id);
      return navigator.credentials.create({ publicKey: opt }).then(function (cred) {
        var att = cred.response;
        var done = function (pub) {
          return send("passkey_register_finish", {
            challenge: challenge,
            credential: { id: cred.id, clientDataJSON: b64url(att.clientDataJSON), publicKey: pub }
          });
        };
        if (att.getPublicKey) return att.getPublicKey().then(function (p) { return done(b64url(p)); });
        return done("");
      });
    });
  }

  function passkeyLogin(email) {
    return send("passkey_login_begin", { email: email || "" }).then(function (begin) {
      if (!begin.ok) return begin;
      var opt = begin.publicKey;
      var challenge = opt.challenge;
      opt.challenge = unb64(opt.challenge);
      if (opt.allowCredentials) {
        opt.allowCredentials = opt.allowCredentials.map(function (c) {
          return { type: "public-key", id: unb64(c.id) };
        });
      }
      return navigator.credentials.get({ publicKey: opt }).then(function (cred) {
        var asrt = cred.response;
        return send("passkey_login_finish", {
          challenge: challenge,
          credential: {
            id: cred.id,
            clientDataJSON: b64url(asrt.clientDataJSON),
            authenticatorData: b64url(asrt.authenticatorData),
            signature: b64url(asrt.signature)
          }
        });
      });
    });
  }

  function goAfter(token) {
    var n = new URLSearchParams(location.search).get("next") || HOME + "/account";
    location.href = withToken(n, token);
  }

  function paint(el, user) {
    if (!el) return;
    var next = encodeURIComponent(location.href.split("#")[0]);
    var tok = localStorage.getItem(KEY);
    if (user) {
      var acc = withToken(HOME + "/account", tok);
      var name = String(user.name || user.email).replace(/[<>]/g, "");
      el.innerHTML = '<a href="' + acc + '">' + name +
        '</a> &middot; <button type="button" data-spl-logout>Log out</button>';
      var btn = el.querySelector("[data-spl-logout]");
      if (btn) btn.addEventListener("click", function () {
        localStorage.removeItem(KEY);
        localStorage.removeItem(AR);
        location.reload();
      });
    } else {
      el.innerHTML = '<a href="' + HOME + "/signup?next=" + next + '">Sign up</a> &middot; <a href="' +
        HOME + "/login?next=" + next + '">Log in</a>';
    }
  }

  function mount() {
    capture();
    return me().then(function (user) {
      var els = document.querySelectorAll("[data-spl-auth]");
      for (var i = 0; i < els.length; i++) paint(els[i], user);
      return user;
    });
  }

  window.SPLAuth = {
    me: me,
    signup: function (f) { return send("signup", f); },
    login: function (f) { return send("login", f); },
    logout: function () {
      localStorage.removeItem(KEY);
      localStorage.removeItem(AR);
      location.reload();
    },
    token: function () { return localStorage.getItem(KEY); },
    withToken: withToken,
    goAfter: goAfter,
    passkeyRegister: passkeyRegister,
    passkeyLogin: passkeyLogin,
    mount: mount
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})();
