(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const root = document.documentElement;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const small = innerWidth < 700;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (isIOS) root.classList.add("ios");
  const fx = (el, css) => Object.assign(el.style, css);

  addEventListener("unhandledrejection", e => e.preventDefault());
  addEventListener("error", e => { if (/audio|play/i.test(e.message || "")) e.preventDefault(); });
  $("#year").textContent = new Date().getFullYear();

  /* ================= toast & copy ================= */
  const toast = $("#toast");
  let tt;
  const say = msg => {
    toast.textContent = msg; toast.classList.add("show");
    clearTimeout(tt); tt = setTimeout(() => toast.classList.remove("show"), 1700);
  };
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return; } catch {}
    try {
      const ta = document.createElement("textarea");
      ta.value = text; ta.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove();
    } catch {}
  }
  const flash = btn => { btn.classList.add("copied"); setTimeout(() => btn.classList.remove("copied"), 1100); };
  $("#copyNick").addEventListener("click", async e => {
    const b = e.currentTarget; await copyText("morphygram"); flash(b); say("Ник скопирован: morphygram");
  });
  $$("[data-copy]").forEach(b => b.addEventListener("click", async () => {
    await copyText(b.dataset.copy); flash(b); say("Скопировано: " + b.dataset.copy);
  }));
  $("#shareBtn").addEventListener("click", async e => {
    const b = e.currentTarget;
    if (navigator.share) { try { await navigator.share({ title: "MorphyGram", url: location.href }); } catch {} return; }
    await copyText(location.href); flash(b); say("Ссылка скопирована");
  });

  /* ================= fx menu ================= */
  const fxOpen = $("#fxOpen"), fxPanel = $("#fxPanel");
  fxOpen.addEventListener("click", () => {
    const open = fxPanel.hidden;
    fxPanel.hidden = !open;
    fxOpen.setAttribute("aria-expanded", String(open));
  });
  document.addEventListener("pointerdown", e => {
    if (!fxPanel.hidden && !e.target.closest(".fx-menu")) { fxPanel.hidden = true; fxOpen.setAttribute("aria-expanded", "false"); }
  });
  function setTheme(name) {
    if (name === "red") root.removeAttribute("data-theme"); else root.setAttribute("data-theme", name);
    $$(".sw").forEach(s => s.classList.toggle("on", s.dataset.theme === name));
    refreshRGB();
  }
  $$(".sw").forEach(s => s.addEventListener("click", () => setTheme(s.dataset.theme)));

  const scanBtn = $("#scanBtn"), rainBtn = $("#rainBtn"), calmBtn = $("#calmBtn");
  scanBtn.addEventListener("click", () => toggleItem(scanBtn, "scan"));
  calmBtn.addEventListener("click", () => toggleItem(calmBtn, "calm"));
  function toggleItem(btn, cls) {
    const on = document.body.classList.toggle(cls);
    btn.setAttribute("aria-pressed", String(on));
  }

  /* ================= rain (transparent trails, visible) ================= */
  const rc = $("#rain"), rctx = rc.getContext("2d");
  const GLYPHS = "01<>/#$%&*+=?✳";
  let rainOn = false, rainTimer = 0, cols = [], rainStepSize = 14;
  function rainSize() {
    const s = small ? 1 : 1;
    rc.width = Math.ceil(innerWidth * s); rc.height = Math.ceil(innerHeight * s);
    cols = Array.from({ length: Math.ceil(rc.width / rainStepSize) }, () => Math.floor(Math.random() * rc.height / rainStepSize));
  }
  function rainStep() {
    rctx.globalCompositeOperation = "destination-out";
    rctx.fillStyle = "rgba(0,0,0,.16)";
    rctx.fillRect(0, 0, rc.width, rc.height);
    rctx.globalCompositeOperation = "source-over";
    rctx.font = `${rainStepSize - 2}px IBM Plex Mono, monospace`;
    rctx.fillStyle = `rgba(${rgb},.9)`;
    for (let i = 0; i < cols.length; i++) {
      const y = cols[i] * rainStepSize;
      rctx.fillText(GLYPHS[(Math.random() * GLYPHS.length) | 0], i * rainStepSize, y);
      cols[i] = y > rc.height && Math.random() > .975 ? 0 : cols[i] + 1;
    }
  }
  rainBtn.addEventListener("click", () => {
    rainOn = !rainOn;
    document.body.classList.toggle("rain", rainOn);
    rainBtn.setAttribute("aria-pressed", String(rainOn));
    clearInterval(rainTimer);
    if (rainOn) { rainSize(); rctx.clearRect(0, 0, rc.width, rc.height); if (!reduce) rainTimer = setInterval(rainStep, 70); }
  });

  /* ================= stack: python 83%, others random below ================= */
  const skillEls = $$(".skill");
  skillEls.forEach(el => {
    const fixed = el.dataset.fixed;
    const lvl = fixed ? +fixed : Math.floor(52 + Math.random() * 27); // 52..78, always < 83
    el.querySelector(".meter i").dataset.level = lvl;
    el.querySelector("em").textContent = lvl;
  });

  /* ================= live clock ================= */
  const clockEl = $("#clock");
  const pad = n => String(n).padStart(2, "0");
  const tickClock = () => { const d = new Date(); clockEl.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; };
  tickClock(); setInterval(tickClock, 1000);

  /* ================= boot ================= */
  const boot = $("#boot"), bootCode = $("#bootCode"), bootBar = $("#bootBar");
  const lines = [
    [["k", "const "], ["", "morphygram = {"]],
    [["", "  "], ["s", "\"role\""], ["", ": "], ["s", "\"developer\""], ["", ","]],
    [["", "  "], ["s", "\"web\""], ["", ": "], ["k", "true"], ["", ","]],
    [["", "  "], ["s", "\"telegram\""], ["", ": "], ["s", "\"morphygram\""], ["", ","]],
    [["", "  "], ["s", "\"mood\""], ["", ": "], ["s", "\"chaos\""]],
    [["", "};"]],
    [["c", "// hello, traveler 🖤"]],
  ];
  const total = lines.reduce((a, l) => a + l.reduce((b, [, t]) => b + t.length, 0), 0) + lines.length;
  let li = 0, ci = 0, booted = false, bootTimer, written = 0;
  function endBoot() {
    if (booted) return; booted = true;
    clearTimeout(bootTimer);
    boot.classList.add("done");
    root.classList.remove("booting");
    setTimeout(() => boot.remove(), 650);
    afterBoot();
  }
  function typeBoot() {
    if (booted) return;
    if (li >= lines.length) { bootTimer = setTimeout(endBoot, 380); return; }
    const flat = lines[li].flatMap(([c, t]) => [...t].map(ch => [c, ch]));
    if (ci === 0 && li > 0) bootCode.append("\n");
    if (ci < flat.length) {
      const [c, ch] = flat[ci];
      const s = document.createElement("span");
      if (c) s.className = c;
      s.textContent = ch; bootCode.append(s); ci++; written++;
      bootBar.style.width = (written / total * 100) + "%";
      bootTimer = setTimeout(typeBoot, 22 + Math.random() * 22);
    } else { li++; ci = 0; written++; bootTimer = setTimeout(typeBoot, 100); }
  }
  boot.addEventListener("click", endBoot);
  if (reduce || location.hash) endBoot(); else { typeBoot(); setTimeout(endBoot, 4300); }

  /* ================= handle letters ================= */
  const handle = $("#handle");
  const hText = handle.textContent;
  handle.innerHTML = [...hText].map((c, i) => `<span class="ch" style="--i:${i}"><b>${c === "_" ? '<span class="red blink">_</span>' : c}</b></span>`).join("");

  /* ================= after boot ================= */
  let ran = false;
  function afterBoot() {
    if (ran) return; ran = true;
    root.classList.add("ready");
    $$(".fx").forEach((el, i) => setTimeout(() => el.classList.add("in"), reduce ? 0 : i * 60));
    const text = "MorphyGram — веб-клиент Telegram. Удалённые и изменённые сообщения, одноразовые медиа, установка на экран телефона в один клик.";
    const bio = $("#bioText");
    if (reduce) bio.textContent = text;
    else {
      let i = 0;
      const t = setInterval(() => { bio.textContent = text.slice(0, ++i); if (i >= text.length) clearInterval(t); }, 30);
    }
    $$(".stat b").forEach(b => {
      const target = +b.dataset.count;
      if (reduce) { b.textContent = target; return; }
      const t0 = performance.now();
      const step = now => {
        const p = Math.min(1, (now - t0) / 1100), e = 1 - Math.pow(1 - p, 3);
        b.textContent = Math.round(target * e);
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }
  setTimeout(() => { if (!ran) endBoot(); }, 6500);

  /* ================= reveal on scroll (one observer) ================= */
  const io = new IntersectionObserver(entries => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add("in");
      $$(".meter i, .progress i", e.target).forEach(i => i.style.width = i.dataset.level + "%");
      io.unobserve(e.target);
    }
  }, { threshold: .12 });
  $$(".reveal, .block").forEach(el => io.observe(el));

  /* ================= status cycling ================= */
  const statuses = ["готов к входу", "ловлю удалённые", "сохраняю правки", "держу сессию в RAM"];
  const statusEl = $("#statusText"), statusNum = $("#statusNum");
  let si = 0;
  if (!reduce) setInterval(() => {
    statusEl.classList.add("swap");
    setTimeout(() => {
      si = (si + 1) % statuses.length;
      statusEl.textContent = statuses[si];
      statusNum.textContent = "↗ 0" + (si + 1);
      statusEl.classList.remove("swap");
    }, 240);
  }, 3600);

  /* ================= click effect: bloom + sparks ================= */
  const clickLayer = $("#clickLayer");
  function bloomAt(x, y, strong = false) {
    if (reduce) return;
    const bloom = document.createElement("span");
    bloom.className = "bloom";
    bloom.style.left = x + "px"; bloom.style.top = y + "px";
    clickLayer.appendChild(bloom);
    bloom.animate([
      { transform: "scale(.2)", opacity: .9 },
      { transform: `scale(${strong ? 2.4 : 1.7})`, opacity: 0 },
    ], { duration: 650, easing: "cubic-bezier(.2,.8,.2,1)" }).onfinish = () => bloom.remove();

    const n = small ? 4 : 6;
    for (let i = 0; i < n; i++) {
      const s = document.createElement("span");
      s.className = "spark";
      s.textContent = i % 2 ? "✳" : "+";
      s.style.left = x + "px"; s.style.top = y + "px";
      clickLayer.appendChild(s);
      const a = (Math.PI * 2 / n) * i + Math.random() * .4;
      const d = 34 + Math.random() * 30;
      s.animate([
        { transform: "translate(0,0) rotate(0deg) scale(1)", opacity: 1 },
        { transform: `translate(${Math.cos(a) * d}px,${Math.sin(a) * d}px) rotate(${120 + Math.random() * 120}deg) scale(.4)`, opacity: 0 },
      ], { duration: 560 + Math.random() * 200, easing: "cubic-bezier(.2,.8,.2,1)" }).onfinish = () => s.remove();
    }
  }
  // every tap/click gets the soft bloom (not on inputs)
  addEventListener("pointerdown", e => {
    if (e.target.closest("input, textarea, .dock, .fx-menu")) return;
    bloomAt(e.clientX, e.clientY);
  }, { passive: true });

  /* ================= avatar: burst counter + hello ================= */
  const avatarBtn = $("#avatarBtn"), burstCount = $("#burstCount");
  let clicks = 0, bt;
  avatarBtn.addEventListener("click", () => {
    clicks++;
    burstCount.textContent = clicks;
    burstCount.classList.add("show");
    clearTimeout(bt); bt = setTimeout(() => burstCount.classList.remove("show"), 1500);
    avatarBtn.classList.remove("pop"); void avatarBtn.offsetWidth; avatarBtn.classList.add("pop");
    if (clicks === 7) { clicks = 0; burstCount.classList.remove("show"); showHello(); }
  });

  /* ================= hello easter egg ================= */
  const hello = $("#hello"), helloText = $("#helloText");
  let helloTimer;
  function showHello() {
    hello.hidden = false; hello.classList.remove("out", "typed");
    helloText.innerHTML = "";
    const parts = [["hello from ", ""], ["morphygram", "red"]];
    const flat = parts.flatMap(([t, c]) => [...t].map(ch => [ch, c]));
    let i = 0;
    clearInterval(helloTimer);
    helloTimer = setInterval(() => {
      if (i >= flat.length) {
        clearInterval(helloTimer); hello.classList.add("typed");
        helloTimer = setTimeout(closeHello, 4200);
        return;
      }
      const [ch, c] = flat[i++];
      const s = document.createElement("span");
      if (c) s.className = c;
      s.textContent = ch; helloText.appendChild(s);
    }, reduce ? 0 : 55);
  }
  function closeHello() {
    clearTimeout(helloTimer);
    hello.classList.add("out");
    setTimeout(() => { hello.hidden = true; hello.classList.remove("out"); }, 600);
  }
  hello.addEventListener("click", closeHello);
  addEventListener("keydown", e => { if (e.key === "Escape" && !hello.hidden) closeHello(); });

  /* ================= expand project ================= */
  const ghostToggle = $("#ghostToggle"), ghostBody = $("#ghostBody");
  ghostToggle.addEventListener("click", () => {
    const open = ghostBody.classList.toggle("open");
    ghostToggle.setAttribute("aria-expanded", String(open));
    ghostToggle.firstElementChild.textContent = open ? "свернуть" : "подробнее";
  });

  /* ================= terminal ================= */
  const termOut = $("#termOut"), termForm = $("#termForm"), termInput = $("#termInput");
  const esc = s => s.replace(/</g, "&lt;");
  function print(html, cls = "") {
    const d = document.createElement("div");
    d.className = "ln " + cls; d.innerHTML = html;
    termOut.appendChild(d); termOut.scrollTop = termOut.scrollHeight;
  }
  const cmds = {
    help: () => ["доступные: help, whoami, morphygram --status, date, hello, clear"],
    whoami: () => ["morphygram — developer. web, web-клиент telegram, linux."],
    "morphygram --status": () => ["morphygram: <span class='ok'>ACTIVE</span> · показывает удалённые и изменённые сообщения"],
    date: () => [esc(new Date().toLocaleString("ru-RU"))],
    hello: () => { showHello(); return ["hello from morphygram 🖤"]; },
    clear: () => { termOut.innerHTML = ""; return []; },
  };
  function run(raw) {
    const c = raw.trim().toLowerCase();
    if (!c) return;
    print(`<span class="cmd">$ ${esc(raw)}</span>`);
    const fn = cmds[c];
    if (!fn) { print(`команда не найдена: ${esc(c)}. напиши help`, "err"); return; }
    fn().forEach((line, i) => setTimeout(() => print(line, "ok"), reduce ? 0 : i * 110));
  }
  termForm.addEventListener("submit", e => { e.preventDefault(); run(termInput.value); termInput.value = ""; });
  $$("[data-cmd]").forEach(b => b.addEventListener("click", () => run(b.dataset.cmd)));
  print("morphygram terminal v4.0 — напиши <span class='cmd'>help</span>", "note");

  /* ================= mood ================= */
  const mood = $("#mood"), moodVal = $("#moodVal"), moodText = $("#moodText");
  const moodMsg = v => v < 25 ? "спокойно, почти по плану" : v < 60 ? "немного хаоса — норма" : v < 85 ? "код пишется сам" : "полный хаос, но работает";
  const updMood = () => { moodVal.textContent = `chaos: ${mood.value}%`; moodText.textContent = moodMsg(+mood.value); };
  mood.addEventListener("input", updMood); updMood();

  /* ================= player ================= */

  const audio = $("#audio"), music = $("#music"), playBtn = $("#playBtn");
  const playAudio = () => { try { const p = audio.play(); if (p && p.catch) p.catch(() => {}); } catch {} };
  const togglePlay = () => { if (audio.paused) playAudio(); else audio.pause(); };

  const bar = $("#bar"), fill = $("#fill"), knob = $("#knob"), cur = $("#cur"), dur = $("#dur");
  const vol = $("#vol"), loopBtn = $("#loopBtn");
  const fmt = s => isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : "0:00";
  audio.volume = .9;
  audio.addEventListener("loadedmetadata", () => dur.textContent = fmt(audio.duration));
  let lastTU = 0;
  audio.addEventListener("timeupdate", () => {
    const now = performance.now();
    if (now - lastTU < 120) return; lastTU = now; // throttle UI writes
    const p = audio.duration ? audio.currentTime / audio.duration : 0;
    fill.style.width = p * 100 + "%"; knob.style.left = p * 100 + "%";
    cur.textContent = fmt(audio.currentTime);
  });
  audio.addEventListener("play", () => music.classList.add("playing"));
  audio.addEventListener("pause", () => music.classList.remove("playing"));
  audio.addEventListener("ended", () => music.classList.remove("playing"));
  playBtn.addEventListener("click", () => togglePlay());
  $("#rewBtn").addEventListener("click", () => audio.currentTime = Math.max(0, audio.currentTime - 10));
  $("#fwdBtn").addEventListener("click", () => audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 10));
  loopBtn.addEventListener("click", () => {
    audio.loop = !audio.loop; loopBtn.classList.toggle("on", audio.loop);
    say(audio.loop ? "повтор: вкл" : "повтор: выкл");
  });
  vol.addEventListener("input", () => audio.volume = +vol.value);
  let seeking = false;
  const seek = e => {
    const r = bar.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    if (audio.duration) audio.currentTime = p * audio.duration;
  };
  bar.addEventListener("pointerdown", e => { seeking = true; try { bar.setPointerCapture(e.pointerId); } catch {} seek(e); });
  bar.addEventListener("pointermove", e => { if (seeking) seek(e); });
  const endSeek = () => seeking = false;
  bar.addEventListener("pointerup", endSeek);
  bar.addEventListener("pointercancel", endSeek);
  addEventListener("keydown", e => {
    if (e.code !== "Space" || /input|textarea/i.test(document.activeElement.tagName)) return;
    e.preventDefault(); togglePlay();
  });

  /* ================= canvas particles (throttled, pauses when hidden) ================= */
  const cv = $("#fx"), ctx = cv.getContext("2d");
  const dpr = Math.min(devicePixelRatio || 1, 1.5);
  let W = 0, H = 0, pts = [];
  let rgb = "239,41,71";
  function refreshRGB() {
    const v = getComputedStyle(root).getPropertyValue("--rgb").trim();
    if (v) rgb = v;
  }
  function sizeCanvas() {
    W = innerWidth; H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    cv.style.width = W + "px"; cv.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = small ? 24 : 56;
    pts = Array.from({ length: n }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - .5) * .25, vy: (Math.random() - .5) * .25, r: Math.random() * 1.4 + .4,
    }));
  }
  let mouse = { x: -999, y: -999 }, lastFrame = 0;
  const maxDist = small ? 90 : 130;
  function frame(t) {
    raf = requestAnimationFrame(frame);
    if (t - lastFrame < (small ? 40 : 28)) return; // ~25-35fps cap
    lastFrame = t;
    ctx.clearRect(0, 0, W, H);
    for (const p of pts) {
      p.x += p.vx; p.y += p.vy;
      const dx = p.x - mouse.x, dy = p.y - mouse.y, d = Math.hypot(dx, dy);
      if (d < 100 && d > 0) { p.x += dx / d * 1.1; p.y += dy / d * 1.1; }
      if (p.x < 0) p.x = W; else if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H; else if (p.y > H) p.y = 0;
      ctx.fillStyle = `rgba(${rgb},.65)`;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill();
    }
    ctx.lineWidth = .6;
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
      const a = pts[i], b = pts[j], d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < maxDist) {
        ctx.strokeStyle = `rgba(${rgb},${(1 - d / maxDist) * .18})`;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
    }
  }
  let raf = 0;
  function startCanvas() { if (!raf && !reduce) raf = requestAnimationFrame(frame); }
  function stopCanvas() { cancelAnimationFrame(raf); raf = 0; }
  document.addEventListener("visibilitychange", () => document.hidden ? stopCanvas() : startCanvas());
  sizeCanvas(); refreshRGB(); startCanvas();
  let rz; addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(() => { sizeCanvas(); if (rainOn) rainSize(); }, 150); }, { passive: true });
  if (reduce) { const c = cv.getContext("2d"); c.clearRect(0, 0, W, H); }

  /* ================= pointer effects (rAF-throttled, desktop only) ================= */
  if (fine && !reduce) {
    let pending = null;
    const queue = fn => { if (pending) return; pending = requestAnimationFrame(() => { pending = null; fn(); }); };
    addEventListener("pointermove", e => {
      mouse.x = e.clientX; mouse.y = e.clientY;
    }, { passive: true });
    const tilt = $("#tilt"), aw = $(".avatar-wrap");
    aw.addEventListener("pointermove", e => queue(() => {
      const r = tilt.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      tilt.style.transform = `perspective(500px) rotateX(${-y * 16}deg) rotateY(${x * 16}deg)`;
    }));
    aw.addEventListener("pointerleave", () => tilt.style.transform = "");
    $$(".spot, .card, .project, .link").forEach(el => el.addEventListener("pointermove", e => queue(() => {
      const r = el.getBoundingClientRect();
      el.style.backgroundImage = `radial-gradient(240px circle at ${e.clientX - r.left}px ${e.clientY - r.top}px, rgba(var(--rgb),.12), transparent 60%)`;
    })));
    $$(".spot, .card, .project, .link").forEach(el => el.addEventListener("pointerleave", () => el.style.backgroundImage = ""));
    $$(".act").forEach(el => {
      el.addEventListener("pointermove", e => queue(() => {
        const r = el.getBoundingClientRect();
        el.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * .08}px,${(e.clientY - r.top - r.height / 2) * .12}px)`;
      }));
      el.addEventListener("pointerleave", () => el.style.transform = "");
    });
  }

  /* ================= progress line + nav highlight (one scroll listener) ================= */
  const prog = $("#progress");
  const navLinks = $$(".section-nav a");
  const secs = navLinks.map(a => $(a.getAttribute("href"))).filter(Boolean);
  let scrollPending = false;
  function onScroll() {
    scrollPending = false;
    const h = document.documentElement.scrollHeight - innerHeight;
    prog.style.transform = `scaleX(${h > 0 ? scrollY / h : 0})`;
    let idx = 0;
    secs.forEach((s, i) => { if (s.getBoundingClientRect().top < innerHeight * .4) idx = i; });
    navLinks.forEach((a, i) => a.classList.toggle("active", i === idx));
  }
  addEventListener("scroll", () => { if (!scrollPending) { scrollPending = true; requestAnimationFrame(onScroll); } }, { passive: true });

  /* ================= dock + to top ================= */
  $$(".dock button").forEach(b => b.addEventListener("click", () => {
    const target = b.dataset.go === "profile" ? document.body : $("#" + b.dataset.go);
    if (target) target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    $$(".dock button").forEach(x => x.classList.toggle("on", x === b));
  }));
  $("#toTop").addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));

  /* ================= v5 animation pack ================= */
  // screen slice flash: only on the konami code (keyboard), no random triggers
  const slices = $("#slices");
  const flashSlices = () => {
    slices.classList.remove("go"); void slices.offsetWidth; slices.classList.add("go");
  };
  // random nickname glitch at unpredictable moments
  const glitchHandle = () => {
    handle.classList.add("glitching");
    setTimeout(() => handle.classList.remove("glitching"), 420);
  };
  function scheduleGlitch() {
    if (reduce) return;
    setTimeout(() => {
      if (!document.hidden && !document.body.classList.contains("calm")) {
        glitchHandle();
        if (Math.random() < .4) flashSlices();
      }
      scheduleGlitch();
    }, 2500 + Math.random() * 7000);
  }
  scheduleGlitch();

  // spotlight that follows the pointer (desktop)
  const spot = $("#spotlight");
  if (fine && !reduce) {
    let sx = 0, sy = 0, tx = 0, ty = 0, sRaf = 0;
    addEventListener("pointermove", e => {
      tx = e.clientX; ty = e.clientY;
      document.body.classList.add("has-pointer");
      if (!sRaf) sRaf = requestAnimationFrame(followSpot);
    }, { passive: true });
    function followSpot() {
      sx += (tx - sx) * .18; sy += (ty - sy) * .18;
      spot.style.transform = `translate(${sx}px,${sy}px)`;
      sRaf = Math.abs(tx - sx) + Math.abs(ty - sy) > .5 ? requestAnimationFrame(followSpot) : 0;
    }
    document.addEventListener("pointerleave", () => document.body.classList.remove("has-pointer"));
  }

  // pause decorative loops in sections that are off-screen
  const offIO = new IntersectionObserver(entries => {
    for (const e of entries) e.target.classList.toggle("off", !e.isIntersecting);
  }, { rootMargin: "120px 0px" });
  $$(".music, .block, .ticker, .section-nav").forEach(el => offIO.observe(el));

  // volume: visual track + value + icon
  const volEl = $("#vol"), volVal = $("#volVal"), volIco = $("#volIco");
  const paintVol = () => {
    const v = +volEl.value;
    volEl.style.setProperty("--p", (v * 100) + "%");
    volVal.textContent = Math.round(v * 100) + "%";
    volIco.textContent = v === 0 ? "🔇" : v < .5 ? "🔉" : "🔊";
    audio.volume = v;
  };
  volEl.addEventListener("input", paintVol);
  paintVol();

  // dock icon pop on tap
  $$(".dock button").forEach(b => b.addEventListener("click", () => {
    b.classList.remove("on"); void b.offsetWidth; b.classList.add("on");
  }));

  // neon/pulse on music play
  audio.addEventListener("play", () => { document.body.classList.add("is-playing"); });
  audio.addEventListener("pause", () => document.body.classList.remove("is-playing"));

  /* ================= final pack ================= */
  // hover-scramble on block titles
  $$(".block-title .label").forEach(el => el.addEventListener("pointerenter", () => {
    if (fine) { const t = el.lastChild; if (t && t.nodeType === 3) scrambleText(el); }
  }));
  function scrambleText(el) {
    if (reduce) return;
    const node = [...el.childNodes].find(n => n.nodeType === 3 && n.textContent.trim());
    if (!node) return;
    const target = node.__orig || node.textContent; node.__orig = target;
    let f = 0; const total = 14;
    const id = setInterval(() => {
      f++;
      node.textContent = [...target].map((c, i) => i < f * target.length / total ? c : GLYPHS[(Math.random() * GLYPHS.length) | 0]).join("");
      if (f >= total) { clearInterval(id); node.textContent = target; }
    }, 28);
  }
  // logo spin on tap
  $(".mini-brand .logo").addEventListener("click", e => {
    e.preventDefault();
    const l = e.currentTarget; l.classList.remove("spin"); void l.offsetWidth; l.classList.add("spin");
  });
  // konami re-added (keyboard)
  const seq = ["ArrowUp","ArrowUp","ArrowDown","ArrowDown","ArrowLeft","ArrowRight","ArrowLeft","ArrowRight","b","a"];
  let sp = 0;
  addEventListener("keydown", e => {
    if (e.key === seq[sp]) { sp++; if (sp === seq.length) { sp = 0; flashSlices(); say("cheat mode activated 😈"); } }
    else sp = e.key === seq[0] ? 1 : 0;
  });
})();
