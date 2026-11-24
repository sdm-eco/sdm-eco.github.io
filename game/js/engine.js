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
    cal: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="10" width="34" height="30" rx="4"/><path d="M7 18h34M16 6v8M32 6v8"/><path d="M18 28l4 4 8-8"/></svg>'
  };
  G.star = (on) => `<svg viewBox="0 0 24 24"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z" fill="${on ? "#f2b632" : "#e3ebe5"}" stroke="${on ? "#c98a00" : "#cfdbd2"}" stroke-width="1.2" stroke-linejoin="round"/></svg>`;
  G.stars = (n, of) => Array.from({ length: of || 3 }, (_, i) => G.star(i < n)).join("");

  // ---------- 소리(파일 없이 짧은 신호음) ----------
  let actx = null;
  G.soundOn = store.sound !== false;
  G.toggleSound = function () { G.soundOn = !G.soundOn; store.sound = G.soundOn; G.save(); return G.soundOn; };
  function tone(freq, start, dur, type, vol) {
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type || "sine"; o.frequency.setValueAtTime(freq, actx.currentTime + start);
    g.gain.setValueAtTime(0.0001, actx.currentTime + start);
    g.gain.exponentialRampToValueAtTime(vol || 0.12, actx.currentTime + start + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + start + dur);
    o.connect(g); g.connect(actx.destination); o.start(actx.currentTime + start); o.stop(actx.currentTime + start + dur + 0.02);
  }
  G.sfx = function (kind) {
    if (!G.soundOn) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === "suspended") actx.resume();
      if (kind === "ok") { tone(660, 0, 0.12, "triangle"); tone(990, 0.08, 0.16, "triangle"); }
      else if (kind === "no") { tone(220, 0, 0.18, "square", 0.05); tone(180, 0.1, 0.22, "square", 0.05); }
      else if (kind === "tap") tone(520, 0, 0.06, "triangle", 0.08);
      else if (kind === "step") { tone(560, 0, 0.08, "triangle"); tone(700, 0.06, 0.1, "triangle"); }
      else if (kind === "combo") [660, 830, 990, 1320].forEach((f, i) => tone(f, i * 0.06, 0.14, "triangle", 0.09));
      else if (kind === "win") [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.3, "triangle", 0.1));
    } catch (e) {}
  };

  // ---------- 도감 ----------
  G.bookAdd = function (id) { if (ITEMS[id] && ITEMS[id].dest && !store.book[id]) { store.book[id] = 1; G.save(); } };
  // 러시 · 새내기 일주일에서 맞힐 수 있는 품목만 (유리병 · 건전지는 두 놀이에 나오지 않아 도감에서 뺌)
  G.BOOK_ORDER = ["banana", "tangerine", "leftover", "bone", "pit", "egg", "shell", "pineapple", "tissue", "receipt", "chopsticks", "toothbrush",
    "pet", "can", "carton", "brokenglass", "butane", "pills", "syrup", "clothes", "blanket", "chair", "fridge", "fan"];
  G.openBook = function () {
    const got = G.BOOK_ORDER.filter((id) => store.book[id]).length;
    const pages = G.BOOK_ORDER.map(function (id) {
      const on = !!store.book[id], d = DEST[ITEMS[id].dest];
      return `<div class="pg ${on ? "" : "locked"}" data-grp="${d.grp}"><img src="${G.img(ITEMS[id].img)}" alt=""><b>${on ? G.esc(G.itemName(id)) : "?"}</b>${on ? `<em>${G.esc(G.destName(ITEMS[id].dest))}</em>` : ""}</div>`;
    }).join("");
    G.panel(`<h2>${G.t("ui.book")}</h2><p class="lead">${G.t("ui.bookLead")} ${G.t("ui.got", { n: got, t: G.BOOK_ORDER.length })}</p><div class="book">${pages}</div>`,
      [{ label: G.t("ui.close"), primary: true }]);
  };

  // ---------- 겹창 ----------
  G.panel = function (html, buttons, opt) {
    const ov = G.h(`<div class="overlay" role="dialog" aria-modal="true"><div class="panel">${html}<div class="row"></div></div></div>`);
    const row = ov.querySelector(".row");
    (buttons || []).forEach(function (b) {
      const btn = G.h(`<button class="btn ${b.primary ? "" : "ghost-btn"}">${b.label}</button>`);
      btn.addEventListener("click", function () { G.sfx("tap"); if (!b.keep) ov.remove(); if (b.on) b.on(); });
      row.appendChild(btn);
    });
    (opt && opt.parent || G.app).appendChild(ov);
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
      else if (a === "pause" && opt.onPause) { opt.onPause(true); G.panel(`<h2>${G.t("ui.pause")}</h2>`, [{ label: G.t("ui.resume"), primary: true, on: () => opt.onPause(false) }]); }
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
  G.talk = function (field, who, html, opt) {
    opt = opt || {};
    let el = field.querySelector(".talk");
    if (!el) { el = G.h(`<div class="talk hide"><div class="face"><img alt=""></div><div class="say"></div></div>`); field.appendChild(el); }
    el.querySelector(".face img").src = G.img(FACE[who] || FACE.girl);
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
      const wasDrag = !!ghost;
      if (ghost) { ghost.remove(); ghost = null; el.classList.remove("dragging"); }
      if (hot) hot.classList.remove("hot", "tool-hot");
      const t = wasDrag && e ? targetAt(e.clientX, e.clientY, src.kind, el) : null;
      hot = null; start = null;
      if (wasDrag) { if (t) src.onDrop(t); }
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
    opt.items.forEach(function (id) {
      const it = ITEMS[id];
      const st = { id: id, step: 0, need: opt.tools ? (it.prep || []).length : 0, w0: Math.round((it.w || 120) * (opt.scale || 1)), j: [(Math.random() - .5) * 2, (Math.random() - .5) * 2] };
      const el = G.itemEl(id, { tag: opt.tags !== false, src: opt.srcOf && opt.srcOf(id), w: st.w0 });
      el.style.transform = "translate(-50%,-50%)";
      el.classList.add("drop-target"); el.dataset.accept = "tool";
      if (st.need && opt.tools) el.appendChild(G.h(`<span class="badge">${st.need}</span>`));
      field.appendChild(el); st.el = el; ctx.els.push(st);
      G.draggable({ el: el, kind: "item", onDrop: (target) => dropItem(st, target), can: () => !ctx.done });
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
        const b = st.el.querySelector(".badge");
        if (b) { if (st.step >= st.need) b.remove(); else b.textContent = st.need - st.step; }
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
    function dropItem(st, target) {
      if (!target.classList.contains("dest")) return;
      const did = target.dataset.dest, it = ITEMS[st.id];
      if (did === it.dest && st.step >= st.need) {
        st.gone = true; st.el.classList.add("gone"); G.flash(target, "ok"); G.sfx("ok"); G.bookAdd(st.id);
        G.talk(field, Math.random() < .5 ? "girl-laugh" : "boy", `<b>${G.t("ui.great")}</b> ${G.esc(G.t("why." + st.id))}`, { ms: 3200 });
        if (opt.onCorrect) opt.onCorrect(st.id);
        ctx.left--;
        if (ctx.left <= 0 && !ctx.done) { ctx.done = true; setTimeout(() => { ctx.dead = true; opt.onDone(ctx.mistakes); }, 1200); }
        return;
      }
      ctx.mistakes++; G.sfx("no"); G.flash(target, "no"); G.flash(st.el, "shake");
      let reason;
      if (did === it.dest) reason = G.t("ui.needPrep", { step: G.t("tool." + it.prep[st.step]) });
      else if (did === "other") reason = G.t("why.other");
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
