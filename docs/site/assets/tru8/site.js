/**
 * TRU8 site — interactions + public demo math (token paths only)
 */
(() => {
  "use strict";

  const T_ZERO = 0x00;
  const T_DICT = 0x01;
  const T_TRISUM_HOT = 0x10;
  const ALPHABET = " etaoinsrhldcumwfgypbvkjxqz.,!?\n";

  function charTo5(c) {
    const i = ALPHABET.indexOf(c);
    return i >= 0 ? i : 0;
  }

  function triToSum(tri) {
    const b = (tri + "   ").slice(0, 3);
    return (charTo5(b[0]) << 10) | (charTo5(b[1]) << 5) | charTo5(b[2]);
  }

  function packZeroRun(length) {
    const buf = new ArrayBuffer(8);
    const v = new DataView(buf);
    v.setUint8(0, T_ZERO);
    v.setUint32(1, length >>> 0, true);
    return new Uint8Array(buf);
  }

  function packDictPtr(dictId, offset) {
    const buf = new ArrayBuffer(8);
    const v = new DataView(buf);
    v.setUint8(0, T_DICT);
    v.setUint16(1, dictId & 0xffff, true);
    v.setUint32(3, offset >>> 0, true);
    return new Uint8Array(buf);
  }

  function toHex(u8) {
    return [...u8].map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  function fmt(n) {
    return new Intl.NumberFormat("en-US").format(n);
  }

  function fmtBytes(n) {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 2)} MB`;
    if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)} KB`;
    return `${n} B`;
  }

  /* Seamless plate: two buffers, 2.4s dissolve. Native loop snaps. */
  (function wireLogoPlate() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const root = document.querySelector(".logo-bg");
    const a = root && root.querySelector("video");
    if (!a) return;
    a.loop = false;
    a.classList.add("is-on");
    const b = a.cloneNode(true);
    b.removeAttribute("id");
    b.removeAttribute("autoplay");
    b.classList.add("is-off");
    b.muted = true;
    root.appendChild(b);
    const FADE = 2.4;
    let front = a;
    let back = b;
    let fading = false;
    function startFade() {
      if (fading) return;
      fading = true;
      try {
        back.currentTime = 0;
      } catch (_) {}
      const play = back.play();
      if (play && play.catch) play.catch(() => {});
      front.classList.remove("is-on");
      front.classList.add("is-off");
      back.classList.remove("is-off");
      back.classList.add("is-on");
      const retiring = front;
      front = back;
      back = retiring;
      window.setTimeout(() => {
        try {
          back.pause();
        } catch (_) {}
        fading = false;
      }, FADE * 1000 + 120);
    }
    function onTime(e) {
      const v = e.currentTarget;
      if (v !== front || fading) return;
      if (v.duration && v.currentTime >= v.duration - FADE) startFade();
    }
    [a, b].forEach((v) => {
      v.addEventListener("timeupdate", onTime);
      v.addEventListener("ended", () => {
        if (v === front) startFade();
      });
    });
  })();

  /* nav */
  const nav = document.querySelector(".site-nav");
  const toggle = document.querySelector(".nav-toggle");
  if (toggle && nav) {
    toggle.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    nav.querySelectorAll(".nav-links a").forEach((a) =>
      a.addEventListener("click", () => {
        nav.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      })
    );
  }
  const onScroll = () => {
    if (!nav) return;
    nav.classList.toggle("scrolled", window.scrollY > 8);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* reveal */
  const reveals = document.querySelectorAll(".reveal");
  if (reveals.length && "IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add("in"));
  }

  /* count-up metrics */
  function animateValue(el, end, opts = {}) {
    const dur = opts.duration || 1100;
    const prefix = opts.prefix || "";
    const suffix = opts.suffix || "";
    const decimals = opts.decimals || 0;
    const start = performance.now();
    const from = 0;
    function frame(t) {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = from + (end - from) * eased;
      el.textContent =
        prefix +
        (decimals
          ? v.toFixed(decimals)
          : fmt(Math.round(v))) +
        suffix;
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  document.querySelectorAll("[data-count]").forEach((el) => {
    const end = Number(el.getAttribute("data-count"));
    const suffix = el.getAttribute("data-suffix") || "";
    const decimals = Number(el.getAttribute("data-decimals") || 0);
    if (!Number.isFinite(end)) return;
    const run = () => animateValue(el, end, { suffix, decimals });
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            run();
            io.disconnect();
          }
        },
        { threshold: 0.4 }
      );
      io.observe(el);
    } else run();
  });

  /* live demo widgets */
  const zerosRange = document.getElementById("demoZerosN");
  const zerosOut = document.getElementById("demoZerosOut");
  const zerosMeta = document.getElementById("demoZerosMeta");
  const zerosHex = document.getElementById("demoZerosHex");
  const zerosBar = document.getElementById("demoZerosBar");

  function updateZeros() {
    if (!zerosRange || !zerosOut) return;
    const n = Number(zerosRange.value) || 1_000_000;
    const packed = packZeroRun(n);
    const ratio = n / packed.length;
    zerosOut.innerHTML = `<span class="arrow">→</span>${packed.length}&nbsp;B`;
    if (zerosMeta) {
      zerosMeta.innerHTML = `raw ${fmtBytes(n)} · ratio <strong style="color:var(--teal)">${fmt(Math.round(ratio))}×</strong> · token T_ZERO`;
    }
    if (zerosHex) zerosHex.textContent = toHex(packed);
    if (zerosBar) {
      const pct = Math.min(100, (packed.length / Math.max(n, 1)) * 100 * 8000);
      zerosBar.style.width = `${Math.max(0.4, pct)}%`;
    }
    const label = document.getElementById("demoZerosLabel");
    if (label) label.textContent = fmt(n) + " zeros";
  }
  if (zerosRange) {
    zerosRange.addEventListener("input", updateZeros);
    updateZeros();
  }

  const triWord = document.getElementById("demoTriWord");
  const triCount = document.getElementById("demoTriCount");
  const triOut = document.getElementById("demoTriOut");
  const triMeta = document.getElementById("demoTriMeta");

  function updateTri() {
    if (!triOut) return;
    const word = ((triWord && triWord.value) || "the").slice(0, 3).toLowerCase();
    const count = Number((triCount && triCount.value) || 1000);
    const raw = word.length * count;
    const s = triToSum(word);
    const tru8 = 2 + count;
    const save = (1 - tru8 / raw) * 100;
    triOut.innerHTML = `<span class="arrow">→</span>${tru8}&nbsp;B`;
    if (triMeta) {
      triMeta.innerHTML = `"${word}" × ${fmt(count)} · raw ${fmt(raw)} B · sum <strong style="color:var(--teal)">0x${s.toString(16).padStart(4, "0")}</strong> · save <strong style="color:var(--teal)">${save.toFixed(1)}%</strong>`;
    }
  }
  if (triWord) triWord.addEventListener("input", updateTri);
  if (triCount) triCount.addEventListener("input", updateTri);
  if (triOut) updateTri();

  const dictHits = document.getElementById("demoDictHits");
  const dictOut = document.getElementById("demoDictOut");
  const dictMeta = document.getElementById("demoDictMeta");
  const dictBar = document.getElementById("demoDictBar");

  function updateDict() {
    if (!dictOut) return;
    const hits = Number((dictHits && dictHits.value) || 100);
    const raw = 1024 * hits;
    const one = packDictPtr(0, 0);
    const tru8 = one.length * hits;
    const ratio = raw / tru8;
    dictOut.innerHTML = `<span class="arrow">→</span>${fmt(tru8)}&nbsp;B`;
    if (dictMeta) {
      dictMeta.innerHTML = `${fmt(hits)} × 1 KB · raw ${fmtBytes(raw)} · ratio <strong style="color:var(--teal)">${ratio.toFixed(0)}×</strong> · T_DICT`;
    }
    if (dictBar) dictBar.style.width = `${Math.max(0.5, (tru8 / raw) * 100 * 50)}%`;
  }
  if (dictHits) {
    dictHits.addEventListener("input", updateDict);
    updateDict();
  }

  /* smooth magnetic buttons (subtle) */
  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    document.querySelectorAll(".btn-primary, .btn-teal").forEach((btn) => {
      btn.addEventListener("pointermove", (e) => {
        const r = btn.getBoundingClientRect();
        const x = e.clientX - r.left - r.width / 2;
        const y = e.clientY - r.top - r.height / 2;
        btn.style.transform = `translate(${x * 0.06}px, ${y * 0.08}px)`;
      });
      btn.addEventListener("pointerleave", () => {
        btn.style.transform = "";
      });
    });
  }

  /* expose for console play */
  window.TRU8 = {
    packZeroRun,
    packDictPtr,
    triToSum,
    T_ZERO,
    T_DICT,
    T_TRISUM_HOT,
    toHex,
  };
})();
