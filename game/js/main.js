// 첫 화면: 놀이 방식 고르기(1 분리배출 러시 = 시안 A · 2 서대문 새내기 일주일 = 시안 C) · 언어 · 소리
(function () {
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
        ${modes.map(([m, k]) => `<button class="mode-card" data-m="${m}"><span class="mk">${k}</span>
          <span><h3>${G.esc(G.t("mode." + m))}</h3><p>${G.esc(G.t("mode." + m + ".d"))}</p></span><span class="go">${G.ICON.go}</span></button>`).join("")}
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
