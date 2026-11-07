/* TRU8 voice Talk — classic script, sets window.Tru8Voice and self-mounts.
 * Join flow: GET /api/livekit-token (status) -> POST (token) -> livekit-client
 * from pinned CDN -> room "tru8-guide" with mic. Until LiveKit is claimed the
 * button reports the honest stub state instead of failing silently.
 * No keys in this file; the token endpoint owns credentials server-side.
 */
(function () {
  if (window.Tru8Voice) return;

  var TOKEN_URL = "/api/livekit-token";
  var ROOM = "tru8-guide";
  var LK_CLIENT = "https://cdn.jsdelivr.net/npm/livekit-client@2.9.4/dist/livekit-client.esm.min.js";

  var state = "boot"; // boot | live | down | talk
  var room = null;
  var liveKnown = null;
  var btn = null;
  var statusEl = null;

  function say(msg) {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.classList.add("show");
    clearTimeout(say._t);
    say._t = setTimeout(function () {
      statusEl.classList.remove("show");
    }, 6000);
  }

  function paint() {
    if (!btn) return;
    btn.dataset.state = state === "talk" ? "talk" : liveKnown === false ? "down" : "live";
    var label = btn.querySelector("[data-label]");
    if (!label) return;
    if (state === "talk") label.textContent = "Talking — tap to hang up";
    else if (liveKnown === false) label.textContent = "Voice offline";
    else label.textContent = "Talk to the guide";
  }

  async function probe() {
    try {
      const r = await fetch(TOKEN_URL, { method: "GET" });
      const d = await r.json();
      liveKnown = r.ok && d && d.status === "live";
    } catch {
      liveKnown = false;
    }
    paint();
  }

  async function leave() {
    try {
      if (room) await room.disconnect();
    } catch {
      /* ignore */
    }
    room = null;
    state = "boot";
    paint();
    say("Call ended.");
  }

  async function join() {
    if (state === "talk") return leave();
    if (liveKnown === false) {
      say("Voice is not claimed yet — the lab is activating LiveKit. Text guide still works.");
      return;
    }
    state = "talk";
    paint();
    say("Joining the voice room…");
    try {
      const tr = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room: ROOM }),
      });
      const td = await tr.json().catch(() => ({}));
      if (!tr.ok || !td.ok || !td.token) {
        throw new Error(td.error === "livekit_unconfigured" ? "unconfigured" : "token failed");
      }
      const lk = await import(/* webpackIgnore: true */ LK_CLIENT);
      const R = new lk.Room({ adaptiveStream: true, dynacast: true });
      R.on(lk.RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === lk.Track.Kind.Audio) {
          const el = track.attach();
          el.style.display = "none";
          document.body.appendChild(el);
        }
      });
      R.on(lk.RoomEvent.Disconnected, () => {
        room = null;
        state = "boot";
        paint();
      });
      await R.connect(td.url, td.token);
      await R.localParticipant.setMicrophoneEnabled(true);
      room = R;
      paint();
      say("You are live with the TRU8 guide. Speak your dataset.");
    } catch (e) {
      state = "boot";
      if (String((e && e.message) || e) === "unconfigured") liveKnown = false;
      paint();
      say("Could not join voice. Text guide still works.");
    }
  }

  function mount() {
    if (document.getElementById("tru8VoiceBtn")) return;
    statusEl = document.createElement("div");
    statusEl.id = "tru8VoiceStatus";
    statusEl.setAttribute("role", "status");
    document.body.appendChild(statusEl);
    btn = document.createElement("button");
    btn.id = "tru8VoiceBtn";
    btn.type = "button";
    btn.setAttribute("aria-label", "Talk to the TRU8 voice guide");
    btn.innerHTML = '<span class="dot"></span><span data-label>Talk to the guide</span>';
    btn.addEventListener("click", join);
    document.body.appendChild(btn);
    paint();
    probe();
  }

  window.Tru8Voice = { startTalk: join, leave, probe };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
