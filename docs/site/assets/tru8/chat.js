/**
 * TRU8 AI guide widget — talks to POST /api/tru8-chat (SpaceXAI / xAI)
 */
(() => {
  "use strict";

  const HISTORY_KEY = "tru8_chat_hist_v1";
  let history = [];
  try {
    history = JSON.parse(sessionStorage.getItem(HISTORY_KEY) || "[]");
    if (!Array.isArray(history)) history = [];
  } catch {
    history = [];
  }

  const root = document.createElement("div");
  root.className = "tru8-chat-root";
  root.innerHTML = `
    <div class="tru8-chat-panel" role="dialog" aria-label="TRU8 AI guide" aria-modal="false">
      <div class="tru8-chat-head">
        <div>
          <h2>TRU<span>8</span> guide</h2>
          <p>SpaceXAI · public product facts only</p>
        </div>
        <button type="button" class="tru8-chat-close" aria-label="Close">×</button>
      </div>
      <div class="tru8-chat-msgs" id="tru8ChatMsgs"></div>
      <div class="tru8-chat-chips" id="tru8ChatChips"></div>
      <form class="tru8-chat-form" id="tru8ChatForm">
        <input id="tru8ChatInput" type="text" maxlength="1200" placeholder="Ask about TRU8…" autocomplete="off" />
        <button type="submit" id="tru8ChatSend">Send</button>
      </form>
    </div>
    <button type="button" class="tru8-chat-fab" id="tru8ChatFab" aria-expanded="false">
      <span class="dot" aria-hidden="true"></span>
      Ask TRU8
    </button>
  `;
  document.body.appendChild(root);

  const msgs = root.querySelector("#tru8ChatMsgs");
  const form = root.querySelector("#tru8ChatForm");
  const input = root.querySelector("#tru8ChatInput");
  const sendBtn = root.querySelector("#tru8ChatSend");
  const fab = root.querySelector("#tru8ChatFab");
  const closeBtn = root.querySelector(".tru8-chat-close");
  const chips = root.querySelector("#tru8ChatChips");

  function addMsg(role, text, extraClass) {
    const el = document.createElement("div");
    el.className = `tru8-msg ${role}${extraClass ? " " + extraClass : ""}`;
    el.textContent = text;
    msgs.appendChild(el);
    msgs.scrollTop = msgs.scrollHeight;
    return el;
  }

  function greet() {
    if (msgs.children.length) return;
    addMsg(
      "bot",
      "TRU8 · Less is more. Ask about tokens (T_ZERO, T_DICT, T_TRISUM_HOT), demos, credit, or commercial license."
    );
  }

  function open() {
    root.classList.add("open");
    fab.setAttribute("aria-expanded", "true");
    greet();
    setTimeout(() => input.focus(), 50);
  }
  function close() {
    root.classList.remove("open");
    fab.setAttribute("aria-expanded", "false");
  }

  fab.addEventListener("click", () => {
    if (root.classList.contains("open")) close();
    else open();
  });
  closeBtn.addEventListener("click", close);

  const SUGGEST = [
    "What is T_ZERO?",
    "How does the 8 B zeros demo work?",
    "Public vs commercial license?",
    "Where is the GitHub demo?",
  ];
  SUGGEST.forEach((s) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "tru8-chip";
    b.textContent = s;
    b.addEventListener("click", () => {
      input.value = s;
      form.requestSubmit();
    });
    chips.appendChild(b);
  });

  async function ask(message) {
    addMsg("user", message);
    history.push({ role: "user", content: message });
    history = history.slice(-8);
    const typing = addMsg("bot", "…", "typing");
    sendBtn.disabled = true;
    try {
      const r = await fetch("/api/tru8-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          history: history.slice(0, -1),
        }),
      });
      const data = await r.json().catch(() => ({}));
      typing.remove();
      if (!r.ok || !data.ok) {
        const err =
          data.error === "rate_limited"
            ? "Rate limit — try again in a minute."
            : data.error === "xai_unconfigured"
              ? "AI guide offline (XAI_API_KEY not configured)."
              : "Could not reach the guide. Try again.";
        addMsg("bot", err, "error");
        return;
      }
      addMsg("bot", data.reply);
      history.push({ role: "assistant", content: data.reply });
      history = history.slice(-8);
      try {
        sessionStorage.setItem(HISTORY_KEY, JSON.stringify(history));
      } catch {
        /* ignore */
      }
    } catch {
      typing.remove();
      addMsg("bot", "Network error. Try again.", "error");
    } finally {
      sendBtn.disabled = false;
      input.focus();
    }
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const message = input.value.trim();
    if (!message || sendBtn.disabled) return;
    input.value = "";
    ask(message);
  });
})();
