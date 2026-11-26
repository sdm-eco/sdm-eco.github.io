// 첫 화면: 놀이 방식 고르기(1 분리배출 러시 = 시안 A · 2 서대문 새내기 일주일 = 시안 C) · 언어 · 소리
(function () {
  // 미리보기 그림(놀이 화면을 줄여 그린 것): 러시 = 골목 + 벨트 위 품목, 새내기 일주일 = 방 + 두 캐릭터 + 바닥의 쓰레기
  const PREVIEW = {
    rush: () => `<span class="pv-bg" style="background-image:url(${G.img("bg/alley.webp")})"></span>
      <span class="belt"><i class="belt-top"></i><i class="belt-face"></i></span>
      <span class="pv-it" style="left:16%"><img src="${G.img("item/new/banana.webp")}" alt=""></span>
      <span class="pv-it tall" style="left:44%"><img src="${G.img("item/pet/bottle-full.webp")}" alt=""><span class="badge tap">${G.ICON.hand}</span></span>
      <span class="pv-it tall" style="left:72%"><img src="${G.img("item/can/can.webp")}" alt=""></span>
      <span class="pv-combo"><b>8</b>${G.esc(G.t("ui.combo"))}</span>`,
    story: () => `<span class="pv-bg" style="background-image:url(${G.img("bg/room.webp")})"></span>
      <span class="pv-it low" style="left:14%"><img src="${G.img("item/food/bone.webp")}" alt=""></span>
      <span class="pv-it low" style="left:30%"><img src="${G.img("item/new/banana.webp")}" alt=""></span>
      <span class="pv-chars"><img src="${G.img("char/girl-smile.webp")}" alt=""><img src="${G.img("char/boy-smile.webp")}" alt=""></span>
      <span class="pv-days">${[1, 2, 3, 4, 5, 6].map((n) => `<i>${n}</i>`).join("")}<i class="q">Q</i></span>`
  };
  G.screens.title = function () {
    const modes = [["rush", "1"], ["story", "2"]];
    const el = G.h(`<div class="title-screen">
      <div class="title-left">
        <img class="brand-title" src="${G.img("brand/title.webp")}" alt="서대문구 분리배출 교육">
        <h1>${G.esc(G.t("app.title"))}</h1>
        <p>${G.esc(G.t("app.lead"))}</p>
        <div class="langs" role="group" aria-label="${G.t("ui.lang")}">${G.LANGS.map((l) => `<button data-l="${l}" aria-pressed="${l === G.lang}">${G.LANG_LABEL[l]}</button>`).join("")}</div>
        <div class="title-chars"><img src="${G.img("char/girl-smile.webp")}" alt=""><img src="${G.img("char/boy-smile.webp")}" alt=""></div>
      </div>
      <div class="modes" aria-label="${G.t("app.pick")}">
        <h2 style="font-size:1em;color:var(--muted);font-weight:800">${G.t("app.pick")}</h2>
        <div class="mode-tiles">${modes.map(([m, k]) => `<button class="mode-card" data-m="${m}"><span class="pv" aria-hidden="true">${PREVIEW[m]()}</span>
          <span class="mt"><span class="mk">${k}</span><span><h3>${G.esc(G.t("mode." + m))}</h3><p>${G.esc(G.t("mode." + m + ".d"))}</p></span><span class="go">${G.ICON.go}</span></span></button>`).join("")}</div>
      </div></div>`);
    const foot = G.h(`<footer class="title-foot"><span style="display:flex;align-items:center;gap:8px"><img src="${G.img("brand/logo.png")}" alt="">${G.esc(G.t("app.sub"))}</span>
      <span style="display:flex;gap:8px"><button class="icon-btn" data-a="book" aria-label="${G.t("ui.book")}">${G.ICON.book}</button>
      <button class="icon-btn" data-a="sound" aria-pressed="${G.soundOn}" aria-label="${G.t("ui.sound")}">${G.ICON.sound}</button></span></footer>`);
    G.app.append(el, foot);
    el.querySelectorAll(".langs button").forEach((b) => b.addEventListener("click", () => { G.setLang(b.dataset.l); G.sfx("tap"); G.go("title"); }));
    el.querySelectorAll(".mode-card").forEach((b) => b.addEventListener("click", () => { G.sfx("tap"); G.go(b.dataset.m); }));
    foot.addEventListener("click", function (e) {
      const b = e.target.closest("[data-a]"); if (!b) return;
      if (b.dataset.a === "book") G.openBook();
      else { b.setAttribute("aria-pressed", G.toggleSound()); G.sfx("tap"); }
    });
    return {};
  };
  // 너무 작은 화면(휴대폰에서 홈페이지 안 게임 칸 등): 전체 화면으로 바꾸도록 안내
  function gate() {
    const small = innerHeight < 300 || innerWidth < 300;
    let g = document.getElementById("gate");
    if (!small) { if (g) g.remove(); return; }
    if (g) return;
    g = G.h(`<div id="gate" role="dialog" aria-modal="true"><div class="in"><img src="${G.img("brand/title.webp")}" alt="서대문구 분리배출 교육">
      <b>${G.t("gate.t")}</b><p>${G.t("gate.p")}</p><div class="row"><button class="btn" data-g="full">${G.t("gate.full")}</button></div></div></div>`);
    // 홈페이지 게임 칸은 전체 화면을 허용함(새 창 열기는 막혀 있어 쓰지 않음)
    g.addEventListener("click", function (e) {
      if (!e.target.closest("[data-g]")) return;
      const d = document.documentElement, fs = d.requestFullscreen || d.webkitRequestFullscreen;
      if (fs) { try { const r = fs.call(d); if (r && r.catch) r.catch(() => {}); } catch (err) {} }
    });
    document.body.appendChild(g);
  }
  addEventListener("resize", gate); gate();
  // 바로 열기: ?mode=rush|story (&day=0~6) — 홈페이지 게임 고르기 창 · 화면 캡처용
  const q = new URLSearchParams(location.search);
  const m = q.get("mode");
  if (m === "story" && /^[0-6]$/.test(q.get("day") || "")) G.go("story", +q.get("day"));
  else if (m === "rush" || m === "story") G.go(m);
  else G.go("title");
})();
