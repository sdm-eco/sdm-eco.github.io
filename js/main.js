(function () {
  var LANGS = ["ko", "zh", "en", "vi"];
  var HTML_LANG = { ko: "ko", zh: "zh-CN", en: "en", vi: "vi" };
  var STORAGE_KEY = "sdm-eco-lang";
  var PROGRESS_KEY = "sdm-eco-progress";
  var config = window.SITE_CONFIG || {};
  var current = "ko";
  var progress = null;

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
  }

  // 맨 위로 버튼: 첫 화면 높이만큼 내려가면 보이고, 누르면 맨 위로 (움직임 줄이기 설정이면 바로 이동)
  //   버튼을 누른 뒤에는 키보드 이용자를 위해 맨 위의 '본문 바로가기'(없으면 로고)로 초점을 옮김
  function setupToTop() {
    var btn = document.querySelector(".to-top");
    if (!btn) return;
    var calm = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    var on = false;
    function update() {
      var show = window.scrollY > window.innerHeight * 0.8;
      if (show === on) return;
      on = show;
      btn.classList.toggle("is-on", on);
      btn.tabIndex = on ? 0 : -1;
    }
    window.addEventListener("scroll", update, { passive: true });
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

  // 영상 카드 캐릭터 눈 깜빡임: data-blink="반쯤 감은 그림 감은 그림"
  //   뜬 눈 → 반쯤(50ms) → 감음(70ms) → 반쯤(50ms) → 뜬 눈, 캐릭터마다 4~8초 사이 무작위, 다섯 번 중 한 번은 두 번 연속
  //   그림을 미리 받아 둔 뒤에만 시작(바꿔 끼울 때 깜빡 비는 일 없게), 화면 밖·탭 숨김이면 멈춤, 움직임 줄이기 설정이면 안 함
  function setupBlink() {
    var imgs = document.querySelectorAll("img[data-blink]");
    if (!imgs.length || !("IntersectionObserver" in window)) return;
    if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    imgs.forEach(function (img) {
      var open = img.getAttribute("src");
      var frames = img.dataset.blink.split(" ");
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
        }, 4000 + Math.random() * 4000);
      }
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        if (visible) { preload(); schedule(); } else { clearTimeout(timer); set(open); }
      }, { rootMargin: "200px" }).observe(img);
      document.addEventListener("visibilitychange", schedule);
    });
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
      // 처음 온 사람에게 "0단계 완료"를 보이지 않도록, 한 단계라도 끝내야 진행 막대·문구를 보임
      countEl.hidden = barEl.parentNode.hidden = finished === 0;
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
  //  - 자막: 4개 언어 자막 파일을 붙이고, 사이트 언어에 맞는 자막만 켬. 언어를 바꾸면 재생 중에도 자막이 바뀜
  //  - 거의 끝까지(90%) 보면 학습 띠의 영상 단계에 기록
  function renderVideos() {
    videoList().forEach(function (v) {
      var frame = document.querySelector('[data-video-index="' + v.index + '"]');
      if (!frame) return;
      var title = frame.closest(".video-card").querySelector("h3").textContent;
      var player = frame.querySelector("video");
      if (player) { // 이미 재생을 시작한 칸: 자막 언어와 이름만 맞춤
        player.setAttribute("aria-label", title);
        showCaption(player);
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
          '<span class="play-circle" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5l11 7-11 7z"/></svg></span><span class="video-cover-label"></span>';
        if (poster) cover.querySelector("img").src = poster;
        cover.addEventListener("click", function () { play(frame, v); });
        frame.appendChild(cover);
      }
      cover.querySelector(".video-cover-label").textContent = t("video.play");
      cover.setAttribute("aria-label", t("video.play") + ": " + title);
    });
  }

  function play(frame, v) {
    var player = document.createElement("video");
    player.controls = true;
    player.playsInline = true;
    player.preload = "auto";
    var poster = sameSite(v.cfg.poster);
    if (poster) player.poster = poster;
    player.setAttribute("aria-label", frame.closest(".video-card").querySelector("h3").textContent);
    var source = document.createElement("source");
    source.src = v.src;
    source.type = "video/mp4";
    player.appendChild(source);
    var caps = v.cfg.captions || {};
    LANGS.forEach(function (lang) {
      var src = sameSite(caps[lang]);
      if (!src) return;
      var track = document.createElement("track");
      track.kind = "subtitles";
      track.srclang = lang;
      track.label = CAPTION_LABEL[lang];
      track.src = src;
      track.default = lang === current; // 브라우저가 스스로 다른 언어 자막을 고르지 않게 사이트 언어를 기본으로
      player.appendChild(track);
    });
    // 브라우저가 영상 정보를 읽은 뒤 자막을 다시 고르는 경우가 있어 그때 한 번 더 맞춤
    player.addEventListener("loadedmetadata", function () { showCaption(player); });
    var counted = false;
    player.addEventListener("timeupdate", function () {
      if (!counted && player.duration && player.currentTime / player.duration >= 0.9) {
        counted = true;
        if (progress) progress.watched(v.index);
      }
    });
    frame.innerHTML = "";
    frame.appendChild(player);
    showCaption(player);
    player.play().catch(function () { /* 자동 재생이 막히면 재생 버튼으로 직접 시작 */ });
    player.focus();
  }

  // 사이트 언어의 자막만 보이게 (그 언어 자막이 없으면 모두 끔)
  function showCaption(player) {
    Array.prototype.forEach.call(player.textTracks, function (track) {
      track.mode = track.language === current ? "showing" : "disabled";
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
  function setupGame() {
    var button = document.getElementById("game-play");
    var status = document.getElementById("game-status");
    var stage = document.getElementById("game-stage");
    var game = config.game || {};
    var url = gameUrl(), live = false;
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

    button.addEventListener("click", function () {
      if (!live) {
        status.hidden = false;
        return;
      }
      if (progress) progress.mark("game");
      if (!game.embed) {
        window.open(url, "_blank", "noopener");
        return;
      }
      var iframe = document.createElement("iframe");
      iframe.src = url;
      iframe.title = t("game.title");
      iframe.allow = "fullscreen; autoplay";
      // 게임 화면이 이 페이지를 다른 곳으로 옮기거나 새 창·양식 제출을 못 하게 제한 (게임 실행·저장·마우스 잠금만 허용)
      // 한계: 게임이 이 사이트와 같은 주소(sdm-eco.github.io)에 있으면 allow-same-origin 때문에 제한을 풀 수 있음 → 다른 주소에 둘 때 효과가 큼
      iframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-pointer-lock");
      stage.innerHTML = "";
      stage.classList.add("is-playing");
      stage.appendChild(iframe);
    });
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
  setupToTop();
  setupHeroScene();
  setupBinMarks();
  setupFigures();
  setupWaterfall();
  setupBirds();
  setupDays();
  setupBlink();
  progress = setupProgress();
  applyLang(detectLang());
})();
