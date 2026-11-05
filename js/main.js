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

  startAtTopOnReload();
  setupGame();
  setupGameDemo();
  progress = setupProgress();
  applyLang(detectLang());
})();
