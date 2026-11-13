"use strict";
/* SlidPhiFloor PWA: chat + voice + actions + notes over the floor server API. */
const $ = (id) => document.getElementById(id);
const msgs = $("msgs"), seatSel = $("seat"), input = $("in"), statusEl = $("status");
let speakOn = false;

const store = {
  get token() { return localStorage.getItem("floor_token") || ""; },
  set token(v) {
    if (v) localStorage.setItem("floor_token", v);
    else localStorage.removeItem("floor_token");
  },
};

async function api(path, body, timeoutMs) {
  const ctrl = new AbortController();
  const timer = timeoutMs ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
  let res;
  try {
    res = await fetch(path, {
      method: body === undefined ? "GET" : "POST",
      headers: { "Content-Type": "application/json", "X-Floor-Token": store.token },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctrl.signal,
    });
  } catch (e) {
    throw new Error(e.name === "AbortError"
      ? "taking too long — the floor may be waking up; wait a minute and resend"
      : "network failed: " + e.message);
  } finally {
    if (timer) clearTimeout(timer);
  }
  if (res.status === 401) { askToken(); throw new Error("bad token"); }
  return res.json();
}

function say(who, text, me) {
  const li = document.createElement("li");
  if (me) li.className = "me";
  const w = document.createElement("div");
  w.className = "who"; w.textContent = who;
  li.append(w, document.createTextNode(text));
  msgs.append(li);
  li.scrollIntoView({ block: "nearest" });
  if (!me && speakOn && "speechSynthesis" in window) {
    speechSynthesis.cancel();
    speechSynthesis.speak(new SpeechSynthesisUtterance(text.slice(0, 400)));
  }
}

function setStatus(t) { statusEl.textContent = t; }

async function send() {
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  say("you→@" + seatSel.value, text, true);
  setStatus("@" + seatSel.value + " thinking…");
  try {
    const out = await api("/api/chat", { seat: seatSel.value, message: text }, 300000);
    setStatus("");
    say("@" + seatSel.value, out.reply || out.error);
  } catch (e) { setStatus("send failed: " + e.message); }
}

function askToken() {
  const dlg = $("tokenDlg");
  if (typeof dlg.showModal === "function") dlg.showModal();
}
$("tokenDlg").addEventListener("close", () => {
  if ($("tokenDlg").returnValue === "save" && $("tokenIn").value.trim()) {
    store.token = $("tokenIn").value.trim();
    $("tokenIn").value = "";
    boot();
  }
  $("tokenDlg").returnValue = "";
});

async function boot() {
  if (!store.token) { askToken(); return; }
  try {
    const seats = await api("/api/seats");
    seatSel.innerHTML = "";
    for (const [id, line] of Object.entries(seats)) {
      const o = document.createElement("option");
      o.value = id; o.textContent = "@" + id;
      o.title = line;
      seatSel.append(o);
    }
    const motions = await api("/api/motions");
    $("motions").textContent = motions.length
      ? motions.length + " motion(s): " + motions.map((m) => m.title).join(" · ")
      : "Quiet floor — no open motions.";
    buildActions();
  } catch (e) { setStatus("connect failed: " + e.message); }
}

const PALETTES = {
  adswarm: ["review", "critic", "approve", "schedule", "publish", "ledger", "seat", "recall"],
  advisor: ["triage", "advise", "deploy", "ledger", "seat", "recall"],
  autopilot: ["sweep", "ledger", "seat", "recall"],
  board: ["readout", "record", "ledger", "seat", "recall"],
  compression: ["status", "verify", "price-check", "ledger", "seat", "recall"],
  teachaid: ["status", "verify", "audit", "deploy", "ledger", "seat", "recall"],
  "github-webdev": ["triage", "review", "draft", "approve", "merge", "ledger", "seat", "recall"],
  "github-engineer": ["triage", "review", "draft", "approve", "merge", "ledger", "seat", "recall"],
  "slidphi-agent": ["feedback", "seat", "recall"],
  "law-scholar": ["status", "lookup", "brief", "review", "ledger", "seat", "recall"],
  "biz-scholar": ["status", "lookup", "brief", "review", "ledger", "seat", "recall"],
};
const DESTRUCTIVE = new Set(["approve", "merge", "deploy", "publish", "draft", "sweep"]);

