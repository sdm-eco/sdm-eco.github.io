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
    if (progress) progress.render();
  }

  // 학습 띠: 이 브라우저에서 끝낸 단계를 ✓로, 다음에 할 단계를 강조해서 보여줌
  // (기록은 브라우저마다 따로 남고, 다른 기기와 공유되지 않음)
  function setupProgress() {
    var steps = Array.prototype.slice.call(document.querySelectorAll("[data-learn-step]"));
    if (!steps.length) return null;
    var done = {};
    try { done = JSON.parse(localStorage.getItem(PROGRESS_KEY)) || {}; } catch (e) {}
    var ready = {
      video: (config.videos || []).some(function (v) { return v && v.youtubeId; }),
      guide: true,
      game: !!(config.game && config.game.url)
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

    // 영상: 실제 영상이 연결된 뒤, 영상 칸이 화면에 절반 이상 3초 보이면 완료로 봄
    // 한계: 재생했는지는 알 수 없음. 정확히 하려면 YouTube IFrame API의 재생 종료(ENDED)로 바꿀 것
    if (ready.video && "IntersectionObserver" in window) {
      var timer = null;
      new IntersectionObserver(function (entries) {
        var seen = entries[entries.length - 1].isIntersecting;
        clearTimeout(timer);
        if (seen) timer = setTimeout(function () { mark("video"); }, 3000);
      }, { threshold: 0.5 }).observe(document.querySelector(".video-grid"));
    }

    return { render: render, mark: mark };
  }

  function renderVideos() {
    document.querySelectorAll("[data-video-index]").forEach(function (frame) {
      var video = (config.videos || [])[Number(frame.dataset.videoIndex)];
      if (!video || !video.youtubeId) return;
      var src = "https://www.youtube-nocookie.com/embed/" + encodeURIComponent(video.youtubeId) +
        "?rel=0&hl=" + current + "&cc_lang_pref=" + current + "&cc_load_policy=1";
      var iframe = frame.querySelector("iframe");
      if (!iframe) {
        iframe = document.createElement("iframe");
        iframe.allow = "accelerometer; encrypted-media; gyroscope; picture-in-picture";
        iframe.allowFullscreen = true;
        iframe.loading = "lazy";
        frame.innerHTML = "";
        frame.appendChild(iframe);
      }
      iframe.title = frame.closest(".video-card").querySelector("h3").textContent;
      if (iframe.src !== src) iframe.src = src;
    });
  }

  function setupGame() {
    var button = document.getElementById("game-play");
    var status = document.getElementById("game-status");
    var stage = document.getElementById("game-stage");
    var game = config.game || {};

    button.addEventListener("click", function () {
      if (!game.url) {
        status.hidden = false;
        return;
      }
      if (progress) progress.mark("game");
      if (!game.embed) {
        window.open(game.url, "_blank", "noopener");
        return;
      }
      var iframe = document.createElement("iframe");
      iframe.src = game.url;
      iframe.title = t("game.title");
      iframe.allow = "fullscreen; autoplay";
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

  // 게임 예고 장면: 물건이 하나씩 날아와 알맞은 통에 들어가고, 통이 기뻐하며 점수가 오름
  // (보는 사람이 조작하지 않는 시범. 화면에 보일 때만 돌고, 움직임 줄이기 설정이면 멈춘 장면만 보임)
  // 물건과 통의 짝은 사이트 3D 체험과 같은 기준: 페트병=재활용, 휴지=일반, 사과 심=음식물, 의자=대형
  function setupGameDemo() {
    var demo = document.querySelector("[data-game-demo]");
    if (!demo || matchMedia("(prefers-reduced-motion: reduce)").matches || !demo.animate) return;
    var scoreEl = demo.querySelector("[data-demo-score]");
    var items = [
      { bin: "recycle", svg: '<svg viewBox="0 0 34 34"><path d="M14 3h6v4l2 3v19a2 2 0 0 1-2 2h-6a2 2 0 0 1-2-2V10l2-3z" fill="#dff1fb" stroke="#5a9bd6" stroke-width="1.6"/><rect x="13.5" y="1.5" width="7" height="3.5" rx="1" fill="#2f7fd6"/><path d="M12 16h10v6H12z" fill="#2f8f5b" opacity=".75"/></svg>' },
      { bin: "general", svg: '<svg viewBox="0 0 34 34"><path d="M8 20c-3-1-4-5-1-7 0-4 4-6 7-4 2-3 7-3 8 1 4 0 6 4 4 7 2 3 0 7-4 7-2 3-7 3-9 0-3 1-6-1-5-4z" fill="#fbfaf6" stroke="#9aa59e" stroke-width="1.5"/><path d="M13 15c2 1 4 0 5 2m-3 4c2-1 4 0 5 1" fill="none" stroke="#c5ccc7" stroke-width="1.3" stroke-linecap="round"/></svg>' },
      { bin: "food", svg: '<svg viewBox="0 0 34 34"><path d="M12 7c2 2 8 2 10 0 2 3 1 6-1 8 2 3 3 8 1 11-2 2-8 2-10 0-2-3-1-8 1-11-2-2-3-5-1-8z" fill="#f7e3b0" stroke="#d64545" stroke-width="2"/><path d="M17 7V3m0 0c2-1 4 0 5 1" fill="none" stroke="#7a5236" stroke-width="1.6" stroke-linecap="round"/><circle cx="15.5" cy="18" r="1" fill="#5c3d28"/><circle cx="18.5" cy="20" r="1" fill="#5c3d28"/></svg>' },
      { bin: "bulky", svg: '<svg viewBox="0 0 34 34"><path d="M8 4h18v14H8z" fill="#6b9e8c"/><path d="M5 17h24v6H5z" fill="#4f8573"/><path d="M7 23v8m20-8v8M5 17v-5h3m21 5v-5h-3" fill="none" stroke="#3d6658" stroke-width="2.2" stroke-linecap="round"/></svg>' }
    ];
    var bins = {};
    demo.querySelectorAll("[data-bin]").forEach(function (b) { bins[b.dataset.bin] = b; });
    var score = 0, order = [], visible = false, timer = null;

    function shuffle() {
      order = items.slice();
      for (var i = order.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1)), t = order[i]; order[i] = order[j]; order[j] = t;
      }
    }

    function drop() {
      if (!visible) { timer = null; return; }
      if (!order.length) shuffle();
      var item = order.pop(), bin = bins[item.bin];
      var box = demo.getBoundingClientRect(), b = bin.getBoundingClientRect();
      var endX = b.left - box.left + b.width / 2 - 17, endY = b.top - box.top - 14;
      var startX = 20 + Math.random() * (box.width - 74), startY = 26;
      var el = document.createElement("span");
      el.className = "demo-item";
      el.innerHTML = item.svg;
      demo.appendChild(el);
      var spin = (Math.random() < 0.5 ? -1 : 1) * 200;
      el.animate([
        { transform: "translate(" + startX + "px," + startY + "px) scale(.6) rotate(0deg)", opacity: 0 },
        { transform: "translate(" + startX + "px," + (startY - 6) + "px) scale(1) rotate(" + spin * 0.15 + "deg)", opacity: 1, offset: 0.18 },
        { transform: "translate(" + (startX + endX) / 2 + "px," + (startY - 16) + "px) scale(1) rotate(" + spin * 0.5 + "deg)", offset: 0.5 },
        { transform: "translate(" + endX + "px," + endY + "px) scale(.85) rotate(" + spin + "deg)", opacity: 1, offset: 0.88 },
        { transform: "translate(" + endX + "px," + (endY + 16) + "px) scale(.4) rotate(" + spin + "deg)", opacity: 0 }
      ], { duration: 1300, easing: "cubic-bezier(.45,0,.55,1)" }).onfinish = function () {
        el.remove();
        bin.classList.remove("is-happy");
        void bin.offsetWidth; // 같은 통이 연달아 받아도 다시 뛰도록
        bin.classList.add("is-happy");
        setTimeout(function () { bin.classList.remove("is-happy"); }, 600);
        score = score >= 990 ? 10 : score + 10;
        scoreEl.textContent = score;
        var pop = document.createElement("span");
        pop.className = "demo-pop";
        pop.textContent = "+10";
        pop.style.left = b.left - box.left + b.width / 2 - 14 + "px";
        pop.style.top = b.top - box.top - 26 + "px";
        demo.appendChild(pop);
        pop.animate([{ transform: "translateY(0)", opacity: 1 }, { transform: "translateY(-22px)", opacity: 0 }], { duration: 900, easing: "ease-out" }).onfinish = function () { pop.remove(); };
      };
      timer = setTimeout(drop, 1900);
    }

    new IntersectionObserver(function (entries) {
      visible = entries[entries.length - 1].isIntersecting;
      if (visible && !timer) timer = setTimeout(drop, 400);
    }).observe(demo);
  }

  // 배너 그림 속 짧은 분리배출 장면 (페이지를 열 때 한 번, 약 6초)
  // 그림이 색연필 질감이라 물건 그림 대신 빛으로만 표현: 여학생 손 → 노란 통, 남학생 손 → 초록 통으로 반짝이는 별이 날아 들어가고
  // 통 입구가 은은하게 빛나며 반짝임과 빛나는 ♻가 떠올랐다 사라짐
  // 그림은 object-fit:cover라 그림 좌표(원본 1344×756)를 화면 좌표로 바꿔 놓음. 움직임 줄이기 설정이면 재생 안 함
  // 배너 그림(object-fit:cover, 원본 1344×756)의 좌표를 지금 화면 좌표로 바꾸는 함수. s = 그림 배율
  function sceneMap(scene, img) {
    var IW = 1344, IH = 756;
    var w = scene.clientWidth, h = scene.clientHeight;
    if (!w || !h) return null;
    var pos = getComputedStyle(img).objectPosition.split(" ").map(function (v) { return parseFloat(v) / 100; });
    var s = Math.max(w / IW, h / IH);
    return { s: s, at: function (x, y) { return [(w - IW * s) * pos[0] + x * s, (h - IH * s) * pos[1] + y * s]; } };
  }

  // 그림 속 수거함에 그려진 ♻ 두 개가 은은하게 밝아졌다 흐려졌다를 계속 반복 (CSS 애니메이션, 두 통이 번갈아)
  // 같은 그림을 ♻ 자리에만 겹쳐 놓고 CSS 필터로 흰 화살표만 남겨(나머지는 검정 → screen 합성으로 안 보임) 빛나게 함
  // → 그려진 ♻와 모양이 정확히 같음. 화면 크기가 바뀌면 자리를 다시 맞춤. 움직임 줄이기 설정이면 보이지 않음
  function setupBinMarks() {
    var scene = document.querySelector(".hero-scene");
    var img = scene && scene.querySelector("img");
    if (!img || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var BOX = 48; // ♻ 둘레를 덮는 칸 크기(그림 원본 기준 px)
    var marks = [[761, 484], [888, 484]].map(function (p, i) {
      var el = document.createElement("span");
      el.className = "bin-mark";
      el.setAttribute("aria-hidden", "true");
      el.innerHTML = "<i></i><i></i>"; // 또렷한 화살표 + 번진 빛무리
      el.style.setProperty("--bg", "url(" + img.currentSrc + ")");
      el.style.animationDelay = i * 1.6 + "s";
      if (i === 0) el.classList.add("is-green"); // 초록 통은 ♻가 더 어두워 기준이 다름
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
  setupGameDemo();
  setupHeroScene();
  setupBinMarks();
  progress = setupProgress();
  applyLang(detectLang());
})();
