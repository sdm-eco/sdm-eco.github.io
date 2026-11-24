// 시안 A · 분리배출 러시 — 벨트 위로 움직이는 쓰레기를 알맞은 수거함에, 90초 · 콤보 · 피버 · 미수거 스티커 3장
(function () {
  const { ITEMS } = window.GAMEDATA;
  const DESTS = ["general", "food", "pet", "can", "carton", "sack"];
  // 품목과 뽑힐 무게. tap: 눌러서 하는 손질(라벨 떼기 · 찌그러뜨리기 · 감싸기 · 가스 빼기)
  const POOL = [["banana", 3], ["tangerine", 3], ["leftover", 2], ["bone", 3], ["pit", 2], ["egg", 2], ["shell", 2], ["pineapple", 2],
    ["tissue", 2], ["receipt", 1], ["chopsticks", 1], ["toothbrush", 1], ["pet", 3], ["can", 3], ["carton", 2], ["brokenglass", 2], ["butane", 1]];
  const TAP = { pet: "item/pet/crushed.webp", can: "item/can/crushed.webp", carton: "item/carton/flat.webp", brokenglass: "item/new/wrapped.webp", butane: null };
  const TIME = 90, FEVER_AT = 8, MAX_STICKERS = 3;

  function pick() {
    const total = POOL.reduce((s, p) => s + p[1], 0); let r = Math.random() * total;
    for (const p of POOL) { r -= p[1]; if (r <= 0) return p[0]; }
    return POOL[0][0];
  }

  G.screens.rush = function () {
    const chips = `<span class="chip"><span class="k">${G.t("ui.score")}</span><b data-v="score">0</b></span>
      <span class="chip"><span class="k">${G.t("ui.combo")}</span><b data-v="combo">0</b></span>
      <span class="chip">${G.ICON.clock}<b data-v="time">${TIME}</b></span>
      <span class="chip" title="${G.t("ui.stickers")}"><span class="k">${G.t("ui.stickers")}</span><span class="stickers" data-v="stk">${"<i></i>".repeat(MAX_STICKERS)}</span></span>`;
    let paused = true, running = false;
    const S = { score: 0, combo: 0, best: 0, ok: 0, bad: 0, stickers: 0, time: TIME, fever: false, list: [], review: [], spawnIn: 0.4, raf: 0, last: 0, elapsed: 0 };
    const fr = G.frame(G.t("mode.rush"), chips, { pause: true, bg: "bg/alley.webp", onPause: (p) => { if (running) { paused = p; if (!p) S.last = performance.now(); } }, onLeave: () => stop() });
    const field = fr.field, hud = fr.hud; field.classList.add("rush");
    const belt = G.h(`<div class="belt"></div>`); field.appendChild(belt);
    DESTS.forEach(function (id) { const d = G.destEl(id); fr.dests.appendChild(d); G.dropTarget(d); });
    requestAnimationFrame(() => G.fitPlates(fr.dests)); setTimeout(() => G.fitPlates(fr.dests), 400);
    const v = (k) => hud.querySelector(`[data-v="${k}"]`);

    function setHud() {
      v("score").textContent = S.score; v("combo").textContent = S.combo; v("time").textContent = Math.ceil(S.time);
      v("stk").innerHTML = Array.from({ length: MAX_STICKERS }, (_, i) => `<i class="${i < S.stickers ? "on" : ""}"></i>`).join("");
    }
    function setFever(on) {
      if (S.fever === on) return; S.fever = on; belt.classList.toggle("fever", on);
      const b = field.querySelector(".fever-banner"); if (b) b.remove();
      if (on) { field.appendChild(G.h(`<div class="fever-banner">${G.t("rush.fever")}</div>`)); G.sfx("combo"); }
    }
    function spawn() {
      const id = pick(), it = ITEMS[id];
      const st = { id, x: -8, prepped: !(id in TAP), el: G.itemEl(id, { tag: true, w: Math.round(Math.max((it.w || 120) * (innerHeight > innerWidth ? 1.45 : 0.95), 48 / G.unit(field))) }) };   // 누르는 곳 44px 이상
      st.el.style.left = st.x + "%"; st.el.style.top = "calc(30% + var(--u) * 75)"; st.el.style.transform = "translate(-50%, -54%)";
      if (!st.prepped) st.el.appendChild(G.h(`<span class="badge" title="${G.t("rush.tap")}">!</span>`));
      field.appendChild(st.el); S.list.push(st);
      G.draggable({ el: st.el, kind: "item", can: () => !paused && !st.gone, onDrop: (t) => drop(st, t), onTap: () => tapPrep(st) });
    }
    function tapPrep(st) {
      if (paused || st.prepped) return true;     // 손질이 끝났으면 눌러서 고르기
      st.prepped = true; G.sfx("step");
      if (TAP[st.id]) st.el.querySelector("img").src = G.img(TAP[st.id]);
      const b = st.el.querySelector(".badge"); if (b) b.remove();
      G.flash(st.el, "ok");
      return false;
    }
    function drop(st, target) {
      if (!target.classList.contains("dest") || st.gone) return;
      const it = ITEMS[st.id], did = target.dataset.dest;
      const r = target.getBoundingClientRect(), f = field.getBoundingClientRect();
      const fx = r.left - f.left + r.width / 2, fy = Math.max(30, r.top - f.top - 10);
      if (did === it.dest && st.prepped) {
        st.gone = true; st.el.classList.add("gone"); setTimeout(() => st.el.remove(), 300);
        S.combo++; S.ok++; S.best = Math.max(S.best, S.combo);
        const pts = (100 + Math.min(S.combo, 20) * 10) * (S.fever ? 2 : 1);
        S.score += pts; G.float(field, fx, fy, "+" + pts); G.flash(target, "ok"); G.sfx(S.combo % 5 === 0 ? "combo" : "ok"); G.bookAdd(st.id);
        if (S.combo >= FEVER_AT) setFever(true);
        if (S.combo % 5 === 0) G.talk(field, "girl-laugh", `<b>${S.combo} ${G.t("ui.combo")}!</b> ${G.t("ui.great")}`, { ms: 1600 });
      } else {
        S.bad++; S.combo = 0; S.stickers++; setFever(false);
        const reason = did === it.dest ? G.t("ui.needPrep", { step: (it.prep || []).map((p) => G.t("tool." + p)).join(" → ") }) : G.t("why." + st.id);
        S.review.push({ id: st.id, why: reason });
        G.float(field, fx, fy, G.t("ui.stop"), true); G.flash(target, "no"); G.flash(st.el, "shake"); G.sfx("no");
        G.talk(field, "boy-stop", G.esc(reason), { stop: true, ms: 3200 });
        if (S.stickers >= MAX_STICKERS) setTimeout(finish, 600);
      }
      setHud();
    }
    function loop(now) {
      S.raf = requestAnimationFrame(loop);
      if (paused) { S.last = now; return; }
      const dt = Math.min(0.05, (now - S.last) / 1000); S.last = now;
      S.time -= dt; S.elapsed += dt;
      const k = Math.min(1, S.elapsed / TIME);
      const speed = (100 / (9.5 - 4.5 * k)) * (S.fever ? 1.15 : 1);    // 화면을 건너는 데 9.5초 → 5초
      S.spawnIn -= dt;
      if (S.spawnIn <= 0 && S.list.filter((s) => !s.gone).length < 5) { spawn(); S.spawnIn = 1.8 - 0.9 * k; }
      S.list.forEach(function (st) {
        if (st.gone || st.el.classList.contains("dragging") || st.el.classList.contains("selected")) return;
        st.x += speed * dt; st.el.style.left = st.x + "%";
        if (st.x > 106) {
          st.gone = true; st.el.remove(); S.combo = 0; setFever(false);
          S.review.push({ id: st.id, why: G.t("rush.miss") + " — " + G.t("why." + st.id) });
          G.float(field, field.clientWidth - 70, field.clientHeight * 0.3, G.t("rush.miss"), true);
        }
      });
      S.list = S.list.filter((s) => !s.gone || s.el.isConnected);
      if (Math.ceil(S.time) !== Math.ceil(S.time + dt)) setHud();
      if (S.time <= 0) finish();
    }
    function begin() {
      let n = 3;
      const cd = G.h(`<div class="countdown">${n}</div>`); field.appendChild(cd); G.sfx("tap");
      const iv = setInterval(function () {
        n--; if (n > 0) { cd.textContent = n; G.sfx("tap"); return; }
        clearInterval(iv); cd.remove(); running = true; paused = false; S.last = performance.now(); S.raf = requestAnimationFrame(loop);
        G.talk(field, "girl", G.esc(G.t("ui.tapItem")), { ms: 3000 });
      }, 700);
    }
    function finish() {
      if (!running) return; running = false; paused = true; cancelAnimationFrame(S.raf); setFever(false); G.clearSelected();
      S.list.forEach((s) => s.el.remove());
      const acc = S.ok + S.bad ? Math.round(S.ok / (S.ok + S.bad) * 100) : 0;
      // 결과 제목은 놀이 이름(분리배출 러시). 점수가 높으면 그 아래에 칭호(모범 주민 · 분리배출 히어로)를 붙임
      const grade = S.score >= 9000 && S.stickers < MAX_STICKERS ? "rush.g3" : S.score >= 4000 ? "rush.g2" : "";
      G.store.rushBest = Math.max(G.store.rushBest || 0, S.score); G.save(); G.sfx("win");
      const seen = {}, rev = S.review.filter((r) => !seen[r.id] && (seen[r.id] = 1)).slice(0, 6);
      const revHtml = rev.length ? `<ul class="review">${rev.map((r) => `<li><img src="${G.img(ITEMS[r.id].img)}" alt=""><div><b>${G.esc(G.itemName(r.id))} → ${G.esc(G.destName(ITEMS[r.id].dest))}</b><span>${G.esc(r.why)}</span></div></li>`).join("")}</ul>`
        : `<p class="lead">${G.t("rush.noReview")}</p>`;
      G.panel(`<h2>${G.t("mode.rush")}</h2>${grade ? `<p class="lead"><b>${G.t(grade)}</b></p>` : ""}
        <div class="stat-grid"><div class="stat"><span class="k">${G.t("ui.score")}</span><b>${S.score}</b></div>
        <div class="stat"><span class="k">${G.t("ui.best")}</span><b>${S.best}</b></div>
        <div class="stat"><span class="k">${G.t("ui.acc")}</span><b>${acc}%</b></div>
        <div class="stat"><span class="k">${G.t("ui.stickers")}</span><b>${S.stickers}</b></div></div>
        <h3 style="text-align:left;margin-top:.4em">${G.t("ui.review")}</h3>${revHtml}`,
        [{ label: G.t("ui.retry"), primary: true, on: () => G.go("rush") }, { label: G.t("ui.home"), on: () => G.go("title") }]);
    }
    function stop() { running = false; paused = true; cancelAnimationFrame(S.raf); }
    setHud();
    G.panel(`<h2>${G.t("mode.rush")}</h2><p class="lead">${G.t("rush.how")}</p>`, [{ label: G.t("ui.start"), primary: true, on: begin }]);
    return { stop };
  };
})();