function buildActions() {
  const nav = $("actions");
  nav.innerHTML = "";
  for (const cmd of PALETTES[seatSel.value] || []) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "ghost"; b.textContent = cmd;
    b.addEventListener("click", () => runAction(cmd));
    nav.append(b);
  }
}
seatSel.addEventListener("change", () => {
  input.placeholder = "Talk to @" + seatSel.value + "…";
  buildActions();
});

async function runAction(cmd, ticket) {
  const seat = seatSel.value;
  const extra = cmd === "feedback" ? ["request", "from the floor"] : [];
  if (!ticket && DESTRUCTIVE.has(cmd)) {
    $("confirm-preview").textContent = "@" + seat + " " + cmd + " " + extra.join(" ");
    const dlg = $("confirm");
    dlg.showModal();
    const choice = await new Promise((res) => {
      dlg.addEventListener("close", () => { const v = dlg.returnValue; dlg.returnValue = ""; res(v); }, { once: true });
    });
    if (choice !== "yes") return;
  }
  setStatus("@" + seat + " " + cmd + "…");
  try {
    let out = ticket
      ? await api("/api/act/confirm", { ticket })
      : await api("/api/act", { seat, cmd, args: extra });
    if (out.need_confirm) { await runAction(cmd, out.ticket); return; }
    setStatus("");
    const li = document.createElement("li");
    const w = document.createElement("div");
    w.className = "who"; w.textContent = "@" + seat + " ⚙ " + cmd;
    const pre = document.createElement("pre");
    pre.textContent = out.ok === false ? ("FAILED: " + (out.output || out.error)) : (out.output || "done");
    li.append(w, pre);
    msgs.append(li);
    li.scrollIntoView({ block: "nearest" });
  } catch (e) { setStatus("action failed: " + e.message); }
}

$("send").addEventListener("click", send);
input.addEventListener("keydown", (e) => { if (e.key === "Enter") send(); });
$("actBtn").addEventListener("click", () => { $("actions").hidden = !$("actions").hidden; });
$("noteBtn").addEventListener("click", async () => {
  const t = prompt("Note for the lab log:");
  if (!t) return;
  try { await api("/api/notes", { text: t }); say("notes", "saved"); }
  catch (e) { say("notes", "save failed and is NOT stored: " + e.message); }
});

/* Voice input: mic button uses on-device recognition; replies speak when toggled. */
$("mic").addEventListener("click", () => {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { setStatus("voice input not supported in this browser"); return; }
  if (!("speechSynthesis" in window)) { setStatus("voice output not supported in this browser"); return; }
  speakOn = !speakOn;
  $("mic").textContent = speakOn ? "🛑" : "🎙";
  if (!speakOn) { speechSynthesis.cancel(); setStatus("voice off"); return; }
  const rec = new SR();
  rec.lang = "en-US";
  rec.onresult = (e) => {
    input.value = e.results[0][0].transcript;
    setStatus("");
    send();
  };
  rec.onerror = (e) => setStatus("mic error: " + e.error);
  setStatus("listening…");
  rec.start();
});

/* Install: Web Install API when present, classic prompt as fallback. */
(function install() {
  const btn = $("installBtn");
  let deferred = null;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e;
    btn.hidden = false;
  });
  btn.addEventListener("click", async () => {
    try {
      if (typeof navigator.install === "function") { await navigator.install(); return; }
    } catch (e) { /* fall through to classic prompt */ }
    if (deferred) { deferred.prompt(); deferred = null; btn.hidden = true; }
  });
})();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}
boot();
