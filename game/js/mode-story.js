// 시안 C · 서대문 새내기 일주일 — 봉투 · 시간 · 장소 · 미수거와 음식물 · 재활용 · 깨진 유리 · 약 · 대형 · 가전을 하루씩
(function () {
  const { ITEMS } = window.GAMEDATA;
  // 1일째: 다른 구 봉투도 쓸 수 있음(1편 영상 v14 · 구청 11/24 의견) → 봉투 고르기는 '일반 쓰레기 = 종량제 봉투, 음식물 = 음식물 전용 봉투'로
  const DAYS = [
    { n: 1, bg: "bg/alley.webp", steps: [
      { talk: [["girl", "d1.l1"], ["boy-surprise", "d1.l2"], ["girl", "d1.l3"]] },
      { board: { prompt: "d1.p1", items: ["trash", "leftover"], dests: ["general", "food"] } },
      { choice: { prompt: "d1.p2", token: "bagfull", cards: [
        { icon: "tree", t: "d1.c1", p: "d1.c1p", why: "d1.w1" }, { icon: "house", t: "d1.c2", p: "d1.c2p", ok: true }, { icon: "door", t: "d1.c3", p: "d1.c3p", why: "d1.w3" }] } },
      { rule: "d1.r" }] },
    { n: 2, bg: "bg/room.webp", steps: [
      { talk: [["girl-worry", "d2.l1"], ["boy-stop", "d2.l2"]] },
      { board: { prompt: "d2.p", items: ["bone", "banana", "pit", "tangerine", "egg", "pineapple", "shell", "tissue"], dests: ["food", "general"] } },
      { rule: "d2.r" }] },
    { n: 3, bg: "bg/room.webp", steps: [
      { talk: [["girl", "d3.l1"], ["boy", "d3.l2"]] },
      { board: { prompt: "d3.p", items: ["pet", "carton", "can"], dests: ["pet", "can", "carton", "general"], tools: ["empty", "rinse", "label", "crush", "cap", "flatten"] } },
      { rule: "d3.r" }] },
    { n: 4, bg: "bg/room.webp", steps: [
      { talk: [["boy-surprise", "d4.l1"], ["girl", "d4.l2"]] },
      { board: { prompt: "d4.p", items: ["brokenglass", "butane", "pills", "syrup"], dests: ["sack", "glass", "can", "medicine", "general"], tools: ["wrap", "gas", "punch", "crush"] } },
      { rule: "d4.r" }] },
    { n: 5, bg: "bg/alley.webp", steps: [
      { talk: [["boy", "d5.l1"], ["girl", "d5.l2"]] },
      { board: { prompt: "d5.p", items: ["clothes", "blanket", "chair", "fridge", "fan"], dests: ["clothes", "bulky", "appliance", "general"], tools: ["report"] } },
      { rule: "d5.r" }] },
    { n: 6, bg: "bg/alley.webp", sticker: true, steps: [
      { talk: [["girl-worry", "d6.l1"], ["boy", "d6.l2"]] },
      { board: { prompt: "d6.p1", items: ["pet"], dests: ["pet", "general"], src: { pet: "item/pet/crushed.webp" } } },
      { choice: { prompt: "d6.p2", token: "bagmixed", cards: [
        { icon: "clock", t: "d6.c1", p: "d6.c1p", why: "d6.w" }, { icon: "cal", t: "d6.c2", p: "d6.c2p", ok: true }, { icon: "clock", t: "d6.c3", p: "d6.c3p", why: "d6.w" }] } },
      { rule: "d6.r" }] },
    { n: 7, quiz: true, bg: "bg/alley.webp", steps: [{ quiz: [["q1", true], ["q2", false], ["q3", false], ["q4", false], ["q5", true]] }] }
  ];
  const starsFor = (m) => (m === 0 ? 3 : m <= 2 ? 2 : 1);
  // 배경 그림에서 바닥이 시작하는 높이(0~1): 방은 벽과 마루가 만나는 선 아래, 골목은 대문 앞 길
  const GROUND = { "bg/room.webp": 0.72, "bg/alley.webp": 0.81 };
  // 날마다 다른 빛: 골목 저녁 정도(0 아침 ~ 1 밤, 창문 불은 .3부터 켜짐) · 방 햇빛 세기
  const DUSK = { 1: 0, 5: .2, 6: .38, 7: .55 }, SUN = { 2: 1, 3: .8, 4: .6 };

  G.screens.story = function (dayIndex) {
    if (dayIndex === undefined) return map();
    const D = DAYS[dayIndex];
    const title = D.quiz ? G.t("story.quiz") : `${G.t("story.day", { n: D.n })} · ${G.t("d" + D.n + ".t")}`;
    // 위쪽 날짜 표시 = 날짜 고르기 단추(달력 아이콘). 누르면 하던 날 위에 날짜 고르기 창(닫기로 돌아옴)
    const fr = G.frame(G.t("mode.story"), `<button class="chip chip-btn" data-days aria-label="${G.esc(G.t("story.pick"))}: ${G.esc(title)}" title="${G.esc(G.t("story.pick"))}">${G.ICON.cal}<b>${G.esc(title)}</b></button>`, { bg: D.bg });
    // 늦게 오는 넘어가기(마지막 물건 뒤 1.2초 · 고르기 · 퀴즈 다음 문제): 화면을 떠났으면 버리고, 날짜 고르기 창이 떠 있으면 닫힐 때까지 미룸
    //   (안 그러면 날짜 창 위에 규칙 창이 겹치거나, 다른 날로 간 뒤 이전 날의 창이 뜸)
    let alive = true, held = null;
    const later = (fn) => function () { const a = arguments; if (!alive) return; if (G.app.querySelector(".week")) { held = () => fn.apply(null, a); return; } fn.apply(null, a); };
    const release = () => { const f = held; held = null; if (f && alive) f(); };
    fr.hud.querySelector("[data-days]").addEventListener("click", function () { if (G.app.querySelector(".week")) return; G.sfx("tap"); weekPanel(dayIndex, release); });
    const field = fr.field;
    G.fitScene(field);
    // 배경 움직임: 골목은 구름 · 가로등 · 날마다 다른 하늘빛(아침 → 저녁), 방은 햇빛 · 떠다니는 먼지
    if (D.bg === "bg/alley.webp") G.alleySky(field, true)(DUSK[D.n] || 0);
    else G.roomLight(field).style.setProperty("--sun", SUN[D.n] || 1);
    // 하루 시작 띠: 'N일째 · 제목'이 잠깐 떴다 사라짐(누르기 막지 않음). 동작 줄이기면 만들지 않음(animationend가 오지 않아 남으므로)
    if (!G.REDUCED) {
      const ban = G.h(`<div class="day-banner" aria-hidden="true"><b>${G.esc(D.quiz ? G.t("story.quiz") : G.t("story.day", { n: D.n }))}</b>${D.quiz ? "" : `<span>${G.esc(G.t("d" + D.n + ".t"))}</span>`}</div>`);
      field.appendChild(ban); ban.addEventListener("animationend", () => ban.remove());
    }
    let mistakes = 0, si = 0;
    if (D.sticker) field.appendChild(G.h(`<div class="miss-sticker"><b>${G.t("d6.s")}</b>${G.t("d6.sp")}</div>`));
    next();
    return { stop() { alive = false; held = null; } };

    function hideTalk() { const tk = field.querySelector(".talk"); if (tk) { clearTimeout(tk._t); tk.classList.add("hide"); } }
    function next() {
      if (si >= D.steps.length) return finish();
      const s = D.steps[si++];
      fr.dests.innerHTML = ""; field.querySelectorAll(".item, .prop, .tools, .cards, .statement, .prompt").forEach((e) => e.remove());
      if (s.talk) { if (D.sticker) bagProp(); dialog(s.talk, next); }
      else if (s.board) {
        G.prompt(field, G.t(s.board.prompt));
        G.board({ field, dests: fr.dests, items: s.board.items, destIds: G.shuffle(s.board.dests), tools: s.board.tools ? G.shuffle(s.board.tools) : null,
          ground: GROUND[D.bg], srcOf: (id) => s.board.src && s.board.src[id], onDone: later((m) => { mistakes += m; next(); }) });
      }
      else if (s.choice) choice(s.choice, next);
      // 규칙 카드: 앞 장면 말풍선("좋아요!" 등)이 카드 뒤에 남지 않게 먼저 닫음
      else if (s.rule) { hideTalk(); G.sfx("ok"); G.panel(`${G.ttl("cal", G.esc(title))}<div class="rule-card">${G.t(s.rule)}</div>`, [{ label: G.t("ui.ok"), primary: true, on: next }]); }
      else if (s.quiz) quiz(s.quiz, 0, next);
    }
    // 6일째 대화: 어제 내놓은 봉투(미수거 스티커가 붙은 채)를 골목 바닥에 보여 줌
    function bagProp() {
      const p = G.itemEl("bagmixed", { w: 150 });
      p.className = "prop"; ["role", "tabindex", "aria-label"].forEach((a) => p.removeAttribute(a)); p.setAttribute("aria-hidden", "true");
      p.appendChild(G.h(`<span class="fix-sticker">${G.esc(G.t("d6.s"))}</span>`));
      field.appendChild(p); G.ground(p);
      const place = function () {
        if (!p.isConnected) return;
        const P = field.clientHeight >= field.clientWidth, tk = field.querySelector(".talk:not(.hide)");
        let y = G.groundY(field, GROUND[D.bg] + 0.05);
        if (P && tk) y = Math.min(y, tk.offsetTop - 12);   // 세로 화면: 말풍선 위에
        p.style.left = P ? "34%" : "72%"; p.style.top = y.toFixed(1) + "px";
      };
      place(); G.onFieldResize(field, place); setTimeout(place, 80);
    }
    // 대화: 말풍선 + 다음 단추
    function dialog(lines, done) {
      let k = 0;
      const btn = G.h(`<button class="btn" style="position:absolute;right:2%;bottom:4%;z-index:7">${G.t("ui.next")} ${G.ICON.go}</button>`);
      field.appendChild(btn);
      // 다음 단추가 말풍선과 겹치면(세로 화면) 말풍선 위로 올림
      const fit = () => { if (!btn.isConnected) return; btn.style.bottom = "4%"; const tk = field.querySelector(".talk"); if (!tk) return;
        const a = btn.getBoundingClientRect(), b = tk.getBoundingClientRect(), f = field.getBoundingClientRect();
        if (a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top) btn.style.bottom = (f.bottom - b.top + 8) + "px"; };
      const show = () => { const [who, key] = lines[k]; G.talk(field, who, G.esc(G.t(key)), { stop: who === "boy-stop" }); fit(); };
      G.onFieldResize(field, fit);
      show();
      btn.addEventListener("click", function () {
        G.sfx("tap"); k++;
        if (k < lines.length) return show();
        btn.remove(); field.querySelector(".talk").classList.add("hide"); done();
      });
      btn.focus();
    }
    // 고르기: 품목 하나를 알맞은 카드에
    function choice(c, done) {
      const tk = field.querySelector(".talk"); if (tk) tk.classList.add("hide");   // 앞 단계 말풍선이 카드를 가리지 않게
      G.prompt(field, G.t(c.prompt));
      const tok = G.itemEl(c.token, { tag: true });
      tok.style.left = "50%"; tok.style.top = "36%"; tok.style.transform = "translate(-50%,-50%)"; tok.dataset.w0 = tok.style.getPropertyValue("--w");
      if (c.token === "bagmixed") tok.appendChild(G.h(`<span class="fix-sticker">${G.t("d6.s")}</span>`));
      field.appendChild(tok);
      const cards = G.h(`<div class="cards"></div>`);
      c.cards.forEach(function (cd, i) {
        const el = G.h(`<div class="card-drop drop-target" data-accept="item" data-i="${i}" role="button" tabindex="0">${G.ICON[cd.icon]}<span class="t">${G.t(cd.t)}</span><span class="p">${G.t(cd.p)}</span></div>`);
        cards.appendChild(el); G.dropTarget(el);
      });
      field.appendChild(cards);
      stack(tok, cards);
      let finished = false;
      G.draggable({ el: tok, kind: "item", can: () => !finished, onDrop: function (t) {
        const cd = c.cards[+t.dataset.i]; if (!cd) return;
        if (cd.ok) { finished = true; G.flash(t, "ok"); G.sfx("ok"); tok.classList.add("gone"); G.talk(field, "girl-laugh", `<b>${G.t("ui.great")}</b>`, { ms: 1800 }); setTimeout(later(done), 1200); }
        else { mistakes++; G.flash(t, "no"); G.sfx("no"); G.talk(field, "boy-stop", G.esc(G.t(cd.why)), { stop: true, ms: 4000 }); }
      } });
    }
    // O/X 퀴즈: 문장 카드를 O 또는 X로
    function quiz(list, k, done) {
      field.querySelectorAll(".statement, .cards").forEach((e) => e.remove());
      if (k >= list.length) return done();
      const [key, truth] = list[k];
      if (k === 0) list._res = [];   // 이번 판의 맞힘 여부(진행 점 색)
      const res = list._res;
      G.prompt(field, `${G.t("q.p")} (${k + 1} / ${list.length})`);
      // 진행 점: 푼 문제(맞음 초록 · 틀림 산호) · 지금 문제(길쭉) · 남은 문제(연한 점). res = 지금까지 맞힘 여부 목록
      const dots = (now) => `<span class="q-dots" aria-hidden="true">${list.map((_, i) => `<i class="${i < k ? (res[i] ? "ok" : "no") : i === k ? "cur" + (now ? " " + now : "") : ""}"></i>`).join("")}</span>`;
      const card = G.h(`<div class="statement" role="button" tabindex="0"><span class="q">Q${k + 1}</span><span class="s">${G.esc(G.t(key))}</span>${dots()}</div>`);
      field.appendChild(card);
      const cards = G.h(`<div class="cards"><div class="card-drop ox o drop-target" data-accept="card" data-v="1" role="button" tabindex="0"><span class="mk">O</span></div><div class="card-drop ox x drop-target" data-accept="card" data-v="0" role="button" tabindex="0"><span class="mk">X</span></div></div>`);
      field.appendChild(cards); cards.querySelectorAll(".card-drop").forEach((e) => G.dropTarget(e));
      const lay = stack(card, cards);
      let over = false;
      G.draggable({ el: card, kind: "card", can: () => !over, onDrop: answer });
      // O · X를 바로 눌러도 답이 됨(전에는 문제 카드를 먼저 고르거나 끌어야만 해서, O · X만 누르면 아무 반응이 없었음).
      //   문제 카드를 골라 둔 상태면 G.dropTarget 쪽이 먼저 처리하고 over가 되므로 두 번 답하지 않음
      cards.querySelectorAll(".card-drop").forEach(function (t) {
        const direct = () => { if (over || G.selected) return; answer(t); };
        t.addEventListener("click", direct);
        t.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); direct(); } });
      });
      function answer(t) {
        const said = t.dataset.v === "1";
        over = true;
        const ok = said === truth;
        if (ok) { G.flash(t, "ok"); G.sfx("ok"); G.talk(field, "girl-laugh", `<b>${G.t("ui.great")}</b>`, { ms: 1400 }); }
        else { mistakes++; G.flash(t, "no"); G.sfx("no"); G.talk(field, "boy-stop", G.esc(G.t("q.again")), { stop: true, ms: 2400 }); }
        // 답하면 문제 카드를 바로 '정답 O/X + 풀이'로 바꿈(전에는 답한 뒤에도 같은 문제가 2초쯤 그대로 남아 있었음)
        card.classList.add("answered", ok ? "right" : "wrong"); card.removeAttribute("role"); card.removeAttribute("tabindex");
        // 다음 문제까지(1.5 ~ 2.6초) 고른 카드만 맞음/틀림 테두리로 남기고 나머지는 흐리게 → 기다리는 중임이 보이게
        cards.classList.add("done"); t.classList.add("picked", ok ? "right" : "wrong");
        cards.querySelectorAll(".card-drop").forEach((c) => c.setAttribute("aria-disabled", "true"));
        card.innerHTML = `<span class="q">${G.esc(G.t("ui.correct"))} <b>${truth ? "O" : "X"}</b></span><span class="s">${G.esc(G.t(key + "w"))}</span>${dots(ok ? "ok" : "no")}`;
        res[k] = ok;
        lay();
        setTimeout(later(() => quiz(list, k + 1, done)), ok ? 1500 : 2600);
      }
    }
    // 고르기 · 퀴즈 배치: 카드 줄은 아래, 고를 것은 안내문과 카드 사이 가운데. 높이가 넉넉하면 맨 아래에 말풍선 자리를 비움
    function stack(mid, cards) {
      const lay = function () {
        if (!mid.isConnected) return;
        const f = field.getBoundingClientRect(), u = G.unit(field), m = Math.max(8, u * 14);
        const pr = field.querySelector(".prompt"), stk = field.querySelector(".miss-sticker");
        let top = pr ? pr.getBoundingClientRect().bottom - f.top + 8 : m;
        if (stk && innerHeight >= innerWidth) top = Math.max(top, stk.getBoundingClientRect().bottom - f.top + 8);   // 세로 화면: 미수거 스티커 아래부터
        cards.style.bottom = m + "px";
        const ch = cards.getBoundingClientRect().height, isItem = mid.classList.contains("item");
        const w0 = isItem ? +mid.dataset.w0 || 120 : 0;
        const midH = isItem ? Math.min(w0 * u, 150) + 24 : mid.offsetHeight;
        const band = G.talkBand(field);
        const off = f.height - top - ch - m - band - 12 >= midH ? band + m : m;
        cards.style.bottom = off + "px";
        // 말풍선 자리를 못 비우는 낮은 가로 화면: 고를 것은 오른쪽, O · X 카드는 오른쪽으로 붙임
        const side = off === m && innerWidth > innerHeight;
        if (isItem) mid.style.left = side ? "76%" : "50%"; else cards.style.justifyContent = side ? "flex-end" : "";
        const room = f.height - off - ch - 10 - top;
        if (isItem) { const w = Math.max(46 / u, Math.min(w0, (room - 26) / u)); mid.style.setProperty("--w", w.toFixed(1)); }
        const h = isItem ? mid.offsetHeight + 24 : mid.offsetHeight;
        const y = top + Math.max(0, (room - h) / 2) + (isItem ? mid.offsetHeight / 2 : mid.offsetHeight / 2);
        mid.style.top = y + "px";
      };
      G.onFieldResize(field, lay); lay(); setTimeout(lay, 300);
      return lay;
    }
    function finish() {
      hideTalk();
      const s = starsFor(mistakes);
      G.store.story[D.n] = Math.max(G.store.story[D.n] || 0, s); G.save(); G.sfx("win");
      const last = dayIndex === DAYS.length - 1;
      if (last) {
        // 인증서: 학생이 캡처해서 보여 주고 싶은 '증서' — 캐릭터 둘 · 별 · 모은 별 · 날짜
        const total = DAYS.reduce((a, d) => a + (G.store.story[d.n] || 0), 0);
        let date = "";
        try { date = new Date().toLocaleDateString({ ko: "ko-KR", en: "en-US", zh: "zh-CN", vi: "vi-VN" }[G.lang], { year: "numeric", month: "long", day: "numeric" }); } catch (e) { date = new Date().toISOString().slice(0, 10); }
        G.panel(`<div class="cert"><div class="cert-in">
          <img class="logo" src="${G.img("brand/title.webp")}" alt="서대문구 분리배출 교육">
          <h3>${G.t("story.cert")}</h3><p class="cert-p">${G.t("story.certP")}</p>
          <div class="cert-row"><img class="ch" src="${G.img("char/girl-laugh.webp")}" alt="">
            <div class="seal"><span class="medal">${G.RECYCLE_SVG("#2a9d55")}</span><div class="stars-big">${G.stars(s)}</div></div>
            <img class="ch" src="${G.img("char/boy-smile.webp")}" alt=""></div>
          <div class="cert-meta"><span>${G.ICON.star}${G.t("story.certStars", { n: total, t: DAYS.length * 3 })}</span><span>${G.esc(date)}</span></div>
          <div class="cert-by"><img src="${G.img("brand/logo.png")}" alt="">${G.t("story.certBy")}</div></div></div>
          <p class="lead"><b>${G.t("story.closing")}</b></p>`,
          [{ label: G.t("ui.home"), primary: true, on: () => G.go("title") }, { label: G.t("ui.retry"), on: () => G.go("story", dayIndex) }, { label: G.t("story.pick"), on: () => G.go("story") }]);
        return;
      }
      // 하루 끝: 별 + 캐릭터 표정 · 한마디
      G.panel(`${G.ttl("cal", G.esc(title))}<div class="day-end"><span class="res-face"><img src="${G.face(s === 3 ? "girl-laugh" : s === 2 ? "boy" : "girl")}" alt=""></span>
        <div><div class="stars-big">${G.stars(s)}</div><p class="res-say">${G.t("story.s" + s)}</p></div></div>`,
        [{ label: G.t("ui.next"), primary: true, on: () => G.go("story", dayIndex + 1) }, { label: G.t("ui.retry"), on: () => G.go("story", dayIndex) },
          { label: G.t("story.pick"), on: () => G.go("story") }, { label: G.t("ui.home"), on: () => G.go("title") }]);
    }
  };

  // 날짜 고르기: 1일째 → 6일째 → 마지막 퀴즈로 이어지는 길. 끝낸 날은 ✓와 별, 다음 차례는 표시(아무 날이나 골라도 됨)
  //   cur: 하던 날 위에서 열었을 때 그 날(지금 표시 · '닫기'로 돌아감). 없으면 날짜 고르기 화면 자체(처음으로만)
  //   onClose: '닫기'로 하던 날에 돌아갈 때(미뤄 둔 넘어가기를 이어 함)
  function weekPanel(cur, onClose) {
    const inDay = cur !== undefined;
    const nextI = DAYS.findIndex((D) => !G.store.story[D.n]);
    const nodes = DAYS.map(function (D, i) {
      const s = G.store.story[D.n] || 0;
      const cls = [s ? "done" : "", i === nextI ? "next" : "", D.quiz ? "quiz" : "", i === cur ? "cur" : ""].join(" ").trim();
      const tag = i === cur ? `<em class="next-tag now-tag">${G.t("story.now")}</em>` : i === nextI ? `<em class="next-tag">${G.t("story.next")}</em>` : "";
      return `<li class="${cls}"><button class="day" data-i="${i}"${i === cur ? ' aria-current="step"' : ""}><span class="dot">${s ? G.ICON.check : D.quiz ? "Q" : D.n}</span>
        <span class="txt"><span class="n">${D.quiz ? G.t("story.quiz") : G.t("story.day", { n: D.n })}</span>${D.quiz ? "" : `<b>${G.esc(G.t("d" + D.n + ".t"))}</b>`}<span class="st">${G.stars(s)}</span></span>
        ${tag}</button></li>`;
    }).join("");
    const btns = inDay ? [{ label: G.t("ui.close"), primary: true, on: onClose }, { label: G.t("ui.home"), on: () => G.go("title") }] : [{ label: G.t("ui.home"), on: () => G.go("title") }];
    const ov = G.panel(`${G.ttl("cal", G.t("mode.story"))}<p class="lead">${G.t("story.how")}</p><ol class="week">${nodes}</ol>`, btns);
    ov.querySelectorAll(".day").forEach((b) => b.addEventListener("click", () => { G.sfx("tap"); G.go("story", +b.dataset.i); }));
    const nb = inDay ? null : ov.querySelector("li.next .day"); if (nb) nb.focus({ preventScroll: true });
    return ov;
  }
  function map() {
    G.frame(G.t("mode.story"), "", { bg: "bg/alley.webp" });
    weekPanel();
    return {};
  }
})();
