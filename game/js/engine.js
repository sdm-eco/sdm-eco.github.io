// 공통 엔진: 글자 · 소리 · 저장 · 끌어다 놓기(누르기로도 가능) · 받는 곳 · 품목 · 말풍선 · 손질판
(function () {
  const { DEST, ITEMS, TOOLS, RECYCLE_SVG } = window.GAMEDATA;
  const G = window.G = {};
  const LANGS = ["ko", "en", "zh", "vi"];

  // ---------- 저장(이 기기에만, 개인정보 없음) ----------
  const KEY = "sdm-hero-v1";
  let store = {};
  try { store = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) { store = {}; }
  G.save = function () { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {} };
  G.store = store;
  store.book = store.book || {}; store.story = store.story || {};

  // ---------- 언어 ----------
  const qs = new URLSearchParams(location.search);
  G.lang = LANGS.includes(qs.get("lang")) ? qs.get("lang") : (LANGS.includes(store.lang) ? store.lang : "ko");
  G.setLang = function (l) { G.lang = l; store.lang = l; G.save(); document.documentElement.lang = l === "zh" ? "zh-CN" : l; };
  G.setLang(G.lang);
  G.t = function (k, vars) {
    let v = (window.I18N[G.lang] || {})[k];
    if (v === undefined) v = window.I18N.ko[k];
    if (v === undefined) return k;
    if (Array.isArray(v)) v = v[Math.floor(Math.random() * v.length)];
    if (vars) Object.keys(vars).forEach(function (n) { v = v.split("{" + n + "}").join(vars[n]); });
    return v;
  };
  G.itemName = (id) => G.t((ITEMS[id] && ITEMS[id].name) || "item." + id);
  G.destName = (id) => G.t("dest." + id);
  // 맞는 곳: dest 하나 + also(함께 맞는 곳. 예: 깨진 유리 = 특수규격봉투 또는 종량제 봉투)
  G.fits = (id, did) => did === ITEMS[id].dest || (ITEMS[id].also || []).includes(did);
  G.destNames = (id) => [ITEMS[id].dest].concat(ITEMS[id].also || []).map(G.destName).join(" · ");
  G.LANGS = LANGS;
  G.LANG_LABEL = { ko: "한국어", en: "EN", zh: "中文", vi: "VI" };

  // ---------- 만들기 도구 ----------
  G.h = function (html) { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  G.esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  G.img = (p) => "img/" + p;
  G.app = document.getElementById("app");
  // 크기 단위(--u): 휴대폰 브라우저의 vh 는 주소창이 숨었을 때 높이라서, 실제로 보이는 크기(innerWidth · innerHeight)로 계산
  function setUnits() {
    const w = innerWidth, h = innerHeight, P = h >= w;
    const u = P ? Math.min(w / 720, h / 1280) : Math.min(w / 1280, h / 720);
    const s = document.documentElement.style;
    s.setProperty("--u", u.toFixed(4) + "px"); s.setProperty("--vh", (h / 100).toFixed(3) + "px");
  }
  setUnits(); addEventListener("resize", setUnits); addEventListener("orientationchange", setUnits);
  if (window.visualViewport) visualViewport.addEventListener("resize", setUnits);
  G.ghostLayer = document.getElementById("ghost-layer");
  G.RECYCLE_SVG = RECYCLE_SVG;
  G.ICON = {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/></svg>',
    sound: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 9c1.5 1.5 1.5 4.5 0 6M19 6c3 3 3 9 0 12"/></svg>',
    pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>',
    book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5c3-1 6-1 8 1 2-2 5-2 8-1v14c-3-1-6-1-8 1-2-2-5-2-8-1z"/><path d="M12 6v14"/></svg>',
    go: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/></svg>',
    phone: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14 6l6 8-4 4c2 5 7 10 12 12l4-4 8 6-3 6c-12 1-28-15-27-27z"/></svg>',
    house: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M6 22L24 8l18 14"/><path d="M10 20v20h28V20"/><path d="M20 40V28h8v12"/></svg>',
    tree: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="24" cy="18" r="11"/><path d="M24 29v13M16 42h16"/></svg>',
    door: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><rect x="12" y="6" width="24" height="36" rx="2"/><circle cx="30" cy="25" r="1.6" fill="currentColor"/><path d="M6 42h36"/></svg>',
    cal: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="10" width="34" height="30" rx="4"/><path d="M7 18h34M16 6v8M32 6v8"/><path d="M18 28l4 4 8-8"/></svg>',
    // 머리 막대 칩(휴대폰에서는 글자 없이 그림만): 점수 = 별, 콤보 = 번개
    star: '<svg viewBox="0 0 24 24"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z" fill="#f2b632" stroke="#c98a00" stroke-width="1.4" stroke-linejoin="round"/></svg>',
    bolt: '<svg viewBox="0 0 24 24"><path d="M13.5 2L5 13.5h6L9.8 22 19 10h-6.2z" fill="#ff8a3d" stroke="#c45a12" stroke-width="1.4" stroke-linejoin="round"/></svg>',
    hand: '<svg viewBox="0 0 24 24" fill="#fff" stroke="#3d2f00" stroke-width="1.6" stroke-linejoin="round"><path d="M9 11V4.5a1.5 1.5 0 013 0V10l.1-1.2a1.5 1.5 0 013 .1V11l.1-.6a1.4 1.4 0 012.8.3V15c0 3.6-2.4 6-5.8 6h-.4c-2.1 0-3.6-.9-4.8-2.6L4.4 14.2a1.4 1.4 0 012.2-1.7z"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    // 멈춤 창 단추: 계속하기 = 재생, 다시 하기 = 돌아가는 화살표
    play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.2v13.6a1 1 0 001.5.86l11-6.8a1 1 0 000-1.72l-11-6.8A1 1 0 008 5.2z"/></svg>',
    retry: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 11-2.4-5.7"/><path d="M20 4v5h-5"/></svg>'
  };
  // 겹창 제목: 앞에 초록 원 아이콘(모든 창 같은 틀, css .ttl-ic). html은 이미 이스케이프된 글자
  G.ttl = (icon, html) => `<h2><span class="ttl-ic" aria-hidden="true">${G.ICON[icon]}</span><span>${html}</span></h2>`;
  G.star = (on) => `<svg viewBox="0 0 24 24"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z" fill="${on ? "#f2b632" : "#e3ebe5"}" stroke="${on ? "#c98a00" : "#cfdbd2"}" stroke-width="1.2" stroke-linejoin="round"/></svg>`;
  G.stars = (n, of) => Array.from({ length: of || 3 }, (_, i) => G.star(i < n)).join("");

  // ---------- 소리(파일 없이 짧은 신호음) ----------
  let actx = null;
  G.soundOn = store.sound !== false;
  G.toggleSound = function () {
    G.soundOn = !G.soundOn; store.sound = G.soundOn; G.save();
    if (G.soundOn) G.music.resume(); else G.music.stop(true);
    return G.soundOn;
  };
  G.pitch = 1;   // 러시 피버 때 효과음을 높임
  G.REDUCED = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
  // 하는 중에 '동작 줄이기'를 바꿔도 따라감: 켜면 날고 있는 조각 · 도구 동작(스크립트 애니메이션)은 바로 끝내고,
  //   떨어지는 중인 물건 · 하루 시작 띠는 끝난 상태로(안 그러면 다시 끌 때 뒤늦게 움직임)
  if (window.matchMedia) {
    const mq = matchMedia("(prefers-reduced-motion: reduce)"), on = function (e) {
      G.REDUCED = e.matches; if (!e.matches) return;
      document.getAnimations().forEach((a) => { if (!(window.CSSAnimation && a instanceof CSSAnimation) && !(window.CSSTransition && a instanceof CSSTransition)) a.finish(); });
      document.querySelectorAll(".item.drop").forEach((el) => el.classList.remove("drop"));
      document.querySelectorAll(".day-banner").forEach((el) => el.remove());
    };
    if (mq.addEventListener) mq.addEventListener("change", on); else if (mq.addListener) mq.addListener(on);
    G._motionMQ = mq;   // 참조를 붙잡아 둠(지역 변수로만 두면 MediaQueryList가 수거되어 change가 오지 않을 수 있음)
  }
  function ac() {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === "suspended") actx.resume();
    return actx;
  }
  function tone(freq, start, dur, type, vol, out) {
    const t = actx.currentTime + start, o = actx.createOscillator(), g = actx.createGain();
    o.type = type || "sine"; o.frequency.setValueAtTime(freq * G.pitch, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.12, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out || actx.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(start, dur, vol, filter, freq, out) {
    const t = actx.currentTime + start, n = Math.max(1, Math.floor(actx.sampleRate * dur));
    const buf = actx.createBuffer(1, n, actx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = actx.createBufferSource(), f = actx.createBiquadFilter(), g = actx.createGain();
    s.buffer = buf; f.type = filter || "lowpass"; f.frequency.value = freq || 1200; g.gain.value = vol;
    s.connect(f); f.connect(g); g.connect(out || actx.destination); s.start(t);
  }
  G.sfx = function (kind) {
    if (!G.soundOn) return;
    try {
      ac();
      if (kind === "ok") { tone(660, 0, 0.12, "triangle"); tone(990, 0.08, 0.16, "triangle"); }
      else if (kind === "no") { tone(220, 0, 0.18, "square", 0.05); tone(180, 0.1, 0.22, "square", 0.05); }
      else if (kind === "tap") tone(520, 0, 0.06, "triangle", 0.08);
      else if (kind === "step") { tone(560, 0, 0.08, "triangle"); tone(700, 0.06, 0.1, "triangle"); }
      else if (kind === "combo") [660, 830, 990, 1320].forEach((f, i) => tone(f, i * 0.06, 0.14, "triangle", 0.09));
      else if (kind === "win") [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.3, "triangle", 0.1));
      else if (kind === "go") { tone(784, 0, 0.12, "triangle", 0.12); tone(1175, 0.1, 0.28, "triangle", 0.12); }
      else if (kind === "tick") tone(1480, 0, 0.05, "square", 0.025);
      else if (kind === "slap") { noise(0, 0.12, 0.5, "lowpass", 1400); tone(120, 0, 0.2, "sine", 0.3); }   // 스티커가 '찰싹'
      else if (kind === "drop") { tone(330, 0, 0.07, "sine", 0.12); noise(0, 0.05, 0.12, "highpass", 2500); }  // 수거함에 '툭'
    } catch (e) {}
  };

  // ---------- 배경 음악(러시): 파일 없이 짧은 반복 · 피버 때 빨라짐 · 소리를 끄면 멈춤 ----------
  G.music = (function () {
    const PROG = [[48, 52, 55, 60], [45, 48, 52, 57], [41, 45, 48, 53], [43, 47, 50, 55]];   // 도 · 라단조 · 파 · 솔 (MIDI 음 번호)
    const ARP = [0, 2, 1, 3, 2, 1, 3, 2];
    const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
    let timer = 0, step = 0, next = 0, bus = null, fast = false, want = false;
    function play(s, t) {
      const ch = PROG[Math.floor(s / 16) % 4], i = s % 16, at = t - actx.currentTime, p = G.pitch;
      G.pitch = 1;
      if (i % 4 === 0) tone(hz(ch[0] - 12 + (i % 8 ? 12 : 0)), at, 0.2, "triangle", 0.5, bus);    // 베이스(통통)
      if (i % 2 === 0) tone(hz(ch[ARP[(i / 2) % 8]] + 12), at, 0.13, "triangle", 0.2, bus);         // 아르페지오
      if (i === 0 || i === 8) tone(70, at, 0.16, "sine", 0.6, bus);                                // 북
      if (i % 4 === 2) noise(at, 0.04, 0.12, "highpass", 6000, bus);                               // 찰랑
      G.pitch = p;
    }
    function tick() {
      if (!actx || !bus) return;
      if (next < actx.currentTime - 0.05) next = actx.currentTime + 0.02;   // 탭이 가려졌다 돌아오면 밀린 음을 한꺼번에 내지 않음
      while (next < actx.currentTime + 0.12) { play(step, next); next += 60 / (fast ? 156 : 132) / 4; step++; }
    }
    function start() {
      if (timer || !G.soundOn) return;
      try { ac(); } catch (e) { return; }
      bus = actx.createGain(); bus.gain.value = 0.07; bus.connect(actx.destination);
      next = actx.currentTime + 0.06; timer = setInterval(tick, 25); tick();
    }
    function stop(keep) {
      if (!keep) want = false;
      clearInterval(timer); timer = 0;
      if (bus) { const b = bus; bus = null; try { b.gain.setTargetAtTime(0.0001, actx.currentTime, 0.05); setTimeout(() => b.disconnect(), 400); } catch (e) {} }
    }
    return {
      play() { want = true; step = 0; start(); },
      stop, resume() { if (want) start(); },
      fast(f) { fast = !!f; }
    };
  })();

  // ---------- 도감 ----------
  G.bookAdd = function (id) { if (ITEMS[id] && ITEMS[id].dest && !store.book[id]) { store.book[id] = 1; G.save(); } };
  // 러시 · 새내기 일주일에서 맞힐 수 있는 품목만 (유리병 · 건전지는 두 놀이에 나오지 않아 도감에서 뺌)
  G.BOOK_ORDER = ["banana", "tangerine", "leftover", "bone", "pit", "egg", "shell", "pineapple", "tissue", "receipt", "chopsticks", "toothbrush",
    "pet", "can", "carton", "brokenglass", "butane", "pills", "syrup", "clothes", "blanket", "chair", "fridge", "fan"];
  // 도감(11/28 정리): 분류(일반 · 음식물 · 재활용 · 대형·특수, 맞는 곳의 분류)별 묶음 + 묶음마다 모은 수
  //   칸: 같은 크기의 그림 자리(그림은 칸 안에 맞춤) · 이름(최대 두 줄) · 버리는 곳은 한 곳씩 작은 표시로
  //   아직 못 모은 칸: 같은 모양의 연한 그림자 실루엣 + ?
  const BOOK_GRPS = ["general", "food", "recycle", "special"];
  G.openBook = function () {
    const got = G.BOOK_ORDER.filter((id) => store.book[id]).length;
    const card = function (id) {
      const on = !!store.book[id], it = ITEMS[id];
      // 좁은 칸에서는 괄호 앞에서 줄을 바꿈(예: 특수규격봉투 / (PP마대))
      const to = on ? [it.dest].concat(it.also || []).map((d) => `<em>${G.esc(G.destName(d)).replace(/\(/g, "<wbr>(")}</em>`).join("") : "";
      return `<div class="pg${on ? "" : " locked"}"><span class="pic"><img src="${G.img(it.img)}" alt=""></span><b>${on ? G.esc(G.itemName(id)) : "?"}</b><span class="to">${to}</span></div>`;
    };
    const groups = BOOK_GRPS.map(function (g) {
      const ids = G.BOOK_ORDER.filter((id) => DEST[ITEMS[id].dest].grp === g);
      if (!ids.length) return "";
      const n = ids.filter((id) => store.book[id]).length;
      return `<section class="bk-grp" data-grp="${g}"><h3><i aria-hidden="true"></i>${G.t("grp." + g)}<span>${n} / ${ids.length}</span></h3><div class="book">${ids.map(card).join("")}</div></section>`;
    }).join("");
    G.panel(`${G.ttl("book", G.t("ui.book"))}<p class="lead">${G.t("ui.bookLead")} ${G.t("ui.got", { n: got, t: G.BOOK_ORDER.length })}</p>${groups}`,
      [{ label: G.t("ui.close"), primary: true }], { cls: "book-ov" });
  };

  // ---------- 겹창 ----------
  let panelN = 0;
  function syncInert(parent) {   // 맨 위(마지막) 겹창만 살리고 나머지 형제는 inert. 겹창이 없으면 모두 풂
    const kids = [...parent.children], top = kids.filter((k) => k.classList.contains("overlay")).pop();
    kids.forEach((k) => { k.inert = !!top && k !== top; });
  }
  G.panel = function (html, buttons, opt) {
    // opt.cls: 겹창에 붙일 꾸밈 이름(예: 멈춤 창 pause-ov)
    const ov = G.h(`<div class="overlay${opt && opt.cls ? " " + opt.cls : ""}" role="dialog" aria-modal="true"><div class="panel">${html}<div class="row"></div></div></div>`);
    const row = ov.querySelector(".row");
    (buttons || []).forEach(function (b) {
      const btn = G.h(`<button class="btn ${b.primary ? "" : "ghost-btn"}">${b.label}</button>`);
      btn.addEventListener("click", function () { G.sfx("tap"); if (!b.keep) ov.remove(); if (b.on) b.on(); });
      row.appendChild(btn);
    });
    const parent = opt && opt.parent || G.app, back = document.activeElement;
    parent.appendChild(ov);
    // 창 이름: 첫 제목(h2/h3)을 aria-labelledby로
    const hd = ov.querySelector(".panel h2, .panel h3"); if (hd) { hd.id = hd.id || "pn-" + (++panelN); ov.setAttribute("aria-labelledby", hd.id); }
    // 모달: 맨 위 창 말고는 inert(Tab · 누르기가 뒤 화면으로 가지 않음 → 멈춤 창 위에 또 멈춤 창이 뜨는 일도 막음).
    //   창이 어떤 방법으로든 빠지면(단추 · 다른 코드의 remove · 화면 바꾸기) 다시 맞추고, 열기 전 초점으로 돌려놓음
    syncInert(parent);
    const mo = new MutationObserver(function () {
      if (ov.isConnected) return;
      mo.disconnect(); syncInert(parent);
      if (back && back.isConnected && !back.closest("[inert]") && document.activeElement === document.body) back.focus({ preventScroll: true });
    });
    mo.observe(parent, { childList: true });
    // 내용이 넘쳐 스크롤되는 창만 단추 줄 뒤를 막음(css .panel.scrolls). 한계: 연 뒤 화면 크기가 바뀌어도 다시 재지 않음
    const pn = ov.querySelector(".panel"); if (pn.scrollHeight > pn.clientHeight + 4) pn.classList.add("scrolls");
    const first = row.querySelector(".btn:not(.ghost-btn)") || row.querySelector(".btn"); if (first) first.focus({ preventScroll: true }); ov.querySelector(".panel").scrollTop = 0;
    return ov;
  };

  // ---------- 머리 막대 ----------
  G.hud = function (title, chipsHtml, opt) {
    opt = opt || {};
    const el = G.h(`<header class="hud">
      <div class="brand"><img src="${G.img("brand/logo.png")}" alt="서대문구"></div>
      <span class="mode-name">${title}</span><span class="sp"></span>
      <div class="chips" style="display:flex;gap:8px;align-items:center">${chipsHtml || ""}</div>
      ${opt.pause ? `<button class="icon-btn" data-a="pause" aria-label="${G.t("ui.pause")}">${G.ICON.pause}</button>` : ""}
      <button class="icon-btn" data-a="book" aria-label="${G.t("ui.book")}">${G.ICON.book}</button>
      <button class="icon-btn" data-a="sound" aria-pressed="${G.soundOn}" aria-label="${G.t("ui.sound")}">${G.ICON.sound}</button>
      <button class="icon-btn" data-a="home" aria-label="${G.t("ui.home")}">${G.ICON.home}</button></header>`);
    el.addEventListener("click", function (e) {
      const b = e.target.closest("[data-a]"); if (!b) return;
      const a = b.dataset.a;
      if (a === "sound") { b.setAttribute("aria-pressed", G.toggleSound()); G.sfx("tap"); }
      else if (a === "home") { G.sfx("tap"); if (opt.onLeave) opt.onLeave(); G.go("title"); }
      else if (a === "book") { if (opt.onPause) opt.onPause(true); G.openBook(); watchClose(opt); }
      // 멈춤 창: 놀이가 따로 만들면(opt.pausePanel, 러시) 그것을, 없으면 기본 창
      else if (a === "pause" && opt.onPause) { opt.onPause(true); if (opt.pausePanel) opt.pausePanel(); else G.panel(G.ttl("pause", G.t("ui.pause")), [{ label: G.t("ui.resume"), primary: true, on: () => opt.onPause(false) }]); }
    });
    return el;
  };
  function watchClose(opt) {   // 도감을 닫으면 멈춤 풀기
    if (!opt.onPause) return;
    const ov = G.app.querySelector(".overlay:last-child");
    if (ov) ov.querySelector(".btn").addEventListener("click", () => opt.onPause(false));
  }

  // ---------- 받는 곳 ----------
  G.destEl = function (id, opt) {
    const d = DEST[id];
    let fig = "";
    if (d.phone) fig = `<div class="phone-card">${G.ICON.phone}<b>1599-0903</b></div>`;
    else {
      let plate = "";
      if (d.plate) {
        const [x, y, w, h, W, H] = d.plate;
        const pos = `left:${(x / W * 100).toFixed(2)}%;top:${(y / H * 100).toFixed(2)}%;width:${(w / W * 100).toFixed(2)}%;height:${(h / H * 100).toFixed(2)}%`;
        plate = d.mark ? `<span class="plate" style="${pos}"><img src="${G.img("mark/" + d.mark + ".svg")}" alt=""></span>`
          : `<span class="plate" style="${pos}"><span>${G.esc(G.t(d.text)).replace(/\n/g, "<br>")}</span></span>`;
      }
      fig = `<img src="${G.img(d.img)}" alt="">${plate}${d.sticker ? `<span class="sticker-tag">${G.t("plate.sticker")}</span>` : ""}`;
    }
    const el = G.h(`<div class="dest drop-target" data-dest="${id}" data-grp="${d.grp}" data-accept="item" role="button" tabindex="0" aria-label="${G.esc(G.destName(id))}">
      <div class="fig">${fig}</div><span class="cap">${G.esc(G.destName(id))}</span></div>`);
    if (opt && opt.small) el.style.setProperty("--small", 1);
    return el;
  };

  // ---------- 품목 ----------
  G.itemEl = function (id, opt) {
    const it = ITEMS[id];
    const el = G.h(`<div class="item" data-item="${id}" role="button" tabindex="0" aria-label="${G.esc(G.itemName(id))}" style="--w:${(opt && opt.w) || it.w || 120}">
      <img src="${G.img((opt && opt.src) || it.img)}" alt="" draggable="false"></div>`);
    if (opt && opt.tag) el.appendChild(G.h(`<span class="tag">${G.esc(G.itemName(id))}</span>`));
    return el;
  };
  G.toolEl = function (id) {
    const tl = TOOLS[id];
    const ic = tl.img ? `<img src="${G.img(tl.img)}" alt="">` : tl.svg;
    return G.h(`<div class="tool" data-tool="${id}" role="button" tabindex="0"><span class="ti">${ic}</span><span>${G.esc(G.t("tool." + id))}</span></div>`);
  };

  // ---------- 말풍선 ----------
  const FACE = { girl: "char/girl-smile.webp", "girl-laugh": "char/girl-laugh.webp", "girl-worry": "char/girl-worry.webp",
    boy: "char/boy-smile.webp", "boy-stop": "char/boy-stop.webp", "boy-surprise": "char/boy-surprise.webp" };
  G.face = (who) => G.img(FACE[who] || FACE.girl);
  G.talk = function (field, who, html, opt) {
    opt = opt || {};
    let el = field.querySelector(".talk");
    if (!el) { el = G.h(`<div class="talk hide"><div class="face"><img alt=""></div><div class="say"></div></div>`); field.appendChild(el); }
    el.querySelector(".face img").src = G.img(FACE[who] || FACE.girl);
    // 말이 바뀔 때마다 얼굴이 통통 튐(css .talk-pop), 평소에는 css로 숨쉬듯 들썩임
    const fc = el.querySelector(".face"); fc.classList.remove("talk-pop"); void fc.offsetWidth; fc.classList.add("talk-pop");
    const say = el.querySelector(".say");
    say.innerHTML = html;
    el.classList.toggle("stop", !!opt.stop);
    // 놀이 중(품목 · 카드가 있을 때)에는 작은 말풍선, 이야기 대화는 큰 말풍선
    el.classList.toggle("mini", !!field.querySelector(".item, .card-drop, .statement"));
    if (opt.stop) say.setAttribute("data-stop", G.t("ui.stop")); else say.removeAttribute("data-stop");
    el.classList.remove("hide");
    G.placeTalk(field, el);
    clearTimeout(el._t);
    if (opt.ms) el._t = setTimeout(() => el.classList.add("hide"), opt.ms);
    return el;
  };
  // 말풍선 자리: 네 귀퉁이 가운데 품목 · 카드 · 도구를 가장 적게 가리는 곳 (같으면 왼쪽 아래)
  G.unit = function (field) {
    const p = G.h(`<div style="position:absolute;width:calc(var(--u)*100);height:0;visibility:hidden"></div>`); field.appendChild(p);
    const u = p.offsetWidth / 100; p.remove(); return u || 1;
  };
  G.placeTalk = function (field, el) {
    el = el || field.querySelector(".talk"); if (!el || el.classList.contains("hide")) return;
    Object.assign(el.style, { left: "", right: "", top: "", bottom: "" }); el.classList.remove("slim");
    const stp = field.querySelector(".steps"); if (stp) stp.style.translate = "";
    const f = field.getBoundingClientRect(), r = el.getBoundingClientRect(); if (!f.width) return;
    const m = Math.max(6, G.unit(field) * 12), w = r.width, h = r.height;
    const pr = field.querySelector(".prompt");
    const topY = pr ? pr.getBoundingClientRect().bottom - f.top + 6 : m;
    const obs = [];
    field.querySelectorAll(".item:not(.gone), .card-drop, .statement, .tool, .steps, .miss-sticker, .belt, .prompt").forEach(function (e) {
      const b = e.getBoundingClientRect(); if (!b.width) return;
      const wt = e.classList.contains("prompt") || e.classList.contains("belt") ? 0.4 : e.classList.contains("steps") ? 1.5 : 1;
      obs.push([b.left - f.left, b.top - f.top, b.right - f.left, b.bottom - f.top, wt]);
    });
    const cands = [[0, 1], [1, 1], [0, 0], [1, 0]];   // [오른쪽?, 아래?]
    let best = null;
    cands.forEach(function ([R, B]) {
      const x = R ? f.width - m - w : m, y = B ? f.height - m - h : Math.min(topY, f.height - m - h);
      let s = 0; obs.forEach(function (o) { s += Math.max(0, Math.min(x + w, o[2]) - Math.max(x, o[0])) * Math.max(0, Math.min(y + h, o[3]) - Math.max(y, o[1])) * o[4]; });
      if (!best || s < best.s - 1) best = { s, R, B, y };
    });
    // 네 귀퉁이 모두 가리면: 얼굴을 빼고 안내문 자리(맨 위 가운데)에 띄움
    if (best.s > 0 && el.classList.contains("mini")) {
      el.classList.add("slim");
      const pt = pr ? pr.getBoundingClientRect().top - f.top : m;
      el.style.top = pt + "px";
      const b = el.getBoundingClientRect(); let s2 = 0;
      obs.forEach(function (o) { if (o[4] === 0.4) return; s2 += Math.max(0, Math.min(b.right - f.left, o[2]) - Math.max(b.left - f.left, o[0])) * Math.max(0, Math.min(b.bottom - f.top, o[3]) - Math.max(b.top - f.top, o[1])) * o[4]; });
      if (s2 < best.s) {
        // 말풍선이 안내문보다 길어 단계 표시에 조금 걸리면 단계 표시를 그만큼 내림
        if (stp) { const d = b.bottom + 4 - stp.getBoundingClientRect().top; if (d > 0 && d <= 14) stp.style.translate = "0 " + d.toFixed(1) + "px"; }
        return;
      }
      el.classList.remove("slim"); el.style.top = "";
    }
    if (best.R) { el.style.left = "auto"; el.style.right = m + "px"; }
    if (!best.B) { el.style.bottom = "auto"; el.style.top = best.y + "px"; }
  };
  // 놀이판 크기가 바뀌면(창 크기 · 늦게 뜬 그림 · 글꼴) 다시 배치
  G.onFieldResize = function (field, fn) {
    if (!field._ro) {
      field._fns = []; let t = 0, last = "";
      const run = () => { const k = field.clientWidth + "x" + field.clientHeight; if (k === last) return; last = k; field._fns.forEach((f) => f()); G.placeTalk(field); };
      field._run = run;
      if (window.ResizeObserver) { field._ro = new ResizeObserver(() => { clearTimeout(t); t = setTimeout(run, 60); }); field._ro.observe(field); }
      else { field._ro = 1; addEventListener("resize", () => { clearTimeout(t); t = setTimeout(run, 120); }); }
    }
    field._fns.push(fn);
  };
  // 아래쪽 말풍선 자리(높이): 공간이 넉넉할 때 품목 · 카드가 이만큼 비켜 줌
  G.talkBand = function (field) {
    const p = G.h(`<div class="talk mini" style="visibility:hidden"><div class="face"></div></div>`); field.appendChild(p);
    const h = p.querySelector(".face").offsetHeight; p.remove();
    return h + Math.max(6, G.unit(field) * 12) + 8;
  };
  // 수거함 이름판 글자: 판 안에 들어갈 때까지 줄임(영어 등 긴 이름)
  G.fitPlates = function (root) {
    root.querySelectorAll(".plate > span").forEach(function (sp) {
      const pl = sp.parentElement; sp.style.fontSize = "";
      // 수거함 그림이 아직 안 떴으면(이름표 크기 0 또는 그림 로딩 중) 뜬 뒤에 다시 맞춤
      const img = pl.closest(".dest") && pl.closest(".dest").querySelector(".fig > img");
      if (img && !img.complete && !img._fitWait) { img._fitWait = 1; img.addEventListener("load", () => G.fitPlates(pl.closest(".dest")), { once: true }); }
      if (!pl.clientWidth) return;
      let fs = parseFloat(getComputedStyle(sp).fontSize), n = 0;
      const big = () => Math.max(sp.getBoundingClientRect().width, sp.scrollWidth) > pl.clientWidth * 0.94 || Math.max(sp.getBoundingClientRect().height, sp.scrollHeight) > pl.clientHeight * 0.94;
      sp.style.visibility = "";
      while (n++ < 30 && fs > 5 && big()) { fs *= 0.92; sp.style.fontSize = fs.toFixed(1) + "px"; }
      if (fs < 6 || big()) sp.style.visibility = "hidden";   // 읽을 수 없을 만큼 작으면 숨김(이름은 아래 이름 칸에 있음)
    });
  };
  { let t = 0; addEventListener("resize", () => { clearTimeout(t); t = setTimeout(() => G.fitPlates(document), 150); }); }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => G.fitPlates(document));   // 글꼴이 늦게 뜨면 다시 맞춤
  G.float = function (field, x, y, text, bad) {
    const f = G.h(`<div class="float ${bad ? "bad" : ""}">${text}</div>`);
    f.style.top = Math.max(y, 66) + "px";   // 위로 60px 떠오르므로
    field.appendChild(f);
    const hw = f.offsetWidth / 2 + 6; f.style.left = Math.min(Math.max(x, hw), field.clientWidth - hw) + "px";   // 글자가 놀이판 밖으로 나가지 않게
    setTimeout(() => f.remove(), 950);
  };
  G.flash = function (el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); setTimeout(() => el.classList.remove(cls), 600); };
  // 숫자가 올라가며 세어짐
  G.countTo = function (el, to, ms) {
    const from = +el.dataset.n || 0, t0 = performance.now(); el.dataset.n = to;
    cancelAnimationFrame(el._cu);
    if (G.REDUCED || from === to) { el.textContent = to; return; }
    const f = function (now) { const k = Math.min(1, (now - t0) / (ms || 400)); el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3))); if (k < 1) el._cu = requestAnimationFrame(f); };
    el._cu = requestAnimationFrame(f);
  };

  // ---------- 맞혔을 때: 품목이 포물선을 그리며 받는 곳으로 날아 들어감 → 받는 곳이 툭 튀고 그 색 조각이 튐 ----------
  G.flyTo = function (from, src, target, color, done) {
    const land = function () { G.flash(target, "ok"); G.burst(target, color); G.sfx("drop"); if (done) done(); };
    const fig = target.querySelector(".fig") || target, tr = fig.getBoundingClientRect();
    if (G.REDUCED || !from || !from.width || !tr.width) { land(); return; }
    const sz = Math.min(from.width, from.height, 180), sx = from.left + from.width / 2, sy = from.top + from.height / 2;
    const el = G.h(`<img class="fly" src="${src}" alt="">`);
    Object.assign(el.style, { width: sz + "px", height: sz + "px", left: sx - sz / 2 + "px", top: sy - sz / 2 + "px" });
    G.ghostLayer.appendChild(el);
    const dx = tr.left + tr.width / 2 - sx, dy = tr.top + tr.height * 0.28 - sy;
    const lift = Math.max(50, Math.min(220, Math.abs(dx) * 0.35 + Math.max(0, -dy) * 0.4));
    const kf = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      kf.push({ transform: `translate(${(dx * t).toFixed(1)}px, ${(dy * t - lift * 4 * t * (1 - t)).toFixed(1)}px) rotate(${(t * 220 * (dx < 0 ? -1 : 1)).toFixed(0)}deg) scale(${(1 - 0.62 * t).toFixed(3)})`, opacity: t > 0.88 ? 0.3 : 1 });
    }
    const a = el.animate(kf, { duration: 430, easing: "linear" });
    a.onfinish = function () { el.remove(); land(); };
  };
  G.burst = function (target, color) {
    if (G.REDUCED) return;
    const fig = target.querySelector(".fig") || target, r = fig.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height * 0.2;
    for (let i = 0; i < 14; i++) {
      // 넷 중 하나는 노란 별(맞혔다는 느낌), 나머지는 받는 곳 색 · 흰 조각
      const star = i % 4 === 1, p = G.h(star ? `<i class="bit star">${G.ICON.star}</i>` : `<i class="bit"></i>`), big = i % 4 === 0;
      if (!star) p.style.background = i % 3 === 2 ? "#fff" : color;
      p.style.left = cx + "px"; p.style.top = cy + "px";
      if (big) { p.style.width = p.style.height = "12px"; }
      G.ghostLayer.appendChild(p);
      const ang = -Math.PI / 2 + (Math.random() - 0.5) * 2.4, d = 46 + Math.random() * 70;
      p.animate([{ transform: "translate(-50%, -50%) rotate(0deg)", opacity: 1 },
        { transform: `translate(calc(-50% + ${(Math.cos(ang) * d).toFixed(0)}px), calc(-50% + ${(Math.sin(ang) * d + 36).toFixed(0)}px)) rotate(${(Math.random() * 540).toFixed(0)}deg) scale(.5)`, opacity: 0 }],
        { duration: 620 + Math.random() * 260, easing: "cubic-bezier(.2,.7,.4,1)" }).onfinish = () => p.remove();
    }
  };

  // ---------- 바닥에 놓기: 그림 속 물건의 실제 자리(투명 여백을 뺀 곳)를 재서 발 밑에 그림자를 깖 ----------
  const FOOT = {}, FOOT0 = { l: 0.1, r: 0.9, b: 0.95 };
  G.footOf = function (src, cb) {
    if (FOOT[src]) { cb(FOOT[src]); return; }
    const im = new Image();
    im.onload = function () {
      let r = FOOT0;
      try {
        const W = im.naturalWidth, H = im.naturalHeight, k = 64 / Math.max(W, H), w = Math.max(1, Math.round(W * k)), h = Math.max(1, Math.round(H * k));
        const c = document.createElement("canvas"); c.width = w; c.height = h;
        const x = c.getContext("2d"); x.drawImage(im, 0, 0, w, h);
        const d = x.getImageData(0, 0, w, h).data, m = Math.max(w, h);
        let l = w, rr = -1, b = -1;
        for (let y = 0; y < h; y++) for (let i = 0; i < w; i++) if (d[(y * w + i) * 4 + 3] > 40) { if (i < l) l = i; if (i > rr) rr = i; b = y; }
        if (rr >= 0) r = { l: ((m - w) / 2 + l) / m, r: ((m - w) / 2 + rr + 1) / m, b: ((m - h) / 2 + b + 1) / m };
      } catch (e) {}
      FOOT[src] = r; cb(r);
    };
    im.onerror = () => cb(FOOT0);
    im.src = src;
  };
  G.ground = function (el) {
    const img = el.querySelector("img"); el.classList.add("grounded");
    el.style.transform = "translate(-50%, calc(var(--fb, .95) * -100%))";
    const set = () => G.footOf(img.src, function (r) { el.style.setProperty("--fl", r.l.toFixed(3)); el.style.setProperty("--fr", r.r.toFixed(3)); el.style.setProperty("--fb", r.b.toFixed(3)); });
    set();
    if (!el._gObs && window.MutationObserver) { el._gObs = new MutationObserver(set); el._gObs.observe(img, { attributes: true, attributeFilter: ["src"] }); }   // 손질로 그림이 바뀌면 다시 잼
  };
  // ---------- 배경 움직임(러시 · 새내기 일주일 공통) ----------
  // 배경 그림(1344×768)이 놀이판에 그려진 자리와 같은 크기의 상자(.amb-map)를 두고, 그 안에 그림 기준 %로 움직이는 것을 놓음
  //   scene: 새내기 일주일 배치(아래 맞춤, 세로 화면 150%), 아니면 러시 배치(cover · 가운데)
  const BG_W = 1344, BG_H = 768;
  function ambBox(field, scene) {
    const W = field.clientWidth, H = field.clientHeight;
    const h = scene ? (H >= W ? H * PORTRAIT_ZOOM : BG_H * Math.max(W / BG_W, H / BG_H)) : BG_H * Math.max(W / BG_W, H / BG_H), w = h * BG_W / BG_H;
    return `left:${(W - w) / 2}px;top:${scene ? H - h : (H - h) / 2}px;width:${w}px;height:${h}px`;
  }
  // 골목: 흐르는 구름 · 숨 쉬는 가로등 빛 · 저녁 빛(--dusk 0 → 1)과 켜지는 창문. 돌려준 함수 set(d)로 저녁 정도를 바꿈
  const LAMPS = [[34.4, 32], [35.4, 52.3]];                                                  // 가로등 머리(그림 기준 %)
  const WINS = [[75.6, 41, .3], [8.2, 34, .45], [96.6, 28.5, .6], [40.6, 56, .72], [93.5, 29, .84]];   // 창문(x, y, 켜지는 저녁 정도)
  //   새내기 일주일(scene)에는 가끔 하늘을 가로지르는 새 떼(.birds)와 왼쪽 나무에서 떨어지는 잎(.leaf, 그림 기준 %)도 둠
  const LEAVES = [[24, 26, 0], [30, 20, -4.5], [19, 33, -9], [27, 35, -13], [53, 41, -2.5], [56, 45, -10]];   // 잎(x, y, 시작 시각 s) — 왼쪽 나무 넷 · 가운데 나무 둘(세로 화면에서 보임)
  const BIRD = `<svg viewBox="0 0 24 10"><path d="M1 7 Q6 1 12 7 Q18 1 23 7" fill="none" stroke="#3d4b5e" stroke-width="2.2" stroke-linecap="round"/></svg>`;
  G.alleySky = function (field, scene) {
    const extra = scene ? `<div class="birds" style="--by:12%"><div class="flock"><i class="bird">${BIRD}</i><i class="bird b2">${BIRD}</i><i class="bird b3">${BIRD}</i></div></div>` : "";
    const leaves = scene ? LEAVES.map((p) => `<i class="leaf" style="left:${p[0]}%;top:${p[1]}%;animation-delay:${p[2]}s"></i>`).join("") : "";
    // 구름은 그림 속 하늘에만 보이게(img/bg/alley-sky.png 가림판, 그림과 같은 상자) → 나무 · 지붕 · 가로등 뒤로 지나감. 저녁빛(.dusk)보다 아래
    const el = G.h(`<div class="rush-sky amb" aria-hidden="true"><div class="sky-map"><div class="clouds"><i class="cloud c1"></i><i class="cloud c2"></i></div></div><i class="dusk"></i>${extra}
      <div class="sky-map">${LAMPS.map((p, i) => `<i class="lamp l${i + 1}" style="left:${p[0]}%;top:${p[1]}%"></i>`).join("")}${WINS.map((p) => `<i class="win" style="left:${p[0]}%;top:${p[1]}%"></i>`).join("")}${leaves}</div></div>`);
    field.querySelector(".bg").after(el);
    const maps = [...el.querySelectorAll(".sky-map")], map = maps[1], wins = [...el.querySelectorAll(".win")];
    // 새 떼: 한 번 지나갈 때마다 높이를 바꿈(하늘 8 ~ 22%)
    const birds = el.querySelector(".birds");
    if (birds) birds.addEventListener("animationiteration", (e) => { if (e.target === birds) birds.style.setProperty("--by", (8 + Math.random() * 14).toFixed(1) + "%"); });
    // 잎이 떨어지는 거리 = 그림 높이의 30%(px로 넣어 transform으로 움직임)
    const fit = () => { maps.forEach((m) => { m.style.cssText = ambBox(field, scene); }); if (scene) map.style.setProperty("--fall", (map.offsetHeight * 0.3).toFixed(0) + "px"); };
    fit(); G.onFieldResize(field, fit);
    return function set(d) { el.style.setProperty("--dusk", d); wins.forEach((w, i) => w.classList.toggle("on", d >= WINS[i][2])); };
  };
  // 방: 오른쪽 벽의 햇빛이 천천히 밝아졌다 흐려지고, 창문에서 들어오는 빛줄기 속에 먼지가 떠다님
  G.roomLight = function (field) {
    let dust = "";
    for (let i = 0; i < 12; i++) dust += `<i class="mote" style="left:${(20 + Math.random() * 38).toFixed(1)}%;top:${(30 + Math.random() * 50).toFixed(1)}%;--md:${(-Math.random() * 9).toFixed(2)}s;--mx:${(Math.random() * 30 - 15).toFixed(0)}px"></i>`;
    const el = G.h(`<div class="room-light amb" aria-hidden="true"><div class="sky-map"><i class="sun"></i><i class="beam"></i>${dust}</div></div>`);
    field.querySelector(".bg").after(el);
    const map = el.querySelector(".sky-map"), fit = () => { map.style.cssText = ambBox(field, true); };
    fit(); G.onFieldResize(field, fit);
    return el;
  };

  // ---------- 도구를 썼을 때 짧은 동작(새내기 일주일 손질): 헹구기 물방울 · 비우기 기울여 쏟기 · 찌그러뜨리기 눌림 · 라벨 벗겨짐 ·
  //   뚜껑 톡 · 신문지 덮기 · 가스 빠짐 · 신고필증 찰싹. 움직임 줄이기 설정이면 하지 않음 ----------
  G.toolFx = function (tid, el) {
    if (G.REDUCED) return;
    const img = el.querySelector("img"), r = el.getBoundingClientRect();
    const bits = function (n, cls, make) {
      for (let i = 0; i < n; i++) { const p = G.h(`<i class="${cls}"></i>`); G.ghostLayer.appendChild(p); make(p, i).onfinish = () => p.remove(); }
    };
    const at = (p, x, y) => { p.style.left = x + "px"; p.style.top = y + "px"; };
    if (tid === "rinse") bits(9, "drop-fx", function (p, i) { at(p, r.left + r.width * (0.25 + Math.random() * 0.5), r.top + r.height * 0.05);
      return p.animate([{ transform: "translateY(-10px)", opacity: 0 }, { opacity: 1, offset: .2 }, { transform: `translateY(${(r.height * (0.55 + Math.random() * 0.35)).toFixed(0)}px)`, opacity: 0 }],
        { duration: 650, delay: i * 45, easing: "cubic-bezier(.5,0,.9,.6)", fill: "backwards" }); });
    else if (tid === "empty") {
      img.animate([{ rotate: "0deg" }, { rotate: "-32deg", offset: .35 }, { rotate: "-32deg", offset: .7 }, { rotate: "0deg" }], { duration: 750, easing: "ease-in-out" });
      bits(6, "drop-fx", function (p, i) { at(p, r.left + r.width * 0.28, r.top + r.height * 0.3);
        return p.animate([{ transform: "translate(0,0)", opacity: 1 }, { transform: `translate(${(-10 - Math.random() * 16).toFixed(0)}px, ${(r.height * 0.6).toFixed(0)}px)`, opacity: 0 }],
          { duration: 500, delay: 220 + i * 50, easing: "cubic-bezier(.5,0,.9,.6)", fill: "backwards" }); });
    }
    else if (tid === "crush" || tid === "flatten") img.animate([{ scale: "1 1" }, { scale: "1.18 .62", offset: .35 }, { scale: ".96 1.04", offset: .7 }, { scale: "1 1" }], { duration: 520, easing: "ease-out" });
    else if (tid === "label") bits(1, "label-fx", function (p) { at(p, r.left + r.width * 0.3, r.top + r.height * 0.45);
      return p.animate([{ transform: "rotate(0deg)", opacity: 1 }, { transform: "translate(70px, -60px) rotate(120deg)", opacity: 0 }], { duration: 650, easing: "cubic-bezier(.2,.6,.4,1)" }); });
    else if (tid === "cap") img.animate([{ scale: "1" }, { scale: "1.14", offset: .4 }, { scale: "1" }], { duration: 380, easing: "ease-out" });
    else if (tid === "wrap") bits(1, "paper-fx", function (p) { Object.assign(p.style, { left: r.left + r.width * 0.12 + "px", top: r.top + r.height * 0.1 + "px", width: r.width * 0.76 + "px", height: r.height * 0.76 + "px" });
      return p.animate([{ transform: "translateY(-40px) rotate(-12deg) scale(.6)", opacity: 0 }, { transform: "rotate(4deg) scale(1)", opacity: .95, offset: .55 }, { transform: "rotate(0deg) scale(.9)", opacity: 0 }], { duration: 760, easing: "ease-out" }); });
    else if (tid === "gas") bits(6, "puff-fx", function (p, i) { at(p, r.left + r.width * (0.4 + Math.random() * 0.2), r.top + r.height * 0.08);
      return p.animate([{ transform: "translate(-50%,-50%) scale(.4)", opacity: .8 }, { transform: `translate(calc(-50% + ${(Math.random() * 50 - 25).toFixed(0)}px), calc(-50% - ${(40 + Math.random() * 40).toFixed(0)}px)) scale(1.6)`, opacity: 0 }],
        { duration: 900, delay: i * 90, easing: "ease-out", fill: "backwards" }); });
    else if (tid === "report") { const s = el.querySelector(".fix-sticker"); if (s) s.animate([{ scale: "2.4", opacity: 0 }, { scale: "1", opacity: 1 }], { duration: 340, easing: "cubic-bezier(.2,1.5,.4,1)" }); }
  };

  // 이야기 배경(1344×768): 아래 맞춤으로 바닥을 넓게 보여 줌. 세로로 긴 놀이판은 150% 크기(바닥이 놀이판 아래쪽 절반쯤)
  const PORTRAIT_ZOOM = 1.5;
  G.fitScene = function (field) {
    field.classList.add("scene");
    const fit = () => { field.querySelector(".bg").style.backgroundSize = field.clientHeight >= field.clientWidth ? `auto ${PORTRAIT_ZOOM * 100}%` : "cover"; };
    fit(); G.onFieldResize(field, fit);
  };
  // 배경 그림 높이의 g(0~1) 지점이 놀이판 위에서 몇 px 인지
  G.groundY = function (field, g) {
    const W = field.clientWidth, H = field.clientHeight;
    const dh = H >= W ? H * PORTRAIT_ZOOM : 768 * Math.max(W / 1344, H / 768);
    return H - dh + g * dh;
  };

  // ---------- 끌어다 놓기 (+ 눌러서 고르고 눌러서 놓기) ----------
  // src: { el, kind: "item"|"tool"|"card", onDrop(targetEl), onTap() , can() }
  G.selected = null;
  G.clearSelected = function () { if (G.selected) G.selected.el.classList.remove("selected"); G.selected = null; G.app.querySelectorAll(".sel-target").forEach((e) => e.classList.remove("sel-target")); };
  function accepts(target, kind) { return (target.dataset.accept || "").split(" ").includes(kind); }
  function targetAt(x, y, kind, self) {
    const list = document.elementsFromPoint(x, y);
    for (const e of list) {
      const t = e.closest && e.closest(".drop-target");
      if (t && t !== self && accepts(t, kind) && !t.classList.contains("gone")) return t;
    }
    return null;
  }
  G.draggable = function (src) {
    const el = src.el;
    let start = null, ghost = null, hot = null, offX = 0, offY = 0, pid = null;
    el.addEventListener("pointerdown", function (e) {
      if (e.button > 0 || (src.can && !src.can())) return;
      start = { x: e.clientX, y: e.clientY }; pid = e.pointerId;
      try { el.setPointerCapture(pid); } catch (err) {}
    });
    el.addEventListener("pointermove", function (e) {
      if (!start || e.pointerId !== pid) return;
      if (!ghost) {
        if (Math.hypot(e.clientX - start.x, e.clientY - start.y) < 7) return;
        const r = el.getBoundingClientRect();
        const im = el.querySelector("img, svg");
        ghost = G.h(`<div class="ghost"></div>`);
        ghost.style.width = r.width + "px"; ghost.style.height = r.height + "px";
        if (src.kind === "card") ghost.innerHTML = el.outerHTML;
        else ghost.appendChild(im ? im.cloneNode(true) : el.cloneNode(true));
        if (src.kind === "card") { const c = ghost.firstElementChild; c.style.position = "static"; c.style.transform = "none"; c.style.width = "100%"; c.style.left = "auto"; c.style.top = "auto"; }
        offX = start.x - r.left; offY = start.y - r.top;
        G.ghostLayer.appendChild(ghost); el.classList.add("dragging"); G.clearSelected();
      }
      ghost.style.transform = `translate(${e.clientX - offX}px, ${e.clientY - offY}px) scale(1.06)`;
      const t = targetAt(e.clientX, e.clientY, src.kind, el);
      if (t !== hot) { if (hot) hot.classList.remove("hot", "tool-hot"); hot = t; if (hot) hot.classList.add(src.kind === "tool" ? "tool-hot" : "hot"); }
    });
    function end(e) {
      if (!start || (e && e.pointerId !== pid)) return;
      const wasDrag = !!ghost, gr = ghost ? ghost.getBoundingClientRect() : null;   // 놓은 자리(날아 들어가는 연출의 출발점)
      if (ghost) { ghost.remove(); ghost = null; el.classList.remove("dragging"); }
      if (hot) hot.classList.remove("hot", "tool-hot");
      const t = wasDrag && e ? targetAt(e.clientX, e.clientY, src.kind, el) : null;
      hot = null; start = null;
      if (wasDrag) { if (t) src.onDrop(t, gr); }
      else if (e && e.type === "pointerup") tap();
    }
    function tap() {
      // 이미 고른 도구가 있고, 이 품목이 도구를 받으면 → 도구 쓰기
      if (G.selected && G.selected.el !== el && el.classList.contains("drop-target") && accepts(el, G.selected.kind)) { const s = G.selected; G.clearSelected(); s.onDrop(el); return; }
      if (src.onTap && src.onTap() === false) return;
      if (G.selected && G.selected.el === el) { G.clearSelected(); return; }
      G.clearSelected(); G.selected = src; el.classList.add("selected"); G.sfx("tap");
      G.app.querySelectorAll(".drop-target").forEach((t) => { if (accepts(t, src.kind) && t !== el) t.classList.add("sel-target"); });
    }
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", function () { if (ghost) { ghost.remove(); ghost = null; el.classList.remove("dragging"); } if (hot) hot.classList.remove("hot", "tool-hot"); start = null; hot = null; });
    el.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); tap(); } });
  };
  // 받는 곳: 고른 품목이 있을 때 누르면 놓기
  G.dropTarget = function (el) {
    function use() {
      if (!G.selected || G.selected.el === el || !accepts(el, G.selected.kind)) return false;
      const s = G.selected; G.clearSelected(); s.onDrop(el); return true;
    }
    el.addEventListener("click", function (e) { if (el.classList.contains("item")) return; use(); });
    el.addEventListener("keydown", function (e) { if ((e.key === "Enter" || e.key === " ") && !el.classList.contains("item")) { e.preventDefault(); use(); } });
  };

  // ---------- 손질판: 품목 여러 개 + 받는 곳 + (도구) ----------
  // opt: { field, dests (element), items:[id], destIds:[id], tools:[id]|null, onDone(mistakes), onCorrect(id), onWrong(id, reason), who }
  G.board = function (opt) {
    const field = opt.field, ctx = { mistakes: 0, left: opt.items.length, done: false, els: [] };
    const portrait = () => innerHeight > innerWidth;
    // 받는 곳
    opt.dests.innerHTML = "";
    opt.destIds.forEach(function (id) { const d = G.destEl(id); opt.dests.appendChild(d); G.dropTarget(d); });
    requestAnimationFrame(() => G.fitPlates(opt.dests)); setTimeout(() => G.fitPlates(opt.dests), 400);
    // 도구
    let tray = null;
    if (opt.tools && opt.tools.length) {
      tray = G.h(`<div class="tools"></div>`);
      opt.tools.forEach(function (tid) {
        const tel = G.toolEl(tid); tray.appendChild(tel);
        G.draggable({ el: tel, kind: "tool", onDrop: (target) => useTool(tid, target) });
      });
      field.appendChild(tray);
    }
    // 품목 (자리와 크기는 layout 이 놀이판 크기를 재서 정함)
    opt.items.forEach(function (id, i) {
      const it = ITEMS[id];
      const st = { id: id, step: 0, need: opt.tools ? (it.prep || []).length : 0, w0: Math.round((it.w || 120) * (opt.scale || 1)), j: [(Math.random() - .5) * 2, (Math.random() - .5) * 2] };
      const el = G.itemEl(id, { tag: opt.tags !== false, src: opt.srcOf && opt.srcOf(id), w: st.w0 });
      el.style.transform = "translate(-50%,-50%)";
      // 바닥에 놓는 판(새내기 일주일): 하나씩 위에서 떨어져 자리 잡고(drop), 그 뒤 시간 차를 두고 살짝 흔들림(css, --di = 순서)
      //   떨어진 뒤 drop을 떼어야 틀렸을 때 흔들기(.shake)가 막히지 않고, 흔들기가 끝나도 다시 떨어지지 않음
      //   동작 줄이기면 처음부터 붙이지 않음(애니메이션이 없어 animationend가 오지 않으므로)
      if (opt.ground != null && !G.REDUCED) { el.classList.add("drop"); el.style.setProperty("--di", i); el.addEventListener("animationend", function (e) { if (e.animationName === "itemDrop") el.classList.remove("drop"); }); }
      el.classList.add("drop-target"); el.dataset.accept = "tool";
      // 준비할 단계: '준비' 글자 + 단계 수만큼 점(한 단계 끝날 때마다 하나씩 채움)
      if (st.need && opt.tools) el.appendChild(G.h(`<span class="badge prep" title="${G.esc(G.t("ui.prep"))} ${st.need}"><em>${G.esc(G.t("ui.prep"))}</em>${"<i></i>".repeat(st.need)}</span>`));
      field.appendChild(el); st.el = el; ctx.els.push(st);
      if (opt.ground != null) G.ground(el);
      G.draggable({ el: el, kind: "item", onDrop: (target, from) => dropItem(st, target, from), can: () => !ctx.done });
      G.dropTarget(el);
      if (opt.decorate) opt.decorate(st);
    });
    // 안내문 · 단계 표시 · 도구 칸을 피해 남은 자리에 품목을 고르게 놓고, 모자라면 품목을 줄임
    function layout() {
      if (!field.isConnected || ctx.dead) return;
      const P = portrait(), f = field.getBoundingClientRect(); if (!f.width) return;
      const gap = 8, pr = field.querySelector(".prompt"), steps = field.querySelector(".steps");
      let top = 8, left = 8, right = f.width - 8, bottom = f.height - 8;
      if (pr) top = pr.getBoundingClientRect().bottom - f.top + gap;
      if (steps) { steps.style.top = top + "px"; top = steps.getBoundingClientRect().bottom - f.top + gap; }
      const stk = field.querySelector(".miss-sticker");   // 세로 화면: 가운데 미수거 스티커 아래부터
      if (stk && P) top = Math.max(top, stk.getBoundingClientRect().bottom - f.top + gap);
      if (tray) {
        if (P) { Object.assign(tray.style, { left: "50%", right: "auto", top: top + "px", bottom: "auto", transform: "translateX(-50%)", flexDirection: "row", flexWrap: "wrap", justifyContent: "center", alignContent: "flex-start", width: "94%" });
          top = tray.getBoundingClientRect().bottom - f.top + gap; }
        else { Object.assign(tray.style, { right: "1.4%", left: "auto", top: top + "px", bottom: "8px", transform: "none", flexDirection: "column", flexWrap: "wrap-reverse", justifyContent: "flex-start", alignContent: "flex-start", width: "auto" });
          right = tray.getBoundingClientRect().left - f.left - gap; }
      }
      const u = G.unit(field);
      const all = ctx.els, n = all.length; if (!n) return;
      const tagH = opt.tags !== false ? 22 : 0;
      if (opt.ground != null) return groundLayout(top, left, right, bottom, u, tagH);
      // 줄 수: 품목이 가장 크게 보이는 칸 나누기를 고름
      const bestCols = (H) => { let bc = 1, bs = -1; for (let c = 1; c <= (opt.area ? 1 : n); c++) { const rr = Math.ceil(n / c);
        const sz = Math.min((right - left) / c * 0.86, (H / rr - tagH) * 0.9); if (sz > bs + 0.5) { bs = sz; bc = c; } } return [bc, bs]; };
      // 아래 말풍선 자리: 품목이 크게 줄지 않을 만큼 높이가 남으면 비워 둠
      const band = G.talkBand(field), maxW0 = Math.max.apply(null, all.map((s) => s.w0)) * u;
      if (bestCols(bottom - top - band)[1] >= Math.min(maxW0 * 0.75, 96)) bottom -= band;
      // 낮은 가로 화면에서 품목이 한두 개면: 왼쪽 아래 말풍선 자리를 비우고 오른쪽에 놓음
      else if (!P && n <= 2 && !opt.area) left = Math.max(left, f.width * 0.54);
      const cols = bestCols(bottom - top)[0], rows = Math.ceil(n / cols);
      const cw = Math.max(10, (right - left) / cols), ch = Math.max(10, (bottom - top) / rows);
      const maxW = Math.max.apply(null, all.map((s) => s.w0)) * u;
      const k = Math.min(opt.area ? 1.5 : 1.7, cw * 0.86 / maxW, (ch - tagH) * 0.9 / maxW);   // 자리가 넉넉하면 크게
      all.forEach(function (st, i) {
        const wk = Math.max(st.w0 * k, 46 / u), size = wk * u; st.el.style.setProperty("--w", wk.toFixed(1));   // 누르는 곳 44px 이상
        let x, y;
        if (opt.area) {
          x = Math.min(Math.max(f.width * opt.area.x0 / 100, left + size / 2), right - size / 2);
          y = Math.min(Math.max(f.height * opt.area.y0 / 100, top + size / 2), bottom - size / 2 - tagH);
        } else {
          const r = Math.floor(i / cols), c = i % cols, inRow = Math.min(cols, n - r * cols);
          x = left + cw * (c + 0.5 + (cols - inRow) / 2) + st.j[0] * cw * 0.06;
          y = top + ch * (r + 0.5) - tagH / 2 + st.j[1] * ch * 0.05;
        }
        st.el.style.left = (x / f.width * 100).toFixed(2) + "%"; st.el.style.top = (y / f.height * 100).toFixed(2) + "%";
      });
    }
    // 바닥에 놓기: 품목의 발(그림 아래 끝)이 배경의 바닥(opt.ground) 아래에 오게. 줄이 여럿이면 뒷줄은 조금 작게, 앞줄이 앞에 보이게
    function groundLayout(top, left, right, bottom, u, tagH) {
      const all = ctx.els, n = all.length, f = field.getBoundingClientRect();
      const gY = G.groundY(field, opt.ground);
      const feetBot = bottom - tagH - 6, feetTop = Math.min(Math.max(gY + 8, top + 40), feetBot - 20);
      const maxW = Math.max.apply(null, all.map((s) => s.w0)) * u;
      let best = null; const cand = [];
      // 한 줄에 둘 이상(한 줄로 세로로 쌓으면 서로 겹쳐 보임), 줄 사이가 좁으면 품목을 줄여 앞뒤 줄이 크게 겹치지 않게
      for (let c = Math.min(2, n); c <= n; c++) {
        const r = Math.ceil(n / c), cw = (right - left) / c, gap = r > 1 ? (feetBot - feetTop) / (r - 1) : 0;
        const s = Math.min(cw * 0.86, (feetTop - top) / 0.95, r > 1 ? gap * 1.4 : Infinity, maxW * 1.5);
        cand.push({ s, c, r, cw, gap });
      }
      // 크기가 비슷하면(가장 큰 것의 80% 이상) 줄 수가 적은 쪽: 앞줄 물건이 뒷줄 물건과 이름표를 가리지 않게
      const top80 = Math.max.apply(null, cand.map((x) => x.s)) * 0.8;
      cand.filter((x) => x.s >= top80).forEach(function (x) { if (!best || x.r < best.r || (x.r === best.r && x.s > best.s)) best = x; });
      const k = best.s / maxW, c = best.c, r = best.r;
      all.forEach(function (st, i) {
        const ri = Math.floor(i / c), ci = i % c, inRow = Math.min(c, n - ri * c);
        const depth = r > 1 ? 0.86 + 0.14 * ri / (r - 1) : 1;
        const wk = Math.max(st.w0 * k * depth, 46 / u); st.el.style.setProperty("--w", wk.toFixed(1));
        const x = left + best.cw * (ci + 0.5 + (c - inRow) / 2) + st.j[0] * best.cw * 0.05;
        const y = r > 1 ? feetTop + best.gap * ri : feetTop + (feetBot - feetTop) * 0.6;
        st.el.style.left = (x / f.width * 100).toFixed(2) + "%"; st.el.style.top = (y / f.height * 100).toFixed(2) + "%";
        st.el.style.zIndex = 2 + ri;
      });
    }
    G.onFieldResize(field, layout);
    layout(); setTimeout(layout, 350);
    function stOf(el) { return ctx.els.find((s) => s.el === el); }
    function useTool(tid, target) {
      const st = stOf(target); if (!st || st.gone) return;
      const it = ITEMS[st.id];
      const r = st.el.getBoundingClientRect(), fr = field.getBoundingClientRect();
      if (st.step < st.need && it.prep[st.step] === tid) {
        st.step++;
        if (it.states) st.el.querySelector("img").src = G.img(it.states[st.step]);
        if (tid === "report") st.el.appendChild(G.h(`<span class="fix-sticker">${G.t("plate.sticker")}</span>`));
        G.toolFx(tid, st.el);
        const b = st.el.querySelector(".badge");
        if (b) { if (st.step >= st.need) b.remove(); else b.querySelectorAll("i").forEach((d, j) => d.classList.toggle("on", j < st.step)); }
        G.flash(st.el, "ok"); G.sfx("step");
        G.float(field, r.left - fr.left + r.width / 2, r.top - fr.top, "✓ " + G.esc(G.t("tool." + tid)));
        if (opt.onStep) opt.onStep(st, tid);
        if (st.step >= st.need) G.talk(field, "girl", `<b>${G.esc(G.itemName(st.id))}</b> — ${G.esc(G.t("prep.done"))}`, { ms: 2600 });
        return;
      }
      ctx.mistakes++; G.sfx("no"); G.flash(st.el, "shake");
      const reason = tid === it.trapTool ? G.t("bad." + tid)
        : st.step >= st.need ? G.t("prep.done")
        : G.t("ui.wrongStep", { tool: G.t("tool." + tid) }) + " " + G.t("ui.needPrep", { step: G.t("tool." + it.prep[st.step]) });
      G.talk(field, "boy-stop", G.esc(reason), { stop: true, ms: 3600 });
      if (opt.onWrong) opt.onWrong(st.id, reason);
    }
    function dropItem(st, target, from) {
      if (!target.classList.contains("dest")) return;
      const did = target.dataset.dest, it = ITEMS[st.id];
      if (G.fits(st.id, did) && st.step >= st.need) {
        G.flyTo(from || st.el.getBoundingClientRect(), st.el.querySelector("img").src, target, DEST[did].color);
        st.gone = true; st.el.classList.add("gone"); G.sfx("ok"); G.bookAdd(st.id);
        G.talk(field, Math.random() < .5 ? "girl-laugh" : "boy", `<b>${G.t("ui.great")}</b> ${G.esc(G.t("why." + st.id))}`, { ms: 3200 });
        if (opt.onCorrect) opt.onCorrect(st.id);
        ctx.left--;
        if (ctx.left <= 0 && !ctx.done) { ctx.done = true; setTimeout(() => { ctx.dead = true; opt.onDone(ctx.mistakes); }, 1200); }
        return;
      }
      ctx.mistakes++; G.sfx("no"); G.flash(target, "no"); G.flash(st.el, "shake");
      let reason;
      if (G.fits(st.id, did)) reason = G.t("ui.needPrep", { step: G.t("tool." + it.prep[st.step]) });
      else reason = G.t("why." + st.id);
      G.talk(field, "boy-stop", G.esc(reason), { stop: true, ms: 4200 });
      if (opt.onWrong) opt.onWrong(st.id, reason);
    }
    ctx.relayout = layout;
    return ctx;
  };
  // 놀이판 안 품목 자리(%) — 말풍선(왼쪽 아래) · 도구 칸(오른쪽 또는 위)을 비켜서
  G.spots = function (n, hasTray, portrait, area) {
    const a = area || (portrait ? { x0: 12, x1: 88, y0: hasTray ? 36 : 22, y1: 70 } : { x0: hasTray ? 22 : 16, x1: hasTray ? 80 : 86, y0: 32, y1: 72 });
    const cols = portrait ? Math.min(n, 3) : Math.min(n, n > 6 ? 5 : n > 3 ? Math.ceil(n / 2) : n);
    const rows = Math.ceil(n / cols);
    const out = [];
    for (let i = 0; i < n; i++) {
      const r = Math.floor(i / cols), c = i % cols, inRow = Math.min(cols, n - r * cols);
      const x = a.x0 + (a.x1 - a.x0) * ((c + 0.5 + (cols - inRow) / 2) / cols);
      const y = rows === 1 ? (a.y0 + a.y1) / 2 : a.y0 + (a.y1 - a.y0) * (r / (rows - 1));
      out.push([x + (Math.random() - .5) * 3, y + (Math.random() - .5) * 3]);
    }
    return out;
  };
  G.shuffle = function (a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  // ---------- 화면 바꾸기 ----------
  G.screens = {};
  G.current = null;
  G.go = function (name, arg) {
    if (G.current && G.current.stop) G.current.stop();
    G.clearSelected();
    G.app.innerHTML = ""; G.ghostLayer.innerHTML = "";
    G.current = G.screens[name](arg) || null;
  };
  // 놀이 화면 뼈대: 머리 막대 + 놀이판 + 받는 곳 줄
  G.frame = function (title, chips, opt) {
    const hud = G.hud(title, chips, opt);
    const field = G.h(`<main class="field"><div class="bg"></div></main>`);
    const dests = G.h(`<div class="dests"></div>`);
    G.app.append(hud, field, dests);
    if (opt && opt.bg) field.querySelector(".bg").style.backgroundImage = `url(${G.img(opt.bg)})`;
    return { hud, field, dests };
  };
  G.prompt = function (field, text) {
    let p = field.querySelector(".prompt");
    if (!p) { p = G.h(`<div class="prompt"></div>`); field.appendChild(p); }
    p.textContent = text; return p;
  };
})();
