(function () {
  var LANGS = ["ko", "zh", "en", "vi"];
  var HTML_LANG = { ko: "ko", zh: "zh-CN", en: "en", vi: "vi" };
  var STORAGE_KEY = "sdm-eco-lang";
  var PROGRESS_KEY = "sdm-eco-progress";
  var config = window.SITE_CONFIG || {};
  var current = "ko";
  var progress = null;
  var fitters = []; // setupHeaderFit·setupBandFit이 넣음: 언어를 바꾸면 글 폭이 달라져 한 줄/두 줄을 다시 잼

  function t(key) {
    var dict = window.I18N[current] || window.I18N.ko;
    return dict[key] != null ? dict[key] : window.I18N.ko[key];
  }

  function savedLang() {
    try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
  }

  function saveLang(lang) {
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) {}
  }

  // 우선순위: 주소의 ?lang= → 이전 선택 → 브라우저 언어 → 한국어
  function detectLang() {
    var param = new URLSearchParams(location.search).get("lang");
    if (LANGS.indexOf(param) > -1) return param;
    var saved = savedLang();
    if (LANGS.indexOf(saved) > -1) return saved;
    var nav = (navigator.language || "ko").slice(0, 2).toLowerCase();
    return LANGS.indexOf(nav) > -1 ? nav : "ko";
  }

  function applyLang(lang) {
    current = lang;
    document.documentElement.lang = HTML_LANG[lang];
    document.title = t("meta.title");

    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      el.textContent = t(el.getAttribute("data-i18n"));
      koName(el);
    });
    document.querySelectorAll("[data-i18n-html]").forEach(function (el) {
      el.innerHTML = t(el.getAttribute("data-i18n-html"));
    });
    document.querySelectorAll("[data-i18n-attr]").forEach(function (el) {
      var parts = el.getAttribute("data-i18n-attr").split(":");
      el.setAttribute(parts[0], t(parts[1]));
    });
    document.querySelectorAll(".lang-switch button").forEach(function (btn) {
      btn.setAttribute("aria-pressed", String(btn.dataset.lang === lang));
    });

    renderVideos();
    checkTagRows();
    if (progress) progress.render();
    fitters.forEach(function (f) { f(); });
  }

  // 동 이름의 한국어 원래 이름: 한국어가 아닌 화면이면 동 이름(dong.* 키) 아래에 작게 한국어 이름을 붙임
  //   (신분증·임대차 계약서의 한국어 주소와 맞춰 볼 수 있게). 글자는 CSS가 data-ko를 ::after로 그려 textContent 바꾸기와 부딪치지 않음
  function koName(el) {
    var key = el.getAttribute("data-i18n");
    if (current !== "ko" && key && key.indexOf("dong.") === 0) el.setAttribute("data-ko", window.I18N.ko[key]);
    else el.removeAttribute("data-ko");
  }

  // 맨 위로 버튼: 첫 화면 높이만큼 내려가면 보이고, 누르면 맨 위로 (움직임 줄이기 설정이면 바로 이동)
  //   버튼을 누른 뒤에는 키보드 이용자를 위해 맨 위의 '본문 바로가기'(없으면 로고)로 초점을 옮김
  // 머리 부분 한 줄/두 줄: 로고·메뉴·언어 선택이 한 줄에 다 들어가면 한 줄, 아니면 html.hdr-stacked(메뉴를 아래 줄로)
  //   잴 때는 hdr-measure로 각 칸을 줄바꿈 없이 펼쳐 넘치는지 봄. 휴대폰(700px 이하)은 늘 두 줄(CSS가 따로 처리)
  function setupHeaderFit() {
    var root = document.documentElement, inner = document.querySelector(".header-inner");
    if (!inner) return;
    // 1) 메뉴를 펼친 채 한 줄에 들어가면 그대로 → 2) 안 되면 메뉴를 드롭다운 버튼으로 접고(nav-collapsed) 다시 잼
    //    → 3) 그래도 안 되면 두 줄(hdr-stacked). 휴대폰은 늘 접은 메뉴(배치는 CSS)
    var nav = inner.querySelector("nav"), lab = nav && nav.querySelector(".nav-toggle-label");
    // 접은 메뉴 버튼 폭을 가장 긴 글자('메뉴'·칸 이름 셋 중)에 맞춰 고정: 스크롤로 글자가 바뀌어도 머리 부분이 한 줄↔두 줄로 출렁이지 않게
    function sizeToggle() {
      if (!lab) return;
      var keep = lab.textContent, max = 0;
      lab.style.minWidth = "";
      [t("nav.menu")].concat(Array.prototype.map.call(nav.querySelectorAll(".nav-links a"), function (a) { return a.textContent.trim(); }))
        .forEach(function (txt) { lab.textContent = txt; max = Math.max(max, lab.getBoundingClientRect().width); });
      lab.textContent = keep;
      lab.style.minWidth = Math.ceil(max) + "px";
    }
    // 열린 메뉴는 '접은 메뉴'가 아니게 될 때만 닫음 (휴대폰은 스크롤할 때 주소창이 접히며 resize가 나서, 무조건 닫으면 열어 둔 메뉴가 저절로 닫힘)
    function closeIfExpanded() {
      if (!nav || root.classList.contains("nav-collapsed")) return;
      nav.classList.remove("is-open");
      var tb = nav.querySelector(".nav-toggle"); if (tb) tb.setAttribute("aria-expanded", "false");
    }
    // 키보드 초점 지키기: 창 폭이 바뀌어 초점이 있던 메뉴 링크(또는 '메뉴' 버튼)가 숨겨지면, 지금 보이는 쪽으로 초점을 옮김
    //   (메뉴가 접히면 → '메뉴' 버튼, 다시 펼쳐지면 → 첫 메뉴 링크). 숨은 요소에 초점이 남으면 다음 Tab이 페이지 처음부터 시작됨
    function keepFocus(was) {
      if (!nav || !was || !nav.contains(was) || was.getClientRects().length) return;
      var tb = nav.querySelector(".nav-toggle"), first = nav.querySelector(".nav-links a");
      var to = tb && tb.getClientRects().length ? tb : first && first.getClientRects().length ? first : null;
      if (to) to.focus({ preventScroll: true });
    }
    function fit() {
      var was = document.activeElement;
      layout();
      keepFocus(was);
    }
    function layout() {
      root.classList.remove("hdr-stacked", "nav-collapsed");
      // 휴대폰: 버튼 글자는 늘 '메뉴'(setLabel), 폭 고정 없음 — 칸 이름을 넣으면 긴 언어에서 사이트 제목이 세 줄로 눌림
      if (window.innerWidth <= 700) { root.classList.add("nav-collapsed"); if (lab) lab.style.minWidth = ""; return; }
      root.classList.add("hdr-measure");
      var over = inner.scrollWidth > inner.clientWidth + 1;
      if (over) {
        root.classList.add("nav-collapsed");
        sizeToggle();
        over = inner.scrollWidth > inner.clientWidth + 1;
      }
      root.classList.remove("hdr-measure");
      root.classList.toggle("hdr-stacked", over);
      closeIfExpanded();
    }
    fitters.push(fit);
    fit();
    window.addEventListener("resize", fit);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit); // 글꼴이 늦게 받아지면 폭이 달라짐
  }

  // 버리는 날·시간 띠 한 줄/두 줄: 이름표·시간·요일·버튼이 줄바꿈 없이 한 줄에 들어가면 한 줄, 아니면 .is-stacked(두 줄)
  //   휴대폰(700px 이하)은 CSS가 세로로 쌓음. 여유 24px은 한 줄일 때 칸 사이가 너무 붙지 않게
  function setupBandFit() {
    var band = document.querySelector(".put-band"), card = band && band.querySelector(".put-band-card");
    if (!card) return;
    function fit() {
      band.classList.remove("is-stacked");
      if (window.innerWidth <= 700) return;
      band.classList.add("is-measure");
      var cs = getComputedStyle(card), kids = card.children, need = 24;
      need += parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + (parseFloat(cs.columnGap) || 0) * (kids.length - 1);
      for (var i = 0; i < kids.length; i++) need += kids[i].getBoundingClientRect().width;
      var over = need > card.clientWidth;
      band.classList.remove("is-measure");
      band.classList.toggle("is-stacked", over);
    }
    fitters.push(fit);
    fit();
    window.addEventListener("resize", fit);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
  }

  // 머리 메뉴: 지금 화면에 보이는 칸(영상·배출방법·게임)의 메뉴에 흰 칩(aria-current="location")
  //   화면 위에서 40% 높이의 가로선이 지나는 칸을 '지금 보는 칸'으로 봄. 첫 화면(배너)이면 아무것도 고르지 않음
  //   큰 화면에선 맨 끝 칸(게임)이 맨 아래까지 내려도 40% 선에 닿지 않으므로, 페이지 맨 아래면 화면에 보이는 마지막 칸을 고름
  //   메뉴를 누르면 누른 메뉴를 바로 고르고, 사용자가 직접 스크롤(휠·터치·키·마우스)하기 전까지 유지
  //   (이미 맨 아래라 화면이 안 움직이거나, 눌러서 맨 아래까지 내려가 '맨 아래 규칙'이 다른 칸을 고르는 경우에도 누른 메뉴가 보이게)
  function setupNavSpy() {
    var links = Array.prototype.slice.call(document.querySelectorAll('.nav-links a[href^="#"]'));
    var pairs = links.map(function (a) { return { a: a, sec: document.getElementById(a.getAttribute("href").slice(1)) }; })
      .filter(function (p) { return p.sec; });
    if (!pairs.length) return;
    var queued = false, current = null, pinned = null;
    // 접은 메뉴 버튼(.nav-toggle) 글자 = 지금 보는 칸 이름, 없으면 '메뉴' (언어를 바꾸면 다시 씀)
    var toggle = document.querySelector(".nav-toggle"), label = toggle && toggle.querySelector(".nav-toggle-label");
    function setLabel() {
      if (!label) return;
      var named = current && window.innerWidth > 700; // 휴대폰은 늘 '메뉴'(좁아서)
      label.textContent = named ? current.a.textContent.trim() : t("nav.menu");
      toggle.classList.toggle("has-current", !!named);
    }
    // 맨 앞에 넣음: 언어를 바꾸면 버튼 글자부터 새 언어로 바꾼 뒤 머리 부분 폭을 재야 함
    //   (뒤에 두면 이전 언어의 긴 칸 이름으로 재서, 한 줄에 들어가는데도 두 줄로 남음 — 예: 베트남어→한국어, 폭 860px)
    fitters.unshift(setLabel);
    window.addEventListener("resize", setLabel);
    function mark(hit) {
      if (hit === current) return;
      current = hit;
      pairs.forEach(function (p) {
        if (p === hit) p.a.setAttribute("aria-current", "location");
        else p.a.removeAttribute("aria-current");
      });
      setLabel();
    }
    function update() {
      queued = false;
      if (pinned) { mark(pinned); return; }
      var vh = window.innerHeight, y = vh * 0.4, hit = null;
      var atBottom = window.scrollY > 0 && window.scrollY + vh >= document.documentElement.scrollHeight - 2;
      pairs.forEach(function (p) {
        var r = p.sec.getBoundingClientRect();
        if (r.top <= y && r.bottom > y) hit = p;
        if (atBottom && r.top < vh && r.bottom > 0) hit = p; // 맨 아래: 보이는 칸 중 마지막
      });
      mark(hit);
    }
    function queue() { if (!queued) { queued = true; requestAnimationFrame(update); } }
    pairs.forEach(function (p) { p.a.addEventListener("click", function () { pinned = p; mark(p); }); });
    // 사용자가 직접 스크롤을 시작하면 고정을 풀고 다시 화면 위치로 판단
    function unpin(e) {
      if (!pinned) return;
      if (e.type === "keydown" && !/^(Arrow|Page|Home|End| )/.test(e.key)) return;
      if (e.type === "mousedown" && e.target.closest && e.target.closest(".nav-links")) return;
      pinned = null;
      queue();
    }
    ["wheel", "touchstart", "keydown", "mousedown"].forEach(function (t) { window.addEventListener(t, unpin, { passive: true }); });
    window.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", queue);
    update();
    setLabel();
  }

  // 접은 메뉴 열기·닫기: 버튼을 누르면 펼침, 메뉴를 고르거나 바깥을 누르거나 Esc면 닫힘(Esc는 버튼으로 초점을 돌려줌)
  function setupNavMenu() {
    var nav = document.querySelector(".header nav"), btn = nav && nav.querySelector(".nav-toggle");
    if (!btn) return;
    function setOpen(open) {
      nav.classList.toggle("is-open", open);
      btn.setAttribute("aria-expanded", String(open));
    }
    btn.addEventListener("click", function () { setOpen(!nav.classList.contains("is-open")); });
    nav.querySelectorAll(".nav-links a").forEach(function (a) { a.addEventListener("click", function () { setOpen(false); }); });
    document.addEventListener("click", function (e) { if (nav.classList.contains("is-open") && !nav.contains(e.target)) setOpen(false); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && nav.classList.contains("is-open")) { setOpen(false); btn.focus(); }
    });
  }

  function setupToTop() {
    var btn = document.querySelector(".to-top");
    if (!btn) return;
    var calm = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    var on = false, footer = document.querySelector(".footer"), lift = -1;
    function update() {
      // 꼬리말이 화면에 들어오면 버튼을 꼬리말 위(12px 띄움)로 올려 꼬리말 글자를 가리지 않게 (디자인 점검 11번)
      if (footer) {
        var base = parseFloat(getComputedStyle(btn).bottom) || 0;
        var l = Math.max(0, Math.round(window.innerHeight - footer.getBoundingClientRect().top - base + 12));
        if (l !== lift) { lift = l; btn.style.setProperty("--lift", l + "px"); }
      }
      var show = window.scrollY > window.innerHeight * 0.8;
      if (show === on) return;
      on = show;
      btn.classList.toggle("is-on", on);
      btn.tabIndex = on ? 0 : -1;
    }
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
    btn.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: calm ? "auto" : "smooth" });
      var first = document.querySelector("a[href], button");
      if (first && first !== btn) first.focus({ preventScroll: true });
    });
  }

  // 영상 칸 주제 태그(한 줄): 칸보다 길면 is-over(오른쪽 끝 흐림), 끝까지 밀었으면 is-end(흐림 없앰)
  // 언어를 바꾸면 글 길이가 달라지므로 언어를 바꿀 때마다 다시 잼
  var tagRowsWatched = false;
  function checkTagRows() {
    var rows = document.querySelectorAll(".video-tags");
    function check(row) {
      row.classList.toggle("is-over", row.scrollWidth > row.clientWidth + 1);
      row.classList.toggle("is-end", row.scrollLeft + row.clientWidth >= row.scrollWidth - 2);
    }
    rows.forEach(check);
    if (tagRowsWatched || !window.ResizeObserver) return;
    tagRowsWatched = true;
    var ro = new ResizeObserver(function (entries) { entries.forEach(function (e) { check(e.target); }); });
    rows.forEach(function (row) {
      ro.observe(row);
      row.addEventListener("scroll", function () { check(row); }, { passive: true });
    });
  }

  // 캐릭터 눈 깜빡임(영상 칸 · 게임 칸): data-blink="반쯤 감은 그림 감은 그림"
  //   뜬 눈 → 반쯤(50ms) → 감음(70ms) → 반쯤(50ms) → 뜬 눈, 캐릭터마다 2.5~4초 사이 무작위, 다섯 번 중 한 번은 두 번 연속
  //   간격을 바꾸려면 data-blink-gap="가장 짧게,가장 길게"(ms). 게임 칸은 둘이 나란히 있어 더 드물게(5~8초) 깜빡임
  //   그림을 미리 받아 둔 뒤에만 시작(바꿔 끼울 때 깜빡 비는 일 없게), 화면 밖·탭 숨김이면 멈춤, 움직임 줄이기 설정이면 안 함
  function setupBlink() {
    var imgs = document.querySelectorAll("img[data-blink]");
    if (!imgs.length || !("IntersectionObserver" in window)) return;
    if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    imgs.forEach(function (img) {
      var open = img.getAttribute("src");
      var frames = img.dataset.blink.split(" ");
      var gap = (img.dataset.blinkGap || "2500,4000").split(",").map(Number);
      var ready = false, visible = false, timer = 0;
      function preload() {
        if (ready) return;
        Promise.all(frames.map(function (src) { var i = new Image(); i.src = src; return i.decode ? i.decode() : Promise.resolve(); }))
          .then(function () { ready = true; schedule(); }, function () {});
      }
      function set(src) { img.src = src; }
      function blinkOnce(done) {
        set(frames[0]);
        setTimeout(function () { set(frames[1]); }, 50);
        setTimeout(function () { set(frames[0]); }, 120);
        setTimeout(function () { set(open); if (done) done(); }, 170);
      }
      function schedule() {
        clearTimeout(timer);
        if (!ready || !visible || document.hidden) return;
        timer = setTimeout(function () {
          if (!visible || document.hidden) return;
          blinkOnce(function () {
            if (Math.random() < 0.2) setTimeout(function () { blinkOnce(schedule); }, 140);
            else schedule();
          });
        }, gap[0] + Math.random() * (gap[1] - gap[0]));
      }
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        if (visible) { preload(); schedule(); } else { clearTimeout(timer); set(open); }
      }, { rootMargin: "200px" }).observe(img);
      document.addEventListener("visibilitychange", schedule);
    });
  }

  // 문의 전화(tel:) 링크: PC에서 누르면 전화 앱을 찾는 오류 창이 뜸
  //   → 마우스로 쓰는 기기(PC)에서는 링크를 떼어 번호 글자만 남기고, 휴대폰·태블릿(손가락 터치)에서는 그대로 눌러 전화
  function setupTelLinks() {
    var links = document.querySelectorAll(".tel-link");
    if (!links.length || !window.matchMedia) return;
    var pc = matchMedia("(hover: hover) and (pointer: fine)");
    function apply() {
      links.forEach(function (a) {
        if (!a.dataset.tel) a.dataset.tel = a.getAttribute("href") || "";
        if (pc.matches) a.removeAttribute("href");
        else if (a.dataset.tel) a.setAttribute("href", a.dataset.tel);
      });
    }
    apply();
    if (pc.addEventListener) pc.addEventListener("change", apply);
  }

  // 동별 배출요일 (일반 쓰레기 창의 세 번째 탭): 동을 고르면 그 동의 요일을 주간 표에 켜고 요약 문장을 보여 줌.
  //   묶음(data-days)은 mwf = 월·수·금, tts = 화·목·일. 충현동·신촌동은 옛 동(구역)마다 달라 구역 버튼을 한 번 더 보여 줌.
  //   글자는 data-i18n 키를 바꿔 달아 두므로 언어를 바꾸면 applyLang이 함께 번역함
  function setupDays() {
    var lab = document.querySelector('[data-eco-lab="days"]');
    if (!lab) return;
    var GROUP = { mwf: ["mon", "wed", "fri"], tts: ["tue", "thu", "sun"] };
    var nameEl = lab.querySelector("[data-days-name]");
    var sumEl = lab.querySelector("[data-days-sum]");
    var link = lab.querySelector("[data-days-link]");
    var dongBtns = lab.querySelectorAll("[data-dong]");
    var zoneBoxes = lab.querySelectorAll("[data-zones-of]");

    function setText(el, key) {
      if (key) { el.setAttribute("data-i18n", key); el.textContent = t(key); }
      else { el.removeAttribute("data-i18n"); el.textContent = ""; }
      koName(el); // 고른 동 제목에도 한국어 이름
    }
    function showGroup(group) {
      lab.querySelectorAll("[data-day]").forEach(function (li) {
        li.classList.toggle("is-on", !!group && GROUP[group].indexOf(li.dataset.day) > -1);
      });
      setText(sumEl, group ? "days.sum." + group : "");
    }
    function press(list, btn) {
      list.forEach(function (b) { b.setAttribute("aria-pressed", String(b === btn)); });
    }
    // 좁은 화면은 결과 판이 동 버튼 위에 있어 고른 뒤 결과가 화면 밖에 남음 → 결과 판이 보이게 올려 줌
    var board = lab.querySelector(".days-board");
    var calm = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    function reveal() {
      var r = board.getBoundingClientRect();
      if (r.top < 0) board.scrollIntoView({ block: "start", behavior: calm ? "auto" : "smooth" });
    }
    // 높이 미리 잡기: 동 이름(다른 언어면 아래에 한국어 이름 줄)과 요약 문장은 고를 때마다 줄 수가 달라짐
    //   → 좁은 화면(결과 판이 동 버튼 위)에서 아래 동 버튼이 위아래로 밀림. 나올 수 있는 글을 하나씩 넣어 재고 가장 높은 높이를 min-height로
    //   창이 닫혀 판이 안 보이면 재지 않음. 판이 보이게 되거나 폭이 바뀔 때(ResizeObserver), 언어를 바꿀 때(fitters) 다시 잼
    var nameKeys = ["days.pickfirst"];
    dongBtns.forEach(function (b) { nameKeys.push("dong." + b.dataset.dong); });
    var sumKeys = [null, "days.zonepick", "days.sum.mwf", "days.sum.tts"];
    function tallest(el, keys) {
      var key = el.getAttribute("data-i18n"), max = 0;
      el.style.minHeight = "";
      keys.forEach(function (k) { setText(el, k); max = Math.max(max, el.getBoundingClientRect().height); });
      setText(el, key);
      if (max) el.style.minHeight = Math.ceil(max) + "px";
    }
    function reserve() {
      if (!board.offsetWidth) return;
      tallest(nameEl, nameKeys);
      tallest(sumEl, sumKeys);
    }
    fitters.push(reserve);
    if (window.ResizeObserver) {
      var lastW = 0;
      new ResizeObserver(function () {
        var w = board.offsetWidth;
        if (w && w !== lastW) { lastW = w; reserve(); }
      }).observe(board);
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(reserve); // 글꼴이 늦게 받아지면 줄 수가 달라짐
    dongBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var code = btn.dataset.dong, group = btn.dataset.days;
        press(dongBtns, btn);
        setText(nameEl, "dong." + code);
        link.href = "https://www.sdm.go.kr/dong/" + code + "/useful/com/waste.do";
        link.hidden = false;
        zoneBoxes.forEach(function (box) {
          box.hidden = box.dataset.zonesOf !== code;
          box.querySelectorAll("[data-zone]").forEach(function (z) { z.setAttribute("aria-pressed", "false"); });
        });
        showGroup(group === "zone" ? null : group);
        if (group === "zone") setText(sumEl, "days.zonepick");
        else reveal();
      });
    });
    lab.querySelectorAll("[data-zone]").forEach(function (z) {
      z.addEventListener("click", function () {
        press(z.parentNode.querySelectorAll("[data-zone]"), z);
        showGroup(z.dataset.days);
        reveal();
      });
    });
    return reserve; // setupDialogHeight가 창 높이를 잴 때 먼저 글 높이를 잡게
  }

  // 체험 창 높이(PC·태블릿): 창 안 품목 탭 가운데 가장 긴 것에 맞춰 창마다 높이를 정함
  //   창은 화면 세로 가운데 놓여, 탭이나 동을 바꿀 때 높이가 달라지면 창 전체가 위아래로 움직임 → 높이는 고정하되
  //   모든 창을 한 높이(1000px)로 두면 짧은 창은 아래가 크게 빔 → 창마다, 언어·화면 폭에 맞춰 잼(열 때, 언어를 바꿀 때, 폭이 바뀔 때)
  //   숨은 탭은 잠깐 보이게 해 재고 바로 숨김(같은 순간 안이라 화면에 나타나지 않음). 동별 배출요일은 구역 칸이 열린 경우까지 잼
  //   잰 값은 --dlg-h로 넘기고 CSS가 화면 높이와 비교해 작은 쪽을 씀. 휴대폰(700px 이하)은 전체 화면이라 재지 않음
  function setupDialogHeight(daysReserve) {
    var dialogs = document.querySelectorAll("dialog.eco-dialog");
    if (!dialogs.length || !window.matchMedia) return;
    var wide = matchMedia("(min-width: 701px)");
    function fit(dlg) {
      if (!dlg.open) return;
      if (!wide.matches) { dlg.style.removeProperty("--dlg-h"); return; }
      var max = 0, scroll = dlg.scrollTop;
      // 창 높이와 품목 칸의 min-height:100%를 풀어야 품목 칸이 제 길이로 재짐
      //   (창은 화면 위에 띄운 상자라 높이가 auto여도 100%가 창 최대 높이로 풀림 → 칸에도 직접 0을 줌)
      dlg.style.height = "auto";
      dlg.querySelectorAll("[data-eco-lab]").forEach(function (lab) {
        var was = lab.hidden;
        lab.hidden = false;
        lab.style.minHeight = "0";
        if (lab.dataset.ecoLab === "days" && daysReserve) daysReserve();
        max = Math.max(max, lab.offsetHeight);
        lab.querySelectorAll("[data-zones-of]").forEach(function (box) {
          var shut = box.hidden;
          box.hidden = false;
          max = Math.max(max, lab.offsetHeight);
          box.hidden = shut;
        });
        lab.style.minHeight = "";
        lab.hidden = was;
      });
      dlg.style.height = "";
      if (max) dlg.style.setProperty("--dlg-h", Math.ceil(max) + "px");
      dlg.scrollTop = scroll;
    }
    function fitOpen() { dialogs.forEach(fit); }
    dialogs.forEach(function (dlg) {
      dlg.addEventListener("eco:open", function () { fit(dlg); });
    });
    fitters.push(fitOpen);
    window.addEventListener("resize", fitOpen);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitOpen);
  }

  // 학습 띠: 이 브라우저에서 끝낸 단계를 ✓로, 다음에 할 단계를 강조해서 보여줌
  // (기록은 브라우저마다 따로 남고, 다른 기기와 공유되지 않음)
  function setupProgress() {
    var steps = Array.prototype.slice.call(document.querySelectorAll("[data-learn-step]"));
    if (!steps.length) return null;
    var done = {};
    try { done = JSON.parse(localStorage.getItem(PROGRESS_KEY)) || {}; } catch (e) {}
    var ready = {
      video: videoList().length > 0,
      guide: true,
      game: false // 게임이 실제로 올라와 있는지 확인한 뒤 바뀜 (setupGame)
    };
    var countEl = document.querySelector("[data-learn-count]");
    var barEl = document.querySelector("[data-learn-bar]");
    // 받을 배지('분리배출 준비 완료'): 처음부터 흐릿하게 보여 주고, 단계를 모두 끝내면 색이 켜짐
    //   축하(배지가 튀고 나뭇잎이 흩날림)는 한 번만, 학습 띠가 화면에 보이고 탭이 켜져 있을 때 함
    //   (게임은 새 창으로 열리므로, 돌아와서 띠를 볼 때 보이도록 기다렸다가 함. 했다는 기록은 done.cheered)
    var learnEl = document.querySelector(".learn");
    var rewardEl = document.querySelector("[data-learn-reward]");
    var badgeEl = document.querySelector("[data-learn-badge]");
    var earnedBefore = null, cheerPending = false, learnSeen = false;
    function cheerIfSeen() {
      if (!cheerPending || !learnSeen || document.hidden) return;
      cheerPending = false;
      done.cheered = true;
      try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(done)); } catch (e) {}
      if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      learnEl.classList.add("is-cheer");
      for (var i = 0; i < 8; i++) { var leaf = document.createElement("i"); leaf.className = "learn-leaf"; badgeEl.appendChild(leaf); }
      setTimeout(function () {
        learnEl.classList.remove("is-cheer");
        Array.prototype.forEach.call(badgeEl.querySelectorAll(".learn-leaf"), function (l) { l.remove(); });
      }, 1600);
    }
    if (learnEl && badgeEl && "IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) { learnSeen = entries[0].isIntersecting; cheerIfSeen(); }, { threshold: 0.6 }).observe(badgeEl);
      document.addEventListener("visibilitychange", cheerIfSeen);
    }

    function render() {
      var finished = 0, nextFound = false;
      steps.forEach(function (li) {
        var key = li.dataset.learnStep;
        var state = "";
        if (done[key]) state = "done";
        else if (!ready[key]) state = "soon";
        else if (!nextFound) { state = "next"; nextFound = true; }
        if (state === "done") finished++;
        li.dataset.state = state;
        var link = li.querySelector("a");
        if (state === "next") link.setAttribute("aria-current", "step");
        else link.removeAttribute("aria-current");
        var tag = li.querySelector("[data-learn-tag]");
        var label = { done: "learn.done", next: "learn.next", soon: "common.soon" }[state];
        tag.hidden = !label;
        tag.textContent = label ? t(label) : "";
      });
      countEl.textContent = t("learn.progress").replace("{n}", finished).replace("{total}", steps.length);
      barEl.style.transform = "scaleX(" + finished / steps.length + ")";
      // 처음 온 사람에게 "0단계 완료"를 보이지 않도록, 한 단계라도 끝내야 진행 문구를 보임(막대는 배지로 가는 길이라 빈 채로도 보임)
      countEl.hidden = finished === 0;
      if (learnEl && rewardEl) {
        var earned = finished === steps.length;
        learnEl.dataset.got = finished;
        learnEl.toggleAttribute("data-earned", earned);
        rewardEl.textContent = t(earned ? "learn.reward.done" : "learn.reward.todo");
        // 방금 다 마쳤거나, 전에 다 마쳤는데 축하를 아직 못 본 경우 → 띠가 보일 때 한 번
        if (earned && !done.cheered && (earnedBefore === false || earnedBefore === null)) { cheerPending = true; cheerIfSeen(); }
        earnedBefore = earned;
      }
    }

    function mark(key) {
      if (done[key]) return;
      done[key] = true;
      try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(done)); } catch (e) {}
      render();
    }

    // 배출방법: 3D 체험 하나를 마지막 단계까지 보면 완료 (eco3d.js가 알림)
    document.addEventListener("eco:lab-done", function () { mark("guide"); });

    // 영상: 연결된 영상을 모두 거의 끝까지(90%) 보면 완료. 편마다 본 기록을 따로 남김(video-0, video-1 …)
    function watched(index) {
      if (done["video-" + index]) return;
      done["video-" + index] = true;
      var all = videoList().every(function (v) { return done["video-" + v.index]; });
      if (all) mark("video");
      else try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(done)); } catch (e) {}
    }
    // 게임: 실제로 올라와 있는 것을 확인하면 '준비 중' 대신 다음 할 단계로 보임
    function gameReady() { ready.game = true; render(); }

    return { render: render, mark: mark, watched: watched, gameReady: gameReady };
  }

  // 설정의 주소를 이 사이트 안의 주소로 바꿈(다른 사이트 주소면 빈 값: 보안 정책상 어차피 막힘)
  function sameSite(raw) {
    if (!raw) return "";
    try {
      var u = new URL(raw, location.href);
      if (u.origin === location.origin) return u.href;
    } catch (e) { /* 주소 형식이 아님 */ }
    console.warn("config.js의 영상·자막 주소는 이 사이트 안의 파일이어야 합니다:", raw);
    return "";
  }
  // 연결된 영상 목록 (src가 있는 것만, 화면 칸 번호 index 포함)
  function videoList() {
    return (config.videos || []).map(function (v, i) { return { cfg: v || {}, index: i, src: sameSite(v && v.src) }; })
      .filter(function (v) { return v.src; });
  }
  var CAPTION_LABEL = { ko: "한국어", zh: "中文", en: "English", vi: "Tiếng Việt" };

  // 분리배출 영상 칸: 이 사이트의 영상 파일을 재생 (YouTube 광고 없음)
  //  - 누르기 전에는 대표 그림과 재생 버튼만 보이고, 영상 파일은 누를 때 처음 받음(데이터·GitHub 전송량 절약)
  //  - 자막: 4개 언어 자막 파일을 붙이고, 처음에는 사이트 언어에 맞는 자막을 켬. 언어를 바꾸면 재생 중에도 자막이 바뀜
  //    영상 칸 아래 '자막' 단추 줄로 다른 언어 자막을 고르거나 끌 수 있음(renderCaptionBar)
  //  - 거의 끝까지(90%) 보면 학습 띠의 영상 단계에 기록
  var captionLang = null; // 자막 단추 줄을 마지막으로 그린 사이트 언어(언어가 바뀌면 고른 자막을 지우고 새 언어를 따름)

  // ---- 영상 크기: 기본 보기(칸) · 크게 보기(창) · 전체 화면 ----
  // 처음에는 칸 안에서 재생하고, 재생 중 영상 오른쪽 위의 단추로 크기를 바꿈(넓은 화면만, play · renderVideoTools)
  //  - 크게 보기: 영상 칸(표지 · 영상)과 자막 단추 줄을 이 창으로 옮김. 폭은 화면의 약 3/4(최대 1080px)
  //    칸을 통째로 옮기므로 자막 · 표정 · 학습 기록 코드는 그대로 쓰고, 보던 장면에서 이어서 재생
  //  - 창의 '기본 보기': 칸으로 돌아가 이어서 재생(작게 줄여 계속 볼 때)
  //  - ✕ · Esc · 바깥 누르기: 창을 닫고 일시정지(그만 볼 때). 칸에는 멈춘 장면이 남아 재생 단추로 그 자리부터 이어 봄
  //  - 전체 화면: 영상만 화면 가득(영상 조작 막대의 전체 화면 단추와 같음)
  //  - 끝까지 보면 창을 닫고 칸에 '다시 보기'
  //  - 1000px 이하(휴대폰 · 세로 태블릿)는 칸이 화면 폭에 가까워 단추 없이 칸 안에서 재생(전체 화면은 조작 막대로)
  var bigDialog = document.getElementById("video-dialog");
  var BIG_VIEW = window.matchMedia ? matchMedia("(min-width: 1001px)") : null;
  function isBig(frame) { return !!bigDialog && bigDialog._frame === frame; }
  function setBigTitle(frame) {
    bigDialog.querySelector(".video-dialog-ep").textContent = frame.querySelector(".video-ep").textContent;
    bigDialog.querySelector(".video-dialog-title").textContent = frame._card.querySelector("h3").textContent;
  }
  // 칸을 옮기는 동안 재생을 멈추는 브라우저가 있어, 재생 중이었으면 옮긴 뒤 이어서 재생
  function moveFrame(frame, move) {
    var player = frame.querySelector("video");
    var playing = player && !player.paused;
    move();
    if (playing && player.paused) player.play().catch(function () {});
  }
  function openBig(frame) {
    if (!bigDialog || !BIG_VIEW || !BIG_VIEW.matches || bigDialog.open) return;
    var slot = bigDialog.querySelector(".video-dialog-slot");
    moveFrame(frame, function () {
      frame._home = document.createComment("video-frame"); // 돌아올 자리 표시
      frame.before(frame._home);
      slot.appendChild(frame);
      if (frame._bar) slot.appendChild(frame._bar);
    });
    bigDialog._frame = frame;
    setBigTitle(frame);
    bigDialog.showModal();
    renderVideoTools(frame);
    var size = frame.querySelector("[data-video-size]");
    if (size) size.focus({ preventScroll: true });
  }
  function setupBigView() {
    if (!bigDialog) return;
    bigDialog.querySelector("[data-video-close]").addEventListener("click", function () { bigDialog.close(); });
    bigDialog.addEventListener("click", function (e) { if (e.target === bigDialog) bigDialog.close(); });
    bigDialog.addEventListener("close", function () {
      var frame = bigDialog._frame;
      if (!frame) return;
      bigDialog._frame = null;
      // '기본 보기'로 닫았으면 계속 재생, 그 밖(✕ · Esc · 바깥 누르기)은 멈춤. 옮기기 전에 멈춰야 moveFrame이 다시 틀지 않음
      var keep = bigDialog._keepPlaying;
      bigDialog._keepPlaying = false;
      var player = frame.querySelector("video");
      if (player && !keep) player.pause();
      frame.classList.remove("is-cheer");
      moveFrame(frame, function () {
        frame._home.replaceWith(frame);
        if (frame._bar) frame.after(frame._bar);
      });
      renderVideos();
      // 재생 중이면 크기 단추로, 끝나서 닫혔으면 표지(다시 보기)로 초점
      var back = frame.querySelector("[data-video-size]") || frame.querySelector(".video-cover");
      if (back) back.focus({ preventScroll: true });
    });
  }
  // 재생 중 영상 위의 크기 단추 글자: 칸에서는 '크게 보기', 창에서는 '기본 보기'
  function renderVideoTools(frame) {
    var tools = frame.querySelector(".video-tools");
    if (!tools) return;
    var size = tools.querySelector("[data-video-size]");
    size.classList.toggle("is-big", isBig(frame));
    size.querySelector("span").textContent = t(isBig(frame) ? "video.normal" : "video.big");
    tools.querySelector("[data-video-full] span").textContent = t("video.full");
  }
  function renderVideos() {
    var langChanged = captionLang !== current;
    captionLang = current;
    videoList().forEach(function (v) {
      var frame = document.querySelector('[data-video-index="' + v.index + '"]');
      if (!frame) return;
      frame._card = frame._card || frame.closest(".video-card"); // 크게 보기 창으로 옮겨도 원래 카드를 찾도록
      var title = frame._card.querySelector("h3").textContent;
      if (bigDialog && bigDialog._frame === frame) setBigTitle(frame);
      if (langChanged) delete frame.dataset.cap;
      renderCaptionBar(frame, v);
      var player = frame.querySelector("video");
      if (player) { // 이미 재생을 시작한 칸: 이름 · 크기 단추 글자만 맞춤(자막 언어는 renderCaptionBar가 맞춤)
        player.setAttribute("aria-label", title);
        renderVideoTools(frame);
        return;
      }
      var cover = frame.querySelector(".video-cover");
      if (!cover) {
        // 바탕 그림·캐릭터·편 배지는 그대로 두고 '영상 준비 중' 칸만 걷어 냄
        var waiting = frame.querySelector(".video-placeholder");
        if (waiting) waiting.remove();
        cover = document.createElement("button");
        cover.type = "button";
        cover.className = "video-cover";
        var poster = sameSite(v.cfg.poster);
        cover.innerHTML = (poster ? '<img alt="" loading="lazy">' : "") +
          '<span class="play-circle" aria-hidden="true"></span><span class="video-cover-label"></span>';
        if (poster) cover.querySelector("img").src = poster;
        cover.addEventListener("click", function () { play(frame, v); });
        frame.appendChild(cover);
        // 키보드로 표지를 고르면 캐릭터가 웃음(마우스 반응은 setupVideoCheer가 칸 전체에 걸어 둠)
        cover.addEventListener("focus", function () { frame.classList.add("is-cheer"); });
        cover.addEventListener("blur", function () { frame.classList.remove("is-cheer"); });
      }
      // 끝까지 본 칸은 표지로 돌아와 있고(play의 ended), 글자만 '다시 보기'로 바뀜
      var label = t(frame.dataset.ended ? "video.replay" : "video.play");
      cover.querySelector(".video-cover-label").textContent = label;
      cover.setAttribute("aria-label", label + ": " + title);
    });
  }

  // 영상 칸 캐릭터 표정: 칸에 마우스를 올리면 걱정 · 놀람 → 미소(is-cheer). 영상이 아직 없는 칸도 반응함
  // 마우스가 없는 기기(휴대폰)는 칸이 화면에 들어올 때 한 번 미소를 보여 주고 돌아옴(움직임 줄이기 설정이면 안 함)
  // 재생 중에는 영상이 캐릭터를 덮어 보이지 않고, 영상이 끝나 표지로 돌아왔을 때 마우스가 아직 칸 위에 있으면 웃는 채로 보임
  function setupVideoCheer() {
    var touchOnce = window.matchMedia && "IntersectionObserver" in window &&
      matchMedia("(hover: none)").matches && !matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.querySelectorAll(".video-frame").forEach(function (frame) {
      if (!frame.querySelector(".video-char.alt")) return;
      function cheer(on) { return function () { frame.classList.toggle("is-cheer", on); }; }
      frame.addEventListener("mouseenter", cheer(true));
      frame.addEventListener("mouseleave", cheer(false));
      if (!touchOnce) return;
      var io = new IntersectionObserver(function (entries) {
        if (!entries[0].isIntersecting) return;
        io.disconnect();
        setTimeout(cheer(true), 500);
        setTimeout(cheer(false), 2000);
      }, { threshold: 0.7 });
      io.observe(frame);
    });
  }

  // (자막을 직접 그리게 된 뒤로는 영상만 전체 화면일 때의 브라우저 자막에만 해당. 칸 · 크게 보기의 자막 자리는 setupSubs가 맞춤)
  // 자막 위치 맞추기: 브라우저(크롬)는 조작 막대가 나타나면 자막을 막대 위로 올리지만, 막대가 사라질 때는
  // 떠 있는 자막을 그 자리에 두고 다음 자막부터 내려놓음. 그래서 막대가 사라진 뒤와 다시 나타날 때 보이는 자막을
  // 껐다 켜 브라우저가 지금 막대 상태에 맞게 다시 놓게 함(껐다 켜도 깜빡임은 보이지 않았음)
  //  - 2026-11 실험(크롬): 마우스를 빼면 막대는 0.5초 안에 사라지지만 껐다 켜기는 1초 뒤부터 들음(0.6초에는 그대로).
  //    영상 위에서 움직이지 않으면 막대는 약 2초 뒤 사라짐
  //  - 막대가 사라지는 때는 브라우저가 알려 주지 않아 시간으로 맞추고, 놓치지 않게 두 번씩 함
  //    (마우스를 빼고 1.2 · 2초, 멈추고 3 · 4초). 브라우저가 이 시간을 바꾸면 조금 늦게 내려올 수 있음
  //    (그래도 다음 자막에서는 브라우저가 스스로 맞춤)
  //  - 영상 위에서 멈춰 있으면 크기 단추(.video-tools)도 막대가 사라질 때(2초) 함께 감춤(is-idle)
  //  - 마우스가 있는 기기만(휴대폰은 막대가 탭으로 나타나고 영상 칸이 화면 폭에 가까워 그대로 둠)
  function setupCueRelayout() {
    if (!window.matchMedia || !matchMedia("(hover: hover)").matches) return;
    document.querySelectorAll(".video-frame").forEach(function (frame) {
      var timers = [];
      function clear() { timers.forEach(clearTimeout); timers = []; }
      function at(ms, fn) { timers.push(setTimeout(fn, ms)); }
      function relayout() {
        var player = frame.querySelector("video");
        if (!player) return;
        Array.prototype.forEach.call(player.textTracks, function (track) {
          if (track.mode !== "showing" || !track.activeCues || !track.activeCues.length) return;
          track.mode = "hidden";
          track.mode = "showing";
        });
      }
      function playing() { var player = frame.querySelector("video"); return player && !player.paused; } // 멈춘 동안은 막대가 계속 보임
      frame.addEventListener("mousemove", function () {
        var wasIdle = frame.classList.contains("is-idle");
        clear();
        frame.classList.remove("is-idle");
        if (wasIdle) at(80, relayout); // 막대가 다시 나타남
        at(2000, function () { if (playing()) frame.classList.add("is-idle"); });
        at(3000, function () { if (playing()) relayout(); });
        at(4000, function () { if (playing()) relayout(); });
      });
      frame.addEventListener("mouseenter", function () { clear(); at(80, relayout); });
      frame.addEventListener("mouseleave", function () {
        clear();
        frame.classList.remove("is-idle");
        at(1200, relayout);
        at(2000, relayout);
      });
    });
  }

  function play(frame, v) {
    var player = document.createElement("video");
    player.controls = true;
    player.playsInline = true;
    player.preload = "auto";
    // 조작 막대 ⋮ 메뉴에서 다운로드 · 재생 속도 · PIP · 전송을 뺌(구청 11/27: 휴대폰 카카오톡 안 브라우저에서 이 메뉴 창이 닫히지 않음).
    // 자막은 영상 아래 '자막' 단추로 고름. 한계: 브라우저가 이 표시를 무시하면 메뉴가 그대로 나옴(크롬 계열은 따름)
    player.setAttribute("controlslist", "nodownload noplaybackrate noremoteplayback");
    player.disablePictureInPicture = true;
    player.disableRemotePlayback = true;
    var poster = sameSite(v.cfg.poster);
    if (poster) player.poster = poster;
    player.setAttribute("aria-label", frame._card.querySelector("h3").textContent);
    var source = document.createElement("source");
    source.src = v.src;
    source.type = "video/mp4";
    player.appendChild(source);
    var caps = v.cfg.captions || {};
    var choice = captionChoice(frame);
    LANGS.forEach(function (lang) {
      var src = sameSite(caps[lang]);
      if (!src) return;
      var track = document.createElement("track");
      track.kind = "subtitles";
      track.srclang = lang;
      track.label = CAPTION_LABEL[lang];
      track.src = src;
      track.default = lang === choice; // 브라우저가 스스로 다른 언어 자막을 고르지 않게 고른 자막(기본은 사이트 언어)을 기본으로
      player.appendChild(track);
      // 지금 자막이 바뀔 때마다 영상 위에 직접 그림(drawSubs). 고른 트랙만 hidden이라 그 트랙에서만 옴
      (track.track || track).addEventListener("cuechange", function () { drawSubs(frame); });
    });
    // 브라우저가 영상 정보를 읽은 뒤 자막을 다시 고르는 경우가 있어 그때 한 번 더 맞춤
    player.addEventListener("loadedmetadata", function () { applyCaption(frame); });
    // 영상 조작 막대의 자막 메뉴로 바꾼 것도 아래 단추 줄에 반영(재생을 시작한 뒤부터: 그 전에 브라우저가 스스로 고르는 것은 따르지 않음)
    //  - 자막을 직접 그리는 동안(칸 · 크게 보기)에는 고른 트랙이 hidden이라 '보이는(showing) 트랙'이 없음
    //    → 메뉴에서 언어를 고른 때(showing이 생김)만 그 언어로 바꿈. 메뉴의 '끔'은 알 수 없어, 끄기는 아래 단추 줄로
    //  - 영상만 전체 화면일 때는 브라우저 자막을 쓰므로(nativeSubs) 메뉴의 '끔'도 그대로 따름
    //  - 어느 경우든 마지막에 고른 값대로 다시 놓음(이미 맞으면 바꾸지 않으므로 되풀이되지 않음)
    var started = false;
    player.addEventListener("playing", function () { started = true; });
    player.textTracks.addEventListener("change", function () {
      if (!player.isConnected) return;
      var showing = Array.prototype.filter.call(player.textTracks, function (track) { return track.mode === "showing"; })[0];
      if (started && (showing || nativeSubs(frame))) {
        var now = showing ? showing.language : "off";
        if (now !== shownCaption(frame, v)) frame.dataset.cap = now;
      }
      applyCaption(frame);
    });
    // 아이폰은 영상 전체 화면이 따로 있어(document의 fullscreenchange가 오지 않음) 영상이 직접 알려 줌
    player.addEventListener("webkitbeginfullscreen", function () { frame._iosFull = true; applyCaption(frame); });
    player.addEventListener("webkitendfullscreen", function () { frame._iosFull = null; applyCaption(frame); keepInView(frame); });
    var counted = false;
    player.addEventListener("timeupdate", function () {
      if (!counted && player.duration && player.currentTime / player.duration >= 0.9) {
        counted = true;
        if (progress) progress.watched(v.index);
      }
    });
    // 표지(바탕 · 캐릭터 · 편 배지 · 버튼)는 지우지 않고 영상을 그 위에 덮음. 영상이 끝나면 영상만 걷어 표지로 돌아감
    // (그대로 두면 브라우저가 마지막 장면을 띄워 두는데, 영상이 검게 사라지며 끝나 검은 칸만 남음)
    var cover = frame.querySelector(".video-cover");
    // 크기 단추(영상 오른쪽 위): 크게 보기 ↔ 기본 보기, 전체 화면. 넓은 화면에서만 보임(CSS .video-tools)
    var tools = document.createElement("div");
    tools.className = "video-tools";
    tools.innerHTML =
      '<button type="button" data-video-size><svg class="i-big" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/></svg>' +
      '<svg class="i-normal" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10h-6V4M4 14h6v6M14 10l7-7M10 14l-7 7"/></svg><span></span></button>' +
      '<button type="button" data-video-full><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/></svg><span></span></button>';
    tools.querySelector("[data-video-size]").addEventListener("click", function () {
      if (isBig(frame)) { bigDialog._keepPlaying = true; bigDialog.close(); } else openBig(frame);
    });
    tools.querySelector("[data-video-full]").addEventListener("click", function () {
      var full = player.requestFullscreen || player.webkitRequestFullscreen || player.webkitEnterFullscreen;
      if (full) Promise.resolve(full.call(player)).catch(function () { /* 전체 화면이 막힌 브라우저: 조작 막대로 */ });
    });
    // 멈춘 동안에는 단추를 계속 보임(재생 중에는 마우스를 올리거나 키보드로 고를 때)
    player.addEventListener("pause", function () { frame.classList.add("is-paused"); });
    player.addEventListener("play", function () { frame.classList.remove("is-paused"); });
    // 자막을 그릴 칸(영상 위, 크기 단추 아래). 자막 글자는 drawSubs가 채움
    var subs = document.createElement("div");
    subs.className = "video-subs";
    frame._subs = subs;
    player.addEventListener("ended", function () {
      player.remove();
      tools.remove();
      subs.remove();
      frame._subs = null;
      frame._iosFull = null;
      frame.classList.remove("is-paused");
      frame.dataset.ended = "1";
      cover.hidden = false;
      if (isBig(frame)) { bigDialog.close(); return; } // 창을 닫으면 칸을 제자리로 돌리고 '다시 보기'를 보임(close)
      renderVideos();
      cover.focus({ preventScroll: true });
    });
    delete frame.dataset.ended;
    cover.hidden = true;
    frame.appendChild(player);
    frame.appendChild(subs);
    frame.appendChild(tools);
    renderVideoTools(frame);
    applyCaption(frame);
    if (frame._showBar) frame._showBar(2700); // 표지를 눌러 시작하면 마우스가 영상 위에 있어 조작 막대가 잠깐 보임 → 그동안 자막 자리를 막대 위로
    player.play().catch(function () { /* 자동 재생이 막히면 재생 버튼으로 직접 시작 */ });
    player.focus();
  }

  // ---- 자막 고르기 ----
  // 영상 칸 바로 아래의 단추 줄: 자막  [한국어] [中文] [English] [Tiếng Việt] [끔]
  //  - 고르지 않았으면 사이트 언어의 자막(예전과 같음). 단추를 누르면 그 언어 자막으로, 재생 중에도 바로 바뀜
  //  - 고른 값은 칸(frame.dataset.cap)에 남아 다시 볼 때도 쓰고, 사이트 언어를 바꾸면 지워져 새 언어를 따름(renderVideos)
  //  - 영상의 화면 글자는 한국어 그대로이고, 중국어·영어·베트남어 자막에는 화면 글자 설명이 함께 들어 있음(media/ep1.*.vtt의 <c.note>)
  function captionLangs(v) {
    var caps = v.cfg.captions || {};
    return LANGS.filter(function (lang) { return sameSite(caps[lang]); });
  }
  // 고른 자막: 언어 값 또는 "off" (고르지 않았으면 사이트 언어)
  function captionChoice(frame) { return frame.dataset.cap || current; }
  // 실제로 보이는 자막: 고른 언어의 자막 파일이 없으면 꺼진 것으로 봄
  function shownCaption(frame, v) {
    var choice = captionChoice(frame);
    return captionLangs(v).indexOf(choice) > -1 ? choice : "off";
  }
  function renderCaptionBar(frame, v) {
    var bar = frame._bar; // 크게 보기 창으로 함께 옮겨 다니므로 칸에 붙여 둔 것을 씀
    var langs = captionLangs(v);
    if (!langs.length) { if (bar) { bar.remove(); frame._bar = null; } return; } // 자막 파일이 없는 영상은 단추 줄도 없음
    if (!bar) {
      bar = document.createElement("div");
      bar.className = "video-caps";
      bar.setAttribute("role", "group");
      var label = document.createElement("span");
      label.className = "video-caps-label";
      bar.appendChild(label);
      langs.concat("off").forEach(function (key) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.dataset.cap = key;
        if (key !== "off") { // 언어 이름은 그 언어로 적음(사이트 언어와 관계없이 찾을 수 있게)
          btn.textContent = CAPTION_LABEL[key];
          btn.lang = HTML_LANG[key];
        }
        btn.addEventListener("click", function () {
          frame.dataset.cap = key;
          applyCaption(frame);
        });
        bar.appendChild(btn);
      });
      bar._video = v;
      frame._bar = bar;
      frame.insertAdjacentElement("afterend", bar);
    }
    bar.setAttribute("aria-label", t("video.caption"));
    bar.querySelector(".video-caps-label").textContent = t("video.caption");
    bar.querySelector('[data-cap="off"]').textContent = t("video.caption.off");
    applyCaption(frame);
  }
  // 단추 줄의 눌림 표시와 재생 중인 영상의 자막을 고른 값에 맞춤
  function applyCaption(frame) {
    var bar = frame._bar;
    if (!bar) return;
    var shown = shownCaption(frame, bar._video);
    bar.querySelectorAll("button").forEach(function (btn) {
      btn.setAttribute("aria-pressed", String(btn.dataset.cap === shown));
    });
    var player = frame.querySelector("video");
    if (!player) return;
    // 고른 자막: 보통은 hidden(브라우저는 그리지 않고 지금 자막만 알려 줌 → drawSubs가 영상 속 글자 모양으로 그림),
    // 영상만 전체 화면일 때는 showing(브라우저 자막). 값이 같으면 다시 넣지 않음(change 이벤트가 되풀이되지 않게)
    var native = nativeSubs(frame);
    Array.prototype.forEach.call(player.textTracks, function (track) {
      var mode = track.language !== shown ? "disabled" : native ? "showing" : "hidden";
      if (track.mode !== mode) track.mode = mode;
    });
    drawSubs(frame);
  }

  // ---- 자막 그리기 ----
  // 브라우저 기본 자막(검은 띠 + 흰 글자) 대신 영상 속 글자와 같은 모양으로 영상 위에 직접 그림(css .video-subs):
  // 굵은 흰 글자 + 짙은 초록 테두리, 핵심어는 연두(자막 파일의 <c.hl>), 화면 글자 설명(<c.note>, [On screen] …)은 연두 딱지 + 한 단계 작은 글자,
  // 자막이 바뀔 때 0.15초 동안 살짝 떠오르며 나타남(영상 편집의 자막 줄과 같은 값)
  //  - 그리는 곳: 칸 안과 크게 보기 창(영상 칸을 통째로 옮기므로 그대로 따라감)
  //  - 영상만 전체 화면일 때는 겹쳐 그린 글자가 보이지 않아 브라우저 자막으로 바꿈(applyCaption). 모양은 css의 ::cue로 비슷하게 맞춤
  //    (아이폰 전체 화면은 기기 자막 설정을 따름)
  function nativeSubs(frame) {
    var player = frame.querySelector("video");
    if (!player) return false;
    if (frame._iosFull) return true;
    return (document.fullscreenElement || document.webkitFullscreenElement) === player;
  }
  var SUB_TAG = /^\s*\[([^\]]+)\]\s*/; // 화면 글자 설명 첫 줄 앞의 표시 [On screen] · [画面文字] · [Trên màn hình] → 딱지로
  var SUB_CHARS = { amp: "&", lt: "<", gt: ">", nbsp: "\u00a0", lrm: "", rlm: "" };
  // 자막 한 개의 글(WebVTT)을 줄 · 조각으로: [[{ text, hl, note }, …], …]. <c.hl> · <c.note> 말고 다른 표시는 글자만 남김
  function parseCue(text) {
    var lines = [[]], open = [], m;
    var re = /<(\/?)([a-zA-Z]*)((?:\.[^\s.<>]+)*)[^<>]*>|\r?\n|[^<\r\n]+|</g;
    while ((m = re.exec(text))) {
      var tok = m[0];
      if (tok === "\n" || tok === "\r\n") { lines.push([]); continue; }
      if (tok.length > 1 && tok.charAt(0) === "<") { // 표시: 닫으면 하나 빼고, 열면 class를 쌓음(시각 표시 <00:01.000>는 이름이 없어 건너뜀)
        if (m[1]) open.pop(); else if (m[2]) open.push(m[3]);
        continue;
      }
      var cls = open.join("") + ".";
      lines[lines.length - 1].push({
        text: tok.replace(/&(amp|lt|gt|nbsp|lrm|rlm);/g, function (all, name) { return SUB_CHARS[name]; }),
        hl: cls.indexOf(".hl.") > -1,
        note: cls.indexOf(".note.") > -1
      });
    }
    return lines.filter(function (line) { return line.length; });
  }
  // 자막 한 줄: 글자를 두 겹으로 그림(.vs-edge 테두리 위에 .vs-face 글자) → 테두리가 글자를 파먹지 않고 어느 브라우저에서나 같은 모양
  function subRow(line) {
    var note = line[0].note, tag = "";
    if (note) {
      var m = SUB_TAG.exec(line[0].text);
      if (m) { tag = m[1]; line = [{ text: line[0].text.slice(m[0].length) }].concat(line.slice(1)); }
    }
    var row = document.createElement("p");
    row.className = "video-sub-row" + (note ? " is-note" : "");
    ["vs-edge", "vs-face"].forEach(function (name) {
      var layer = document.createElement("span");
      layer.className = name;
      if (name === "vs-edge") layer.setAttribute("aria-hidden", "true");
      if (tag) {
        var chip = document.createElement("span");
        chip.className = "video-sub-tag";
        chip.textContent = tag;
        layer.appendChild(chip);
      }
      line.forEach(function (seg) {
        if (!seg.text) return;
        if (seg.hl && name === "vs-face") {
          var hl = document.createElement("span");
          hl.className = "hl";
          hl.textContent = seg.text;
          layer.appendChild(hl);
        } else layer.appendChild(document.createTextNode(seg.text));
      });
      row.appendChild(layer);
    });
    return row;
  }
  function drawSubs(frame) {
    var box = frame._subs;
    if (!box) return;
    var player = frame.querySelector("video");
    var shown = frame._bar ? shownCaption(frame, frame._bar._video) : "off";
    var cues = [];
    if (player && shown !== "off" && !nativeSubs(frame)) {
      Array.prototype.forEach.call(player.textTracks, function (track) {
        if (track.language === shown && track.mode === "hidden" && track.activeCues) cues = Array.prototype.slice.call(track.activeCues);
      });
    }
    var key = shown + cues.map(function (cue) { return "|" + cue.startTime + "|" + cue.text; }).join("");
    if (box._key === key) return; // 같은 자막이면 그대로 둠(나타나는 움직임을 되풀이하지 않게)
    box._key = key;
    box.textContent = "";
    box.lang = HTML_LANG[shown] || ""; // 글꼴 · 줄 나눔이 자막 언어를 따르게(css :lang)
    cues.forEach(function (cue) {
      var item = document.createElement("div");
      item.className = "video-sub";
      parseCue(cue.text).forEach(function (line) { item.appendChild(subRow(line)); });
      box.appendChild(item);
    });
    fitSubs(frame);
  }
  // 글자 크기와 자리: 영상 폭에 맞춤. 영상 속 자막은 폭 1920에 50px(2.6%)인데 칸이 작아 2.9%로 조금 키우고 15~62px 사이로 둠.
  // 줄이 칸보다 길면 한 줄에 들어가게 줄이고(85%까지), 그래도 넘치면 줄을 나눔(휴대폰의 긴 문장)
  function fitSubs(frame) {
    var box = frame._subs;
    if (!box) return;
    var w = frame.clientWidth;
    if (!w) return;
    var size = Math.min(62, Math.max(15, w * 0.029));
    box.classList.remove("is-wrap");
    box.style.fontSize = size + "px";
    box.style.setProperty("--subs-low", Math.max(8, Math.round(w * 0.021)) + "px"); // 영상 속 자막 자리(높이의 3.7% = 폭의 2.1%)
    var room = box.clientWidth, widest = 0;
    Array.prototype.forEach.call(box.querySelectorAll(".video-sub-row"), function (row) { widest = Math.max(widest, row.offsetWidth); });
    if (widest <= room) return;
    if (room / widest >= 0.85) box.style.fontSize = Math.floor(size * room / widest * 10) / 10 + "px";
    else box.classList.add("is-wrap");
  }
  // 자막 자리: 조작 막대가 보이는 동안은 막대 위로 올림(is-bar, css). 브라우저가 막대를 언제 보이고 감추는지 알려 주지 않아 같은 때를 흉내 냄
  //  - 마우스: 영상 위에서 움직이면 막대가 보이고 2.5초 가만히 있으면 사라짐(크롬) → 2.7초 뒤 내림. 영상 밖으로 나가면 바로 사라짐 → 0.3초 뒤
  //  - 손가락: 영상을 누르면 약 3초 보임 → 3.3초 뒤 내림
  //  - 멈춘 동안에는 막대가 계속 보임(is-paused, play가 붙임)
  //  - 칸 크기가 바뀌면(창 크기 · 크게 보기) 글자 크기를 다시 맞춤
  function setupSubs() {
    document.querySelectorAll(".video-frame").forEach(function (frame) {
      var timer = 0;
      frame._showBar = function (ms) {
        clearTimeout(timer);
        frame.classList.add("is-bar");
        timer = setTimeout(function () { frame.classList.remove("is-bar"); }, ms);
      };
      frame.addEventListener("pointermove", function (e) { if (e.pointerType === "mouse") frame._showBar(2700); });
      frame.addEventListener("pointerleave", function (e) { if (e.pointerType === "mouse") frame._showBar(300); });
      frame.addEventListener("pointerup", function (e) { if (e.pointerType !== "mouse") frame._showBar(3300); });
      frame.addEventListener("keydown", function () { frame._showBar(2700); });
      if (window.ResizeObserver) new ResizeObserver(function () { fitSubs(frame); }).observe(frame);
    });
    // 영상이 전체 화면에 들어가고 나올 때: 브라우저 자막 ↔ 직접 그린 자막
    // 나올 때는 영상 칸이 화면에 보이게 되돌림(keepInView)
    var fullFrame = null;
    ["fullscreenchange", "webkitfullscreenchange"].forEach(function (name) {
      document.addEventListener(name, function () {
        document.querySelectorAll(".video-frame").forEach(function (frame) { if (frame._subs) applyCaption(frame); });
        var el = document.fullscreenElement || document.webkitFullscreenElement;
        if (el) { fullFrame = el.closest ? el.closest(".video-frame") : null; return; }
        if (fullFrame) { keepInView(fullFrame); fullFrame = null; }
      });
    });
  }
  // 휴대폰에서 영상 전체 화면을 나오면 브라우저가 페이지를 맨 위로 돌려 영상이 안 보이는 경우가 있음(구청 11/27)
  // → 나온 직후와 화면 크기가 돌아온 뒤(가로 → 세로) 두 번, 영상 칸이 화면 밖이면 칸을 가운데로 데려옴
  function keepInView(frame) {
    [120, 600].forEach(function (ms) {
      setTimeout(function () {
        if (!frame.isConnected || document.fullscreenElement || document.webkitFullscreenElement) return;
        var r = frame.getBoundingClientRect();
        if (r.bottom > 0 && r.top < window.innerHeight) return;
        frame.scrollIntoView({ block: "center", behavior: "instant" });
      }, ms);
    });
  }

  // 설정(config.js)의 게임 주소를 검사: https 주소만 씀(내 컴퓨터에서 시험할 때 localhost는 http도). 아니면 "준비 중"으로 둠
  function gameUrl() {
    var raw = config.game && config.game.url;
    if (!raw) return "";
    try {
      var u = new URL(raw, location.href);
      if (u.protocol === "https:" || (u.protocol === "http:" && /^(localhost|127\.0\.0\.1)$/.test(u.hostname))) return u.href;
    } catch (e) { /* 주소 형식이 아님 */ }
    console.warn("config.js의 game.url은 https 주소여야 합니다:", raw);
    return "";
  }

  // 게임 주소가 있어도 실제로 올라와 있는지(파일이 있는지) 먼저 확인. 같은 사이트 주소일 때만 확인 가능(다른 사이트면 있다고 봄)
  // '게임 시작' → 게임 첫 화면(분리배출 러시 · 서대문 새내기 일주일 고르기)이 새 창에서 열림
  // (예전에는 이 페이지에 고르기 창이 따로 있었으나 게임 첫 화면과 같은 선택을 두 번 해서 뺌, 11/28)
  function setupGame() {
    var button = document.getElementById("game-play");
    var status = document.getElementById("game-status");
    var stage = document.getElementById("game-stage");
    var game = config.game || {};
    var url = gameUrl(), live = false;
    // 게임 주소 + ?lang=지금 언어 (게임이 홈페이지와 같은 언어로 시작)
    function langUrl() {
      var u = new URL(url);
      u.searchParams.set("lang", current);
      return u.href;
    }
    if (url) {
      var check = new URL(url).origin === location.origin
        ? fetch(url, { method: "HEAD", cache: "no-store" }).then(function (r) { return r.ok; })
        : Promise.resolve(true);
      check.then(function (ok) {
        if (!ok) return;
        live = true;
        status.hidden = true;
        stage.classList.add("is-ready");
        if (progress) progress.gameReady();
      }).catch(function () { /* 확인 실패: 준비 중으로 둠 */ });
    }

    // 새 창으로 열기. 이 페이지 안에 띄우는 설정(embed)이면 이 칸에 띄움
    button.addEventListener("click", function () {
      if (!live) {
        status.hidden = false;
        return;
      }
      if (progress) progress.mark("game");
      if (game.embed) embed(langUrl());
      else window.open(langUrl(), "_blank", "noopener");
    });

    function embed(src) {
      var iframe = document.createElement("iframe");
      iframe.src = src;
      iframe.title = t("game.title");
      iframe.allow = "fullscreen; autoplay";
      // 게임 화면이 이 페이지를 다른 곳으로 옮기거나 새 창·양식 제출을 못 하게 제한 (게임 실행·저장·마우스 잠금만 허용)
      // 한계: 게임이 이 사이트와 같은 주소(sdm-eco.github.io)에 있으면 allow-same-origin 때문에 제한을 풀 수 있음 → 다른 주소에 둘 때 효과가 큼
      iframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-pointer-lock");
      stage.innerHTML = "";
      stage.classList.add("is-playing");
      stage.appendChild(iframe);
    }
  }

  // 게임 칸 캐릭터의 표정 · 말풍선 (눈 깜빡임은 setupBlink가 따로 맡음)
  //  - 시작 버튼에 마우스를 올리거나 키보드로 고르면 둘 다 웃는 표정(is-cheer)
  //  - 칸이 화면에 들어오면 한 번: 아래에서 올라옴 → 남학생 "잠깐!" → 여학생이 활짝 웃으며 "정답!" (게임 안의 틀림 · 맞힘 반응을 미리 보여 줌)
  //  - 움직임 줄이기 설정이면 등장 장면은 하지 않음(표정 바꿈만)
  function setupGameChars() {
    var stage = document.getElementById("game-stage");
    var button = document.getElementById("game-play");
    if (!stage || !button || !stage.querySelector(".game-chars .alt")) return;
    function cheer(on) { return function () { stage.classList.toggle("is-cheer", on); }; }
    button.addEventListener("mouseenter", cheer(true));
    button.addEventListener("mouseleave", cheer(false));
    button.addEventListener("focus", cheer(true));
    button.addEventListener("blur", cheer(false));
    if (!("IntersectionObserver" in window)) return;
    if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    stage.classList.add("anim");
    // [시각(ms), 클래스, 켬/끔]
    var SCENE = [[750, "say-stop", true], [1950, "say-stop", false], [2050, "is-laugh", true], [2050, "say-ok", true], [3350, "say-ok", false], [3450, "is-laugh", false]];
    var io = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) return;
      io.disconnect();
      stage.classList.add("is-in");
      SCENE.forEach(function (s) { setTimeout(function () { stage.classList.toggle(s[1], s[2]); }, s[0]); });
    }, { threshold: 0.5 });
    io.observe(stage.querySelector(".game-chars"));
  }

  document.querySelectorAll(".lang-switch button").forEach(function (btn) {
    btn.addEventListener("click", function () {
      saveLang(btn.dataset.lang);
      var url = new URL(location.href);
      if (url.searchParams.has("lang")) {
        url.searchParams.set("lang", btn.dataset.lang);
        history.replaceState(null, "", url);
      }
      applyLang(btn.dataset.lang);
    });
  });

  // 새로고침하면 항상 맨 위에서 시작: 브라우저가 이전 위치나 주소의 #섹션으로 내려가지 않게 함
  // (처음 방문과 메뉴 이동은 그대로. 한계: 새로고침 전에 보던 위치는 기억하지 않음)
  function startAtTopOnReload() {
    var entry = performance.getEntriesByType ? performance.getEntriesByType("navigation")[0] : null;
    if (!entry || entry.type !== "reload") return;
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    if (location.hash) history.replaceState(null, "", location.pathname + location.search);
    function toTop() {
      // html의 부드러운 스크롤 때문에 위로 미끄러지는 모습이 보이지 않게 잠시 끔
      var root = document.documentElement;
      root.style.scrollBehavior = "auto";
      window.scrollTo(0, 0);
      root.style.scrollBehavior = "";
    }
    toTop();
    // 브라우저는 다 불러온 뒤에 #섹션으로 한 번 더 내려가므로, 그 다음 차례에 다시 올림
    window.addEventListener("load", function () { toTop(); setTimeout(toTop, 0); });
  }

  // 배너 그림(object-fit:cover, 원본 1344×756)의 좌표를 지금 화면 좌표로 바꾸는 함수. s = 그림 배율
  function sceneMap(scene, img) {
    var IW = 1344, IH = 756;
    var w = scene.clientWidth, h = scene.clientHeight;
    if (!w || !h) return null;
    var pos = getComputedStyle(img).objectPosition.split(" ").map(function (v) { return parseFloat(v) / 100; });
    var s = Math.max(w / IW, h / IH);
    return { s: s, at: function (x, y) { return [(w - IW * s) * pos[0] + x * s, (h - IH * s) * pos[1] + y * s]; } };
  }

  // 그림 속 초록 수거함에 그려진 ♻가 은은하게 밝아졌다 흐려졌다를 계속 반복 (CSS 애니메이션)
  // 노란 통은 바탕이 밝아 잘 안 보이고 두 개가 번갈아 깜빡이면 산만해서 초록 통 하나만 씀
  // 같은 그림을 ♻ 자리에만 겹쳐 놓고 CSS 필터로 흰 화살표만 남겨(나머지는 검정 → screen 합성으로 안 보임) 빛나게 함
  // → 그려진 ♻와 모양이 정확히 같음. 화면 크기가 바뀌면 자리를 다시 맞춤. 움직임 줄이기 설정이면 보이지 않음
  function setupBinMarks() {
    var scene = document.querySelector(".hero-scene");
    var img = scene && scene.querySelector("img");
    if (!img || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var BOX = 48; // ♻ 둘레를 덮는 칸 크기(그림 원본 기준 px)
    var marks = [[761, 484]].map(function (p) {
      var el = document.createElement("span");
      el.className = "bin-mark";
      el.setAttribute("aria-hidden", "true");
      el.innerHTML = "<i></i><i></i>"; // 또렷한 화살표 + 번진 빛무리
      el.style.setProperty("--bg", "url(" + img.currentSrc + ")");
      el.classList.add("is-green"); // 초록 통은 ♻가 더 어두워 기준이 다름
      scene.appendChild(el);
      return { el: el, p: p };
    });
    function place() {
      var m = sceneMap(scene, img);
      if (!m) return;
      var o = m.at(0, 0), size = BOX * m.s;
      marks.forEach(function (k) {
        var q = m.at(k.p[0], k.p[1]), left = q[0] - size / 2, top = q[1] - size / 2;
        k.el.style.left = left + "px";
        k.el.style.top = top + "px";
        k.el.style.width = k.el.style.height = size + "px";
        k.el.style.setProperty("--bs", 1344 * m.s + "px " + 756 * m.s + "px");
        k.el.style.setProperty("--bp", o[0] - left + "px " + (o[1] - top) + "px");
      });
    }
    new ResizeObserver(place).observe(scene);
    if (img.complete) place(); else img.addEventListener("load", place, { once: true });
  }

  // 움직임 줄이기 설정을 페이지를 연 뒤에 켜거나 꺼도 그림 위 효과(머리·폭포·새)가 따르게 함
  // 켜면 그리기를 멈추고 겹친 요소를 숨겨 원래 그림으로, 끄면 다시 보이고 시작. els: 숨길 요소 목록을 돌려주는 함수
  var reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  // 돌려주는 sync()는 그리기 루프에서도 불러, 변경 알림이 늦거나 오지 않는 환경에서도 바로 숨김
  function followReducedMotion(els, start) {
    var off = false;
    function sync() {
      var r = reduceMotion.matches;
      if (r === off) return;
      off = r;
      els().forEach(function (el) { el.hidden = r; });
      if (!r) start();
    }
    reduceMotion.addEventListener("change", sync);
    return sync;
  }

  // 배너 그림 속 인물의 작은 움직임 (그림 위에 원본에서 따낸 조각을 겹쳐 픽셀을 옮겨 그림)
  //  - 두 번째 여학생(단발): 머리끝이 바람에 찰랑임 (파란 재킷 남학생의 손짓은 빼기로 함)
  // 원본 그림 좌표 box에서 잘라낸 그림들:
  //   plate: 움직이는 부분을 지우고 주변 색으로 메운 판 (움직여 드러난 자리에 원래 모습이 비치지 않게)
  //   layers: 판 위에 아래→위 순서로 겹치는 조각. move가 이번 그림에서 각 점이 밀린 거리(dx, dy)를 정함
  // 움직임 줄이기 설정이면 안 움직이고, 배너가 화면 밖이거나 탭이 숨으면 멈춤
  // 한계: 픽셀마다 CPU로 계산(조각이 작아 가벼움, 초당 30번). 조각이 크거나 많아지면 WebGL로 옮길 것
  function setupFigures() {
    var scene = document.querySelector(".hero-scene");
    var img = scene && scene.querySelector("img");
    if (!img || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var smooth = function (t) { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };

    // 여학생: 상자 105x92. 머리카락이 귀 높이(y 32)에서 0 → 머리끝(y 86)에서 1로 흔들림,
    //   얼굴 옆 머리(x 72 오른쪽)는 0.55배, 끝 최대 SWAY px, 2.8초 왕복. 판은 머리카락 아래쪽 둘레만 메운 것
    var SWAY = 7;
    var girl = {
      box: [735, 200], plate: "img/hair-girl2-plate.png", layers: ["img/hair-girl2.png"],
      frame: function (t) { this.ph = t * Math.PI * 2 / 2.8; },
      move: function (layer, x, y, d) {
        var k = smooth((y - 32) / 54) * (x > 72 ? 0.55 : 1);
        // 진자처럼 좌우로: 끝으로 갈수록 크게, 조금 늦게(1.1*k) 따라오고, 끝 가닥만 잔물결이 살짝 더해짐. 밖으로 흔들릴 때 끝이 살짝 들림
        var hx = SWAY * k * Math.sin(this.ph - 1.1 * k) + 0.18 * SWAY * k * k * Math.sin(this.ph * 2.6 + x * 0.09);
        d[0] = hx;
        d[1] = -0.12 * Math.abs(hx);
      }
    };
    var FIGS = [girl];
    var items = [], visible = true, running = false, last = 0;

    FIGS.forEach(function (f) {
      var srcs = [f.plate].concat(f.layers), pics = [], n = 0;
      srcs.forEach(function (src, i) {
        var im = new Image();
        im.onload = function () { if (++n === srcs.length) { items.push(prepare(f, pics)); place(); } };
        im.src = src;
        pics[i] = im;
      });
    });

    function pixels(image, w, ht) {
      var c = document.createElement("canvas");
      c.width = w;
      c.height = ht;
      var g = c.getContext("2d");
      g.drawImage(image, 0, 0);
      return g.getImageData(0, 0, w, ht).data;
    }

    function prepare(f, pics) {
      var w = pics[0].naturalWidth, ht = pics[0].naturalHeight;
      var cv = document.createElement("canvas");
      cv.width = w;
      cv.height = ht;
      cv.className = "fig-move";
      cv.setAttribute("aria-hidden", "true");
      scene.appendChild(cv);
      var ctx = cv.getContext("2d");
      return { f: f, w: w, ht: ht, plate: pixels(pics[0], w, ht), layers: pics.slice(1).map(function (im) { return pixels(im, w, ht); }), cv: cv, ctx: ctx, out: ctx.createImageData(w, ht) };
    }

    // 판 위에 조각들을 차례로 덮어 그림. 조각은 (dx, dy)만큼 밀린 자리에서 이웃 네 점을 섞어 가져와 부드럽게
    var d = [0, 0];
    function draw(it, time) {
      var f = it.f, w = it.w, ht = it.ht, pl = it.plate, od = it.out.data;
      f.frame(time / 1000);
      for (var y = 0; y < ht; y++) {
        for (var x = 0; x < w; x++) {
          var o = (y * w + x) * 4;
          var R = pl[o], G = pl[o + 1], B = pl[o + 2], A = pl[o + 3];
          for (var l = 0; l < it.layers.length; l++) {
            var src = it.layers[l];
            f.move(l, x, y, d);
            var sx = x - d[0], sy = y - d[1];
            var x0 = Math.floor(sx), y0 = Math.floor(sy), fx = sx - x0, fy = sy - y0;
            var r = 0, g = 0, b = 0, a = 0;
            for (var n = 0; n < 4; n++) {
              var xx = x0 + (n & 1), yy = y0 + (n >> 1);
              if (xx < 0 || yy < 0 || xx >= w || yy >= ht) continue;
              var wt = ((n & 1) ? fx : 1 - fx) * ((n >> 1) ? fy : 1 - fy), j = (yy * w + xx) * 4, al = src[j + 3] * wt;
              r += src[j] * al; g += src[j + 1] * al; b += src[j + 2] * al; a += al;
            }
            if (a < 0.5) continue;
            var k = a / 255, outA = a + A * (1 - k);
            R = (r + R * A * (1 - k)) / outA;
            G = (g + G * A * (1 - k)) / outA;
            B = (b + B * A * (1 - k)) / outA;
            A = outA;
          }
          od[o] = R; od[o + 1] = G; od[o + 2] = B; od[o + 3] = A;
        }
      }
      it.ctx.putImageData(it.out, 0, 0);
    }

    function place() {
      var m = sceneMap(scene, img);
      if (!m) return;
      items.forEach(function (it) {
        var p = m.at(it.f.box[0], it.f.box[1]);
        it.cv.style.left = p[0] + "px";
        it.cv.style.top = p[1] + "px";
        it.cv.style.width = it.w * m.s + "px";
        it.cv.style.height = it.ht * m.s + "px";
      });
      start();
    }

    function frame(now) {
      if (!visible || document.hidden || reduceMotion.matches) { running = false; if (sync) sync(); return; }
      if (now - last > 33) { last = now; items.forEach(function (it) { draw(it, now); }); }
      requestAnimationFrame(frame);
    }
    function start() {
      if (running || !visible || document.hidden || !items.length) return;
      running = true;
      requestAnimationFrame(frame);
    }
    new ResizeObserver(place).observe(scene);
    new IntersectionObserver(function (e) { visible = e[e.length - 1].isIntersecting; start(); }).observe(scene);
    document.addEventListener("visibilitychange", start);
    var sync = followReducedMotion(function () { return items.map(function (it) { return it.cv; }); }, start);
  }

  // 배너 그림 속 홍제천 인공폭포: 떨어지는 물줄기가 실제로 흘러내리고, 웅덩이 물빛이 은은하게 반짝임
  // 물 영역 마스크(img/waterfall-mask.png: R = 떨어지는 물, G = 웅덩이, 원본 그림 좌표 BOX에서 잘라낸 것)에서만 다시 그림
  //  - 떨어지는 물: 그림 속 물줄기를 조금 위에서 끌어와 아래로 흘림. 끌어오는 거리(0~FLOW_L)를 반 주기 엇갈린 두 흐름으로
  //    번갈아 섞어(flow map) 되감기는 순간이 보이지 않게 하고, 밝은 물줄기 결을 더 빠르게 흘려 물살 느낌을 더함
  //  - 웅덩이: 옆으로 흐르는 잔물결 빛 + 폭포 바로 아래 물안개
  // 그림과 같은 색 보정(--scene-filter)을 걸어 겹친 부분이 티 나지 않게 함
  // 움직임 줄이기 설정이면 안 움직이고, 배너가 화면 밖이거나 탭이 숨으면 멈춤
  // 한계: 물 픽셀마다 CPU로 계산(약 1.5만 개, 초당 30번). 더 크게 쓰면 WebGL로 옮길 것
  function setupWaterfall() {
    var scene = document.querySelector(".hero-scene");
    var img = scene && scene.querySelector("img");
    if (!img || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var BOX = [1150, 236], FLOW = 38, FLOW_L = 18, SPEED = 70, TH = 96; // 흐름 속도·끌어오는 거리, 물줄기 결 속도·무늬 길이(원본 px)
    var mask = new Image();
    var it = null, visible = true, running = false, last = 0;
    mask.onload = function () {
      if (img.complete) build(); else img.addEventListener("load", build, { once: true });
    };
    mask.src = "img/waterfall-mask.png";

    function read(image, sx, sy, w, h) {
      var c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      var g = c.getContext("2d");
      g.drawImage(image, sx, sy, w, h, 0, 0, w, h);
      return g.getImageData(0, 0, w, h).data;
    }

    function build() {
      var w = mask.naturalWidth, h = mask.naturalHeight;
      var m = read(mask, 0, 0, w, h);
      // 원본 그림의 물 부분 (배너 img는 원본 1344×756 크기로 읽음)
      var c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      c.getContext("2d").drawImage(img, 0, 0);
      var src = c.getContext("2d").getImageData(BOX[0], BOX[1], w, h).data;
      var idx = [];
      for (var i = 0; i < w * h; i++) if (m[i * 4] > 8 || m[i * 4 + 1] > 8) idx.push(i);
      // 밝은 물줄기 결: 칸마다 밝기·간격·위치가 조금씩 다른 세로 줄 (옆 칸과 섞어 부드럽게)
      var seed = 7, rnd = function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      var col = [];
      for (var x = 0; x < w; x++) col.push({ k: 1 + Math.floor(rnd() * 3), ph: rnd() * Math.PI * 2, a: 0.35 + rnd() * 0.65 });
      var tile = new Float32Array(w * TH);
      for (var y = 0; y < TH; y++) {
        for (x = 0; x < w; x++) {
          var v = 0;
          for (var d = -1; d <= 1; d++) {
            var q = col[Math.min(w - 1, Math.max(0, x + d))];
            v += (d ? 0.25 : 0.5) * q.a * Math.pow(0.5 + 0.5 * Math.sin((y / TH) * Math.PI * 2 * q.k + q.ph), 4);
          }
          tile[y * w + x] = v;
        }
      }
      var cv = document.createElement("canvas");
      cv.width = w;
      cv.height = h;
      cv.className = "water-fx";
      cv.setAttribute("aria-hidden", "true");
      scene.appendChild(cv);
      var ctx = cv.getContext("2d");
      it = { w: w, h: h, m: m, src: src, idx: idx, tile: tile, cv: cv, ctx: ctx, out: ctx.createImageData(w, h) };
      place();
    }

    // (x, y)에서 off만큼 위에 있는 물 색 (위가 물이 아니면 제자리 색), 세로로만 부드럽게 섞음
    function pull(x, y, off, ch) {
      var sy = y - off, y0 = Math.floor(sy), f = sy - y0, w = it.w, m = it.m, src = it.src;
      if (y0 < 0 || m[(y0 * w + x) * 4] < 80) return src[(y * w + x) * 4 + ch];
      var a = src[(y0 * w + x) * 4 + ch], b = src[(Math.min(y0 + 1, it.h - 1) * w + x) * 4 + ch];
      return a + (b - a) * f;
    }

    function draw(time) {
      var t = time / 1000, w = it.w, m = it.m, src = it.src, od = it.out.data, tile = it.tile, idx = it.idx;
      var ph1 = (t * FLOW / FLOW_L) % 1, ph2 = (ph1 + 0.5) % 1;
      var o1 = ph1 * FLOW_L, o2 = ph2 * FLOW_L, w1 = 1 - Math.abs(2 * ph1 - 1), w2 = 1 - w1;
      var shift = Math.floor(t * SPEED);
      for (var n = 0; n < idx.length; n++) {
        var i = idx[n], x = i % w, y = (i - x) / w, o = i * 4;
        var fall = m[o] / 255, pool = m[o + 1] / 255;
        var r, g, b, glow = 0;
        if (fall > pool) {
          r = pull(x, y, o1, 0) * w1 + pull(x, y, o2, 0) * w2;
          g = pull(x, y, o1, 1) * w1 + pull(x, y, o2, 1) * w2;
          b = pull(x, y, o1, 2) * w1 + pull(x, y, o2, 2) * w2;
          glow = 0.35 * tile[(((y - shift) % TH) + TH) % TH * w + x];
        } else {
          r = src[o]; g = src[o + 1]; b = src[o + 2];
          var ripple = 0.5 + 0.5 * Math.sin(x * 0.22 - t * 1.8 + 1.7 * Math.sin(y * 0.5 + t * 0.6));
          glow = 0.42 * Math.pow(ripple, 10) * (0.6 + 0.4 * Math.sin(x * 0.07 + y * 0.31 + t)) // 줄무늬가 너무 고르지 않게
            + Math.exp(-Math.max(0, y - 176) / 14) * (0.16 + 0.1 * Math.sin(t * 1.7 + x * 0.08));
        }
        od[o] = r + (255 - r) * glow;
        od[o + 1] = g + (255 - g) * glow;
        od[o + 2] = b + (255 - b) * glow;
        od[o + 3] = Math.max(fall, pool) * 255;
      }
      it.ctx.putImageData(it.out, 0, 0);
    }

    function place() {
      var mp = sceneMap(scene, img);
      if (!mp || !it) return;
      var p = mp.at(BOX[0], BOX[1]);
      it.cv.style.left = p[0] + "px";
      it.cv.style.top = p[1] + "px";
      it.cv.style.width = it.w * mp.s + "px";
      it.cv.style.height = it.h * mp.s + "px";
      start();
    }
    function frame(now) {
      if (!visible || document.hidden || reduceMotion.matches) { running = false; if (sync) sync(); return; }
      if (now - last > 33) { last = now; draw(now); }
      requestAnimationFrame(frame);
    }
    function start() {
      if (running || !visible || document.hidden || !it) return;
      running = true;
      requestAnimationFrame(frame);
    }
    new ResizeObserver(place).observe(scene);
    new IntersectionObserver(function (e) { visible = e[e.length - 1].isIntersecting; start(); }).observe(scene);
    document.addEventListener("visibilitychange", start);
    var sync = followReducedMotion(function () { return it ? [it.cv] : []; }, start);
  }

  // 독립문·첫 번째 학생 위 먼 하늘에서 작은 새들이 계속 천천히 맴돌며 날아다님
  // 그림 좌표(원본 1344×756)로 맴도는 범위(가운데 C, 가로·세로 반지름 R)를 정하고 sceneMap으로 화면 좌표로 바꿈
  // 새마다 빠르기·위상이 다른 느린 곡선(가로는 크게, 세로는 작게 출렁)을 따라 날아 서로 겹치지 않고 자연스럽게 흩어짐
  // 새는 작은 "ㅅ" 모양(색연필 톤의 흐린 회갈색), 날갯짓은 CSS. 배너가 좁으면(휴대폰) 2마리
  // 휴대폰처럼 그림 위쪽 하늘이 잘려 보이면 보이는 윗선 아래로 범위를 내림
  // 움직임 줄이기 설정이면 나오지 않고, 배너가 화면 밖이거나 탭이 숨으면 멈춤
  function setupBirds() {
    var scene = document.querySelector(".hero-scene");
    var img = scene && scene.querySelector("img");
    if (!img || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var C = [655, 96], R = [105, 22];
    // 새마다: 한 바퀴 시간(초), 위상, 날갯짓 빠르기
    var KINDS = [[26, 0, 0.46], [31, 2.1, 0.52], [23, 4.0, 0.49]];
    var birds = [], map = null, low = 0, visible = true, running = false;

    function place() {
      map = sceneMap(scene, img);
      if (!map) return;
      low = Math.max(0, -map.at(0, 0)[1] / map.s + 40 - (C[1] - R[1]));
      var n = scene.clientWidth < 700 ? 2 : 3, size = Math.min(11, Math.max(7, 12 * map.s));
      while (birds.length > n) birds.pop().el.remove();
      while (birds.length < n) {
        var k = KINDS[birds.length], el = document.createElement("span");
        el.className = "bird";
        el.setAttribute("aria-hidden", "true");
        scene.appendChild(el);
        birds.push({ el: el, k: k });
      }
      birds.forEach(function (b, i) {
        b.el.innerHTML = '<svg viewBox="0 0 12 6" width="' + size + '" height="' + size / 2 + '"><path d="M0 4.2Q3 0.6 6 4Q9 0.6 12 4.2"/></svg>';
        // 날갯짓 빠르기·엇갈림은 style 속성 대신 스크립트로 (콘텐츠 보안 정책이 HTML의 style 속성을 막음)
        var wing = b.el.querySelector("path");
        wing.style.animationDuration = b.k[2] + "s";
        wing.style.animationDelay = -i * 0.17 + "s";
      });
      start();
    }

    function frame(now) {
      if (!visible || document.hidden || !map || reduceMotion.matches) { running = false; if (sync) sync(); return; }
      var t = now / 1000;
      birds.forEach(function (b) {
        var w = (Math.PI * 2) / b.k[0], ph = b.k[1];
        // 가로로 크게 오가며, 세로로는 두 배 빠르게 작게 출렁(8자에 가까운 느린 곡선) + 아주 느린 흔들림
        var x = C[0] + R[0] * Math.sin(w * t + ph) + 12 * Math.sin(w * 2.7 * t + ph * 1.3);
        var y = C[1] + low + R[1] * Math.sin(w * 2 * t + ph) * 0.8 + 6 * Math.sin(w * 0.6 * t + ph);
        var p = map.at(x, y);
        b.el.style.transform = "translate(" + p[0] + "px," + p[1] + "px)";
        b.el.style.opacity = 1;
      });
      requestAnimationFrame(frame);
    }
    function start() {
      if (running || !visible || document.hidden || !map) return;
      running = true;
      requestAnimationFrame(frame);
    }
    new ResizeObserver(place).observe(scene);
    new IntersectionObserver(function (e) { visible = e[e.length - 1].isIntersecting; start(); }).observe(scene);
    document.addEventListener("visibilitychange", start);
    var sync = followReducedMotion(function () { return birds.map(function (b) { return b.el; }); }, start);
    if (img.complete) place(); else img.addEventListener("load", place, { once: true });
  }

  // 배너 그림 속 짧은 분리배출 장면 (페이지를 열 때 한 번, 약 6초)
  // 그림이 색연필 질감이라 물건 그림 대신 빛으로만 표현: 여학생 손 → 노란 통, 남학생 손 → 초록 통으로 반짝이는 별이 날아 들어가고
  // 통 입구가 은은하게 빛나며 반짝임과 빛나는 ♻가 떠올랐다 사라짐
  // 그림은 object-fit:cover라 그림 좌표(원본 1344×756)를 화면 좌표로 바꿔 놓음. 움직임 줄이기 설정이면 재생 안 함
  function setupHeroScene() {
    var scene = document.querySelector(".hero-scene");
    var img = scene && scene.querySelector("img");
    if (!img || !scene.animate || matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    function play() {
      var m = sceneMap(scene, img);
      if (!m) return;
      var s = m.s, at = m.at;
      var layer = document.createElement("div");
      layer.className = "scene-fx";
      scene.appendChild(layer);

      // 손에서 통 입구까지 반짝이는 별(빛 구슬)이 포물선을 따라 날아 들어가고, 지나간 자리에 작은 반짝임이 잠깐 남음
      function orb(from, to, lift, delay, dur) {
        var c = [(from[0] + to[0]) / 2, Math.min(from[1], to[1]) - lift * s];
        var pt = function (t) {
          var u = 1 - t;
          return [u * u * from[0] + 2 * u * t * c[0] + t * t * to[0], u * u * from[1] + 2 * u * t * c[1] + t * t * to[1]];
        };
        var size = Math.max(16, 30 * s);
        var el = document.createElement("span");
        el.className = "scene-orb";
        el.style.width = el.style.height = size + "px";
        layer.appendChild(el);
        var frames = [];
        for (var k = 0; k <= 20; k++) {
          var t = k / 20, p = pt(t);
          frames.push({
            transform: "translate(" + p[0] + "px," + p[1] + "px) translate(-50%,-50%) rotate(" + t * 180 + "deg) scale(" + (t < .1 ? t * 10 : t > .9 ? 1 - (t - .9) * 6 : 1) + ")",
            opacity: t < .08 ? t / .08 : t > .92 ? (1 - t) / .08 : 1
          });
        }
        var a = el.animate(frames, { duration: dur, delay: delay, easing: "cubic-bezier(.45,0,.55,1)", fill: "both" });
        // 지나간 자리의 작은 반짝임(꼬리)
        [.25, .45, .65, .82].forEach(function (t) {
          var p = pt(t), d = document.createElement("span");
          d.className = "scene-spark";
          d.style.left = p[0] + "px";
          d.style.top = p[1] + "px";
          d.style.width = d.style.height = Math.max(8, 13 * s) + "px";
          layer.appendChild(d);
          d.animate([
            { transform: "translate(-50%,-50%) scale(0)", opacity: 0 },
            { transform: "translate(-50%,-50%) scale(1) rotate(45deg)", opacity: .9, offset: .3 },
            { transform: "translate(-50%,-30%) scale(.3) rotate(90deg)", opacity: 0 }
          ], { duration: 900, delay: delay + dur * t, easing: "ease-out", fill: "both" });
        });
        return a;
      }
      // 통 입구가 은은하게 빛나고, 반짝임 몇 개가 퍼지고, 빛나는 ♻가 떠올랐다 사라짐
      function glow(p, delay, dur) {
        var g = document.createElement("span");
        g.className = "scene-glow";
        g.style.left = p[0] + "px";
        g.style.top = p[1] + "px";
        g.style.width = 150 * s + "px";
        g.style.height = 56 * s + "px";
        layer.appendChild(g);
        g.animate([
          { transform: "translate(-50%,-50%) scale(.5)", opacity: 0 },
          { transform: "translate(-50%,-50%) scale(1.05)", opacity: 1, offset: .3 },
          { transform: "translate(-50%,-50%) scale(1)", opacity: .8, offset: .6 },
          { transform: "translate(-50%,-50%) scale(1.1)", opacity: 0 }
        ], { duration: dur, delay: delay, easing: "ease-out", fill: "both" });
        [[-46, -14, 0], [40, -22, 160], [-14, -40, 320], [26, -6, 480], [4, -58, 620]].forEach(function (d) {
          var sp = document.createElement("span");
          sp.className = "scene-spark";
          sp.style.left = p[0] + d[0] * s + "px";
          sp.style.top = p[1] + d[1] * s + "px";
          sp.style.width = sp.style.height = Math.max(10, 18 * s) + "px";
          layer.appendChild(sp);
          sp.animate([
            { transform: "translate(-50%,-50%) scale(0) rotate(0)", opacity: 0 },
            { transform: "translate(-50%,-50%) scale(1) rotate(45deg)", opacity: 1, offset: .4 },
            { transform: "translate(-50%,-120%) scale(.4) rotate(90deg)", opacity: 0 }
          ], { duration: dur * .7, delay: delay + d[2] * 2, easing: "ease-out", fill: "both" });
        });
        var m = document.createElement("span");
        m.className = "scene-mark";
        m.textContent = "♻";
        m.style.left = p[0] + "px";
        m.style.top = p[1] - 34 * s + "px";
        m.style.fontSize = Math.max(18, 40 * s) + "px";
        layer.appendChild(m);
        // ♻는 통 입구에서 위로 길게(약 120px × 그림 배율) 천천히 떠오르며, 끝 무렵에야 흐려짐
        var rise = function (k) { return "translate(-50%,-50%) translateY(" + (-120 * s * k) + "px)"; };
        return m.animate([
          { transform: rise(0) + " scale(.6)", opacity: 0 },
          { transform: rise(.12) + " scale(1)", opacity: 1, offset: .15 },
          { transform: rise(.75) + " scale(1)", opacity: 1, offset: .75 },
          { transform: rise(1) + " scale(1)", opacity: 0 }
        ], { duration: dur * 1.7, delay: delay + 300, easing: "linear", fill: "both" });
      }
      var yellowBin = at(878, 438), greenBin = at(748, 438);
      orb(at(826, 366), yellowBin, 70, 0, 2600);
      glow(yellowBin, 2000, 2600);
      orb(at(722, 420), greenBin, 40, 1400, 2200);
      glow(greenBin, 3200, 2600).onfinish = function () { layer.remove(); };
    }

    var start = function () { setTimeout(play, 1600); };
    if (img.complete) start(); else img.addEventListener("load", start, { once: true });
  }

  startAtTopOnReload();
  setupGame();
  setupGameChars();
  setupVideoCheer();
  setupBigView();
  setupCueRelayout();
  setupSubs();
  setupHeaderFit();
  setupNavMenu();
  setupBandFit();
  setupToTop();
  setupNavSpy();
  setupHeroScene();
  setupBinMarks();
  setupFigures();
  setupWaterfall();
  setupBirds();
  setupDialogHeight(setupDays());
  setupTelLinks();
  setupBlink();
  progress = setupProgress();
  applyLang(detectLang());
})();
