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
      barEl.style.width = (finished / steps.length) * 100 + "%";
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

  setupGame();
  progress = setupProgress();
  applyLang(detectLang());
})();
