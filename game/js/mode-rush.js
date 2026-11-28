// 시안 A · 분리배출 러시 — 벨트 위로 움직이는 쓰레기를 알맞은 수거함에, 90초 · 콤보 · 피버 · 미수거 스티커 3장
(function () {
  const { ITEMS, DEST } = window.GAMEDATA;
  const DESTS = ["general", "food", "pet", "can", "carton", "sack"];
  // 품목과 뽑힐 무게. tap: 눌러서 하는 손질(라벨 떼기 · 찌그러뜨리기 · 감싸기 · 가스 빼기)
  const POOL = [["banana", 3], ["tangerine", 3], ["leftover", 2], ["bone", 3], ["pit", 2], ["egg", 2], ["shell", 2], ["pineapple", 2],
    ["tissue", 2], ["receipt", 1], ["chopsticks", 1], ["toothbrush", 1], ["pet", 3], ["can", 3], ["carton", 2], ["brokenglass", 2], ["butane", 1]];
  const TAP = { pet: "item/pet/crushed.webp", can: "item/can/crushed.webp", carton: "item/carton/flat.webp", brokenglass: "item/new/wrapped.webp", butane: null };
  const TIME = 90, FEVER_AT = 8, MAX_STICKERS = 3, HURRY = 10;
  // 칭호: 점수대마다 하나씩(낮은 점수에도) + 캐릭터 표정 · 한마디(rush.c0~c3). 히어로는 스티커 3장을 다 받지 않았을 때만
  const GRADES = [{ min: 9000, k: "g3", face: "girl-laugh" }, { min: 4000, k: "g2", face: "boy-surprise" }, { min: 2000, k: "g1", face: "girl" }, { min: 0, k: "g0", face: "boy" }];

  function pick() {
    const total = POOL.reduce((s, p) => s + p[1], 0); let r = Math.random() * total;
    for (const p of POOL) { r -= p[1]; if (r <= 0) return p[0]; }
    return POOL[0][0];
  }
  const tapBadge = () => `<span class="badge tap" title="${G.esc(G.t("rush.tap"))}">${G.ICON.hand}<em>${G.esc(G.t("rush.tapShort"))}</em></span>`;

  G.screens.rush = function () {
    // 휴대폰에서는 칩 이름이 빠지므로 그림(별 = 점수, 번개 = 콤보, 시계 = 남은 시간)으로 구분
    const chips = `<span class="chip" title="${G.t("ui.score")}">${G.ICON.star}<span class="k">${G.t("ui.score")}</span><b data-v="score">0</b></span>
      <span class="chip" title="${G.t("ui.combo")}">${G.ICON.bolt}<span class="k">${G.t("ui.combo")}</span><b data-v="combo">0</b></span>
      <span class="chip" data-c="time" title="${G.t("ui.time")}">${G.ICON.clock}<b data-v="time">${TIME}</b></span>
      <span class="chip" title="${G.t("ui.stickers")}"><span class="k">${G.t("ui.stickers")}</span><span class="stickers" data-v="stk">${"<i></i>".repeat(MAX_STICKERS)}</span></span>`;
    let paused = true, running = false, counting = false, cdHeld = false;
    const S = { score: 0, combo: 0, best: 0, ok: 0, bad: 0, stickers: 0, stkShown: 0, time: TIME, sec: TIME, fever: false, list: [], review: [], spawnIn: 0.4, raf: 0, last: 0, elapsed: 0, cd: 0 };
    // 멈춤 · 도감: 놀이 중이면 시간을 멈추고, 3 · 2 · 1 카운트다운 중이면 카운트다운을 멈췄다가 계속할 때 3부터 다시 셈
    //   (예전에는 카운트다운 중 멈춤이 무시돼 멈춤 창이 떠 있는데 게임이 시작됨)
    function onPause(p) {
      if (counting && p) { clearInterval(S.cd); counting = false; cdHeld = true; const c = field.querySelector(".countdown"); if (c) c.remove(); return; }
      if (cdHeld && !p) { cdHeld = false; begin(); return; }
      if (running) { paused = p; field.classList.toggle("halt", p); if (!p) S.last = performance.now(); if (p) G.music.stop(true); else G.music.resume(); }
    }
    // 멈춤 창(11/28, ChatGPT 시안): '잠깐 멈춤' · 지금 상태 4칸(점수 · 콤보 · 남은 시간 · 미수거 스티커) · 캐릭터 팁 · 계속하기 크게
    //   팁: 이번 판에 틀린 품목이 있으면 마지막으로 틀린 것, 없으면 러시에 나오는 품목 하나의 버리는 법(why.*)
    function pausePanel() {
      const tip = S.review.length ? S.review[S.review.length - 1].id : POOL[Math.floor(Math.random() * POOL.length)][0];
      const stk = Array.from({ length: MAX_STICKERS }, (_, i) => `<i class="${i < S.stickers ? "on" : ""}"></i>`).join("");
      const num = (n) => n.toLocaleString(G.lang === "zh" ? "zh-CN" : G.lang);
      G.panel(`<img class="pz-face" src="${G.face("girl-laugh")}" alt="">
        ${G.ttl("pause", G.t("ui.paused"))}
        <div class="pz-stats">
          <div><span class="ic">${G.ICON.star}</span><span class="k">${G.t("ui.score")}</span><b>${num(S.score)}</b></div>
          <div><span class="ic">${G.ICON.bolt}</span><span class="k">${G.t("ui.combo")}</span><b>${S.combo}</b></div>
          <div><span class="ic t">${G.ICON.clock}</span><span class="k">${G.t("ui.time")}</span><b>${Math.max(0, Math.ceil(S.time))}<small>${G.t("ui.sec")}</small></b></div>
          <div><span class="stickers" aria-hidden="true">${stk}</span><span class="k">${G.t("ui.stickers")}</span><b>${S.stickers}<small>/${MAX_STICKERS}</small></b></div>
        </div>
        <p class="pz-tip"><b>${G.t("ui.dyk")}</b> ${G.esc(G.t("why." + tip))}</p>`,
        [{ label: `${G.ICON.play}<span>${G.t("ui.resume")}</span>`, primary: true, on: () => onPause(false) },
          { label: `${G.ICON.retry}<span>${G.t("ui.retry")}</span>`, on: () => { stop(); G.go("rush"); } },
          { label: `${G.ICON.home}<span>${G.t("ui.home")}</span>`, on: () => { stop(); G.go("title"); } }],
        { cls: "pause-ov" });
    }
    const fr = G.frame(G.t("mode.rush"), chips, { pause: true, bg: "bg/alley.webp", onLeave: () => stop(), onPause, pausePanel });
    // halt: 벨트 · 구름 · 가로등 · 피버 빛의 움직임을 멈춤(css). 놀이가 실제로 돌 때만 움직임(시작 전 · 카운트다운 · 멈춤 · 결과는 멈춤)
    const field = fr.field, hud = fr.hud; field.classList.add("rush", "halt"); fr.dests.classList.add("rush-dests");
    // 컨베이어: 고무 벨트(움직이는 마디) + 롤러가 달린 앞판. 수거함 바로 위에 두어 끌어다 놓는 거리를 줄임
    field.appendChild(G.h(`<div class="belt" aria-hidden="true"><i class="belt-top"></i><i class="belt-face"></i></div>`));
    // 배경 움직임(11/27): 구름이 천천히 흐르고, 가로등 빛무리가 숨 쉬듯, 90초 동안 노을 → 저녁(--dusk 0 → 1)
    //   시간이 갈수록 하늘이 어두워지고 창문 불이 하나씩 켜짐(남은 시간을 느끼게). 벨트 높이에서는 움직이는 것 없음
    //   가로등 · 창문은 배경 그림(bg/alley.webp 1344×768, cover · 가운데) 위 자리에 맞춰 .sky-map을 그림과 같은 크기로 둠
    const sky = (function () {
      const IMG_W = 1344, IMG_H = 768;
      const LAMPS = [[34.4, 32], [35.4, 52.3]];                                   // 가로등 머리 (그림 기준 %)
      const WINS = [[75.6, 41, .3], [8.2, 34, .45], [96.6, 28.5, .6], [40.6, 56, .72], [93.5, 29, .84]];  // 창문 (x, y, 켜지는 때)
      const el = G.h(`<div class="rush-sky" aria-hidden="true"><i class="cloud c1"></i><i class="cloud c2"></i><i class="dusk"></i>
        <div class="sky-map">${LAMPS.map((p, i) => `<i class="lamp l${i + 1}" style="left:${p[0]}%;top:${p[1]}%"></i>`).join("")}${WINS.map((p) => `<i class="win" style="left:${p[0]}%;top:${p[1]}%"></i>`).join("")}</div></div>`);
      field.querySelector(".bg").after(el);
      const map = el.querySelector(".sky-map"), wins = [...el.querySelectorAll(".win")];
      function fit() {
        const W = field.clientWidth, H = field.clientHeight, s = Math.max(W / IMG_W, H / IMG_H);
        const w = IMG_W * s, h = IMG_H * s;
        map.style.cssText = `left:${(W - w) / 2}px;top:${(H - h) / 2}px;width:${w}px;height:${h}px`;
      }
      fit();
      if (window.ResizeObserver) new ResizeObserver(fit).observe(field); else addEventListener("resize", fit);
      return function set(d) {
        el.style.setProperty("--dusk", d);
        wins.forEach((w, i) => w.classList.toggle("on", d >= WINS[i][2]));
      };
    })();
    sky(0);
    const comboEl = G.h(`<div class="combo-pop" aria-hidden="true"><b></b><span>${G.esc(G.t("ui.combo"))}</span></div>`); field.appendChild(comboEl);
    DESTS.forEach(function (id) { const d = G.destEl(id); fr.dests.appendChild(d); G.dropTarget(d); });
    requestAnimationFrame(() => G.fitPlates(fr.dests)); setTimeout(() => G.fitPlates(fr.dests), 400);
    const v = (k) => hud.querySelector(`[data-v="${k}"]`);
    const beltTop = () => field.clientHeight - G.unit(field) * 150;

    function setHud(newStk) {
      v("combo").textContent = S.combo; v("time").textContent = Math.max(0, Math.ceil(S.time));
      v("time").parentElement.classList.toggle("urgent", running && S.time <= HURRY);
      v("stk").innerHTML = Array.from({ length: MAX_STICKERS }, (_, i) => `<i class="${i < S.stkShown ? "on" : ""}${newStk && i === S.stkShown - 1 ? " new" : ""}"></i>`).join("");
    }
    function setFever(on) {
      if (S.fever === on) return; S.fever = on; field.classList.toggle("fever", on);
      G.pitch = on ? 1.26 : 1; G.music.fast(on);   // 피버: 효과음 · 음악이 높고 빨라짐
      const b = field.querySelector(".fever-banner"); if (b) b.remove();
      if (on) { field.appendChild(G.h(`<div class="fever-banner">${G.t("rush.fever")}</div>`)); G.sfx("combo"); }
    }
    function showCombo() {
      if (S.combo < 2) return;
      comboEl.querySelector("b").textContent = S.combo; comboEl.classList.toggle("hot", S.fever);
      comboEl.classList.remove("on"); void comboEl.offsetWidth; comboEl.classList.add("on");
    }
    function spawn() {
      const id = pick(), it = ITEMS[id], P = innerHeight > innerWidth;
      const w = Math.max(Math.round(Math.max(it.w || 120, 96) * (P ? 1.45 : 1.3)), Math.ceil(52 / G.unit(field)));   // 누르는 곳 44px 이상
      const st = { id, x: -8, prepped: !(id in TAP), el: G.itemEl(id, { tag: true, w }) };
      st.el.style.left = st.x + "%"; st.el.style.top = "calc(100% - var(--u) * 74)";   // 발이 벨트 위에 오게
      G.ground(st.el);
      if (!st.prepped) st.el.appendChild(G.h(tapBadge()));
      field.appendChild(st.el); S.list.push(st);
      G.draggable({ el: st.el, kind: "item", can: () => !paused && !st.gone, onDrop: (t, from) => drop(st, t, from), onTap: () => tapPrep(st) });
    }
    function tapPrep(st) {
      if (paused || st.prepped) return true;     // 손질이 끝났으면 눌러서 고르기
      st.prepped = true; G.sfx("step");
      if (TAP[st.id]) st.el.querySelector("img").src = G.img(TAP[st.id]);
      const b = st.el.querySelector(".badge"); if (b) b.remove();
      G.flash(st.el, "ok");
      return false;
    }
    function drop(st, target, from) {
      if (!target.classList.contains("dest") || st.gone) return;
      const it = ITEMS[st.id], did = target.dataset.dest;
      const r = target.getBoundingClientRect(), f = field.getBoundingClientRect();
      const fx = r.left - f.left + r.width / 2;
      if (G.fits(st.id, did) && st.prepped) {
        st.gone = true;
        G.flyTo(from || st.el.getBoundingClientRect(), st.el.querySelector("img").src, target, DEST[did].color);
        st.el.classList.add("gone"); setTimeout(() => st.el.remove(), 300);
        S.combo++; S.ok++; S.best = Math.max(S.best, S.combo);
        const pts = (100 + Math.min(S.combo, 20) * 10) * (S.fever ? 2 : 1);
        S.score += pts; G.countTo(v("score"), S.score, 450); G.flash(v("score").parentElement, "bump");
        G.float(field, fx, beltTop() - 10, "+" + pts);
        G.sfx(S.combo % 5 === 0 ? "combo" : "ok"); G.bookAdd(st.id);
        if (S.combo >= FEVER_AT) setFever(true);
        showCombo();
        if (S.combo % 10 === 0) G.talk(field, "girl-laugh", `<b>${S.combo} ${G.t("ui.combo")}!</b> ${G.t("ui.great")}`, { ms: 1600 });
      } else {
        S.bad++; S.combo = 0; S.stickers++; setFever(false);
        const reason = G.fits(st.id, did) ? G.t("ui.needPrep", { step: (it.prep || []).map((p) => G.t("tool." + p)).join(" → ") }) : G.t("why." + st.id);
        S.review.push({ id: st.id, why: reason });
        G.flash(target, "no"); G.sfx("no");
        eject(st);   // 틀린 품목은 벨트에서 튕겨 나감(같은 품목으로 스티커가 연달아 붙지 않게)
        G.talk(field, "boy-stop", G.esc(reason), { stop: true, ms: 3400 });
        slap();
        if (S.stickers >= MAX_STICKERS) { paused = true; G.music.stop(); setTimeout(finish, 1300); }
      }
      setHud();
    }
    function eject(st) {
      st.gone = true; G.clearSelected();
      st.el.classList.add("eject"); setTimeout(() => st.el.remove(), 700);
    }
    // 미수거 스티커가 화면에 '찰싹' 붙었다가 머리 막대의 스티커 칸으로 날아감
    function slap() {
      const n = S.stickers;
      const s = G.h(`<div class="slap" aria-hidden="true"><b>${G.esc(G.t("rush.sticker"))}</b><span>${n} / ${MAX_STICKERS}</span></div>`);
      field.appendChild(s); G.sfx("slap"); G.flash(field, "thud");
      setTimeout(function () {
        const slot = hud.querySelectorAll(".stickers i")[n - 1];
        const done = function () { s.remove(); S.stkShown = Math.max(S.stkShown, n); setHud(true); };
        if (!slot || G.REDUCED || !s.isConnected || !slot.getBoundingClientRect().width) return done();
        const a = s.getBoundingClientRect(), b = slot.getBoundingClientRect();
        const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
        s.animate([{ transform: "translate(-50%, -50%) rotate(-7deg) scale(1)" },
          { transform: `translate(calc(-50% + ${dx.toFixed(0)}px), calc(-50% + ${dy.toFixed(0)}px)) rotate(0deg) scale(.1)`, opacity: 0.6 }],
          { duration: 420, easing: "cubic-bezier(.5,0,.75,0)" }).onfinish = done;
      }, 760);
    }
    function loop(now) {
      S.raf = requestAnimationFrame(loop);
      if (paused) { S.last = now; return; }
      const dt = Math.min(0.05, (now - S.last) / 1000); S.last = now;
      S.time -= dt; S.elapsed += dt;
      const k = Math.min(1, S.elapsed / TIME);
      const dusk = Math.round(k * 100) / 100;                              // 배경 하늘: 1%씩 바뀔 때만 갱신
      if (dusk !== S.dusk) { S.dusk = dusk; sky(dusk); }
      const speed = (100 / (9.5 - 4.5 * k)) * (S.fever ? 1.15 : 1);    // 화면을 건너는 데 9.5초 → 5초
      S.spawnIn -= dt;
      if (S.spawnIn <= 0 && S.list.filter((s) => !s.gone).length < 5) { spawn(); S.spawnIn = 1.8 - 0.9 * k; }
      S.list.forEach(function (st) {
        if (st.gone || st.el.classList.contains("dragging") || st.el.classList.contains("selected")) return;
        st.x += speed * dt; st.el.style.left = st.x + "%";
        if (st.x > 106) {
          st.gone = true; st.el.remove(); S.combo = 0; setFever(false);
          S.review.push({ id: st.id, why: G.t("rush.miss") + " — " + G.t("why." + st.id) });
          G.float(field, field.clientWidth - 70, beltTop() - 10, G.t("rush.miss"), true);
          setHud();
        }
      });
      S.list = S.list.filter((s) => !s.gone || s.el.isConnected);
      const sec = Math.ceil(S.time);
      if (sec !== S.sec) { S.sec = sec; setHud(); if (sec <= HURRY && sec > 0) G.sfx("tick"); }   // 남은 10초: 시계가 빨갛게 뛰고 째깍
      if (S.time <= 0) finish();
    }
    // 3 · 2 · 1 · 시작!
    function begin() {
      const cd = G.h(`<div class="countdown" aria-hidden="true"></div>`); field.appendChild(cd);
      const show = (txt, go) => { cd.innerHTML = `<b class="${go ? "go" : ""}">${txt}</b>`; G.sfx(go ? "go" : "tap"); };
      let n = 3; show(n); counting = true;
      S.cd = setInterval(function () {
        n--;
        if (n > 0) return show(n);
        clearInterval(S.cd); counting = false; show(G.esc(G.t("rush.go")), true); setTimeout(() => cd.remove(), 650);
        running = true; paused = false; field.classList.remove("halt"); S.last = performance.now(); S.raf = requestAnimationFrame(loop); G.music.play();
        G.talk(field, "girl", G.esc(G.t("ui.tapItem")), { ms: 5000 });
      }, 700);
    }
    function finish() {
      if (!running) return; running = false; paused = true; field.classList.add("halt"); cancelAnimationFrame(S.raf); setFever(false); G.clearSelected(); G.music.stop();
      S.list.forEach((s) => s.el.remove()); field.querySelectorAll(".slap").forEach((e) => e.remove());
      S.stkShown = S.stickers; setHud();
      const acc = S.ok + S.bad ? Math.round(S.ok / (S.ok + S.bad) * 100) : 0;
      // 결과 제목은 놀이 이름(분리배출 러시). 그 아래에 점수대 칭호 · 캐릭터 · 한마디, 최고 기록
      const g = GRADES.find((x) => S.score >= x.min && (x.k !== "g3" || S.stickers < MAX_STICKERS));
      const prev = G.store.rushBest || 0, isNew = S.score > prev;
      G.store.rushBest = Math.max(prev, S.score); G.save(); G.sfx("win");
      const rec = isNew && prev > 0 ? `<p class="record new">${G.ICON.star}<b>${G.t("rush.newBest")}</b><span>${G.t("rush.prevBest", { n: prev })}</span></p>`
        : !isNew ? `<p class="record">${G.t("rush.best")} <b>${G.store.rushBest}</b> ${G.t("ui.pts")}</p>` : "";
      const seen = {}, rev = S.review.filter((r) => !seen[r.id] && (seen[r.id] = 1)).slice(0, 6);
      const revHtml = rev.length ? `<ul class="review">${rev.map((r) => `<li><img src="${G.img(ITEMS[r.id].img)}" alt=""><div><b>${G.esc(G.itemName(r.id))} → ${G.esc(G.destNames(r.id))}</b><span>${G.esc(r.why)}</span></div></li>`).join("")}</ul>`
        : `<p class="lead">${G.t("rush.noReview")}</p>`;
      const ov = G.panel(`${G.ttl("clock", G.t("mode.rush"))}
        <div class="result g-${g.k}"><span class="res-face"><img src="${G.face(g.face)}" alt=""></span>
          <div class="res-main"><span class="res-grade">${G.t("rush." + g.k)}</span>
            <b class="res-score"><span>0</span><small>${G.t("ui.pts")}</small></b>
            <span class="res-say">${G.t("rush.c" + g.k.slice(1))}</span></div></div>${rec}
        <div class="stat-grid"><div class="stat"><span class="k">${G.t("ui.best")}</span><b>${S.best}</b></div>
        <div class="stat"><span class="k">${G.t("ui.acc")}</span><b>${acc}%</b></div>
        <div class="stat"><span class="k">${G.t("ui.stickers")}</span><b>${S.stickers}</b></div></div>
        <h3 class="sub">${G.t("ui.review")}</h3>${revHtml}`,
        [{ label: G.t("ui.retry"), primary: true, on: () => G.go("rush") }, { label: G.t("ui.home"), on: () => G.go("title") }]);
      G.countTo(ov.querySelector(".res-score span"), S.score, 900);
    }
    function stop() { clearInterval(S.cd); counting = false; cdHeld = false; running = false; paused = true; cancelAnimationFrame(S.raf); G.music.stop(); G.pitch = 1; }
    setHud();
    // 시작 안내: 그림으로 된 3단계(끌어다 놓기 → 노란 표시는 먼저 누르기 → 틀리면 스티커, 3장이면 끝)
    //   2단계는 1단계처럼 결과까지: '눌러요' 붙은 페트병(손가락은 병 위) → 찌그러진 페트병. 표시가 아니라 쓰레기를 누른다는 것을 보여 줌
    G.panel(`${G.ttl("clock", G.t("mode.rush"))}<ol class="how3">
      <li><span class="pic"><img src="${G.img(ITEMS.banana.img)}" alt=""><i class="arw"></i><img class="bin" src="${G.img(DEST.food.img)}" alt=""></span><span class="tx">${G.t("rush.how1")}</span></li>
      <li><span class="pic"><span class="pv-item"><img src="${G.img(ITEMS.pet.img)}" alt="">${tapBadge()}<span class="tap-hand" aria-hidden="true">${G.ICON.hand}</span></span><i class="arw"></i><img src="${G.img(TAP.pet)}" alt=""></span><span class="tx">${G.t("rush.how2")}</span></li>
      <li><span class="pic stk"><i></i><i></i><i></i></span><span class="tx">${G.t("rush.how3")}</span></li></ol>`,
      [{ label: G.t("ui.start"), primary: true, on: begin }]);
    return { stop };
  };
})();
