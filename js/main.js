(function () {
  var LANGS = ["ko", "zh", "en", "vi"];
  var HTML_LANG = { ko: "ko", zh: "zh-CN", en: "en", vi: "vi" };
  var STORAGE_KEY = "sdm-eco-lang";
  var config = window.SITE_CONFIG || {};
  var current = "ko";

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
  applyLang(detectLang());
})();
