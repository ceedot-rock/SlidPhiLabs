/* Slid Phi Labs file drop — compress a file with the hosted PCC engine.
 * POSTs raw bytes to /api/compress, shows the result, offers download
 * and a byte-for-byte proof via /api/decompress. Free tier, no account.
 */
(function () {
  function fmtBytes(n) {
    if (n < 1024) return n + " B";
    if (n < 1048576) return (n / 1024).toFixed(1) + " KB";
    return (n / 1048576).toFixed(1) + " MB";
  }

  function init(root) {
    var zone = root.querySelector("[data-drop-zone]");
    var input = root.querySelector('input[type="file"]');
    var out = root.querySelector("[data-drop-out]");
    if (!zone || !input || !out) return;

    var originalBytes = null;
    var originalName = "";
    var packedB64 = "";

    function show(html) { out.innerHTML = html; out.hidden = false; }
    function busy(msg) { show('<p class="pf-drop-status">' + msg + "</p>"); }

    zone.addEventListener("click", function () { input.click(); });
    zone.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); }
    });
    ["dragover", "dragenter"].forEach(function (ev) {
      zone.addEventListener(ev, function (e) { e.preventDefault(); zone.classList.add("drag"); });
    });
    ["dragleave", "drop"].forEach(function (ev) {
      zone.addEventListener(ev, function (e) { e.preventDefault(); zone.classList.remove("drag"); });
    });
    zone.addEventListener("drop", function (e) {
      if (e.dataTransfer.files.length) handle(e.dataTransfer.files[0]);
    });
    input.addEventListener("change", function () {
      if (input.files.length) handle(input.files[0]);
    });

    function handle(file) {
      if (file.size > 25 * 1048576) {
        busy("That file is over 25 MB — the free drop caps there. The 24-hour try handles bigger files.");
        return;
      }
      originalName = file.name;
      busy("Shrinking <strong>" + escapeHtml(originalName) + "</strong> (" + fmtBytes(file.size) + ")…");
      var reader = new FileReader();
      reader.onload = function () {
        originalBytes = new Uint8Array(reader.result);
        fetch("/api/compress", {
          method: "POST",
          headers: { "Content-Type": "application/octet-stream" },
          body: originalBytes
        })
          .then(function (r) { return r.json(); })
          .then(renderResult)
          .catch(function () { busy("The compressor did not answer. Try again in a moment."); });
      };
      reader.readAsArrayBuffer(file);
    }

    function renderResult(j) {
      if (!j.ok) { busy("It refused that file: " + escapeHtml(j.error || "unknown reason") + "."); return; }
      packedB64 = j.packed_b64;
      var raw = j.raw_bytes, packed = j.packed_bytes;
      var pct = raw > 0 ? Math.round((1 - packed / raw) * 100) : 0;
      var line = pct > 0
        ? "<strong>" + fmtBytes(raw) + " → " + fmtBytes(packed) + "</strong> — " + pct + "% smaller."
        : "<strong>" + fmtBytes(raw) + " → " + fmtBytes(packed) + "</strong> — already tight, stored as-is.";
      show(
        '<p class="pf-drop-line">' + line + "</p>" +
        '<p class="pf-drop-note">' + escapeHtml(j.plain || "") + "</p>" +
        '<p class="pf-drop-actions">' +
        '<button type="button" class="pf-btn pf-btn-solid" data-dl>Download smaller file</button> ' +
        '<button type="button" class="pf-btn pf-btn-line" data-prove>Prove every byte</button>' +
        "</p>" +
        '<p class="pf-drop-upsell">Free drop. <a href="/box">24-hour full try</a> · <a href="/pricing">PCC $39/mo</a></p>'
      );
      out.querySelector("[data-dl]").addEventListener("click", download);
      out.querySelector("[data-prove]").addEventListener("click", prove);
    }

    function download() {
      var bin = Uint8Array.from(atob(packedB64), function (c) { return c.charCodeAt(0); });
      var blob = new Blob([bin], { type: "application/octet-stream" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = originalName + ".pcc";
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
    }

    function prove() {
      busy("Restoring and checking every byte…");
      fetch("/api/decompress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packed_b64: packedB64 })
      })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (!j.ok) { busy("Restore failed: " + escapeHtml(j.error || "unknown") + "."); return; }
          var back = Uint8Array.from(atob(j.raw_b64), function (c) { return c.charCodeAt(0); });
          var same = back.length === originalBytes.length &&
            back.every(function (b, i) { return b === originalBytes[i]; });
          show(same
            ? '<p class="pf-drop-line"><strong>Every byte back.</strong> ' + fmtBytes(back.length) + " restored, identical.</p>" +
              '<p class="pf-drop-actions"><button type="button" class="pf-btn pf-btn-solid" data-dl>Download smaller file</button></p>' +
              '<p class="pf-drop-upsell">Free drop. <a href="/box">24-hour full try</a> · <a href="/pricing">PCC $39/mo</a></p>'
            : '<p class="pf-drop-status">Mismatch on restore — tell Corey, that should never happen.</p>');
          var dl = out.querySelector("[data-dl]");
          if (dl) dl.addEventListener("click", download);
        })
        .catch(function () { busy("The restore did not answer. Try again in a moment."); });
    }

    function escapeHtml(s) {
      return String(s).replace(/[&<>"']/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
      });
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("[data-file-drop]").forEach(init);
  });
})();
