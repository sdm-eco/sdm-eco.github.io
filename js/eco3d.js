// 분리배출 체험 (그림 2D 장면 공통 장치 — 파일 이름은 3D 장면 시절 그대로)
// 단계 버튼은 그림 없이도 동작하고, 장면 그림은 화면 근처에 왔을 때만 불러옵니다.
//  [data-eco-lab="이름"]   단계 버튼으로 직접 조작하는 체험
//  [data-eco-loop="이름"]  혼자서 단계를 천천히 반복하는 작은 장면 (카드 장식용)
//    data-eco-zoom="1.2"   작은 칸에서 물건이 잘 보이도록 확대 (기본 1)
//  [data-eco-open="id"]    눌러서 체험 창(dialog)을 여는 버튼
import pet from "./scene-pet2d.js?v=20261114f";
import food from "./scene-food2d.js?v=20261114f";
import general from "./scene-general2d.js?v=20261114f";
import bulky from "./scene-bulky2d.js?v=20261114f";
import can from "./scene-can2d.js?v=20261114f";
import vinyl from "./scene-vinyl2d.js?v=20261114f";
import carton from "./scene-carton2d.js?v=20261114f";
import medicine from "./scene-medicine2d.js?v=20261114f";
import battery from "./scene-battery2d.js?v=20261114f";
import glass from "./scene-glass2d.js?v=20261114f";
import paper from "./scene-paper2d.js?v=20261114f";
import appliance from "./scene-appliance2d.js?v=20261114f";
import confuse from "./scene-confuse2d.js?v=20261114f";
import { create2DView } from "./eco2d.js?v=20261108r";
import { sfx } from "./eco3d-sound.js?v=20261108r";

// 품목별 장면 (scene-*2d.js, eco2d.js 형식)
const SCENES = {
  pet: pet, food: food, general: general, bulky: bulky, can: can, vinyl: vinyl, carton: carton, medicine: medicine, battery: battery,
  glass: glass, paper: paper, appliance: appliance, confuse: confuse
};
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

document.querySelectorAll("[data-eco-lab]").forEach(initLab);
document.querySelectorAll("[data-eco-loop]").forEach(initLoop);
setupItems();
setupDialogs();
setupSound();

function initLab(lab) {
  const def = SCENES[lab.dataset.ecoLab];
  if (!def) return; // 장면 그림 없는 칸(예: 동별 배출요일, main.js setupDays)은 품목 탭 전환만 함께 씀
  const stage = lab.querySelector(".eco-stage");
  const canvas = lab.querySelector(".eco-canvas");
  const buttons = Array.from(lab.querySelectorAll("[data-step]"));
  const next = lab.querySelector("[data-eco-next]");
  const reset = lab.querySelector("[data-eco-reset]");
  const last = buttons.length;
  let step = 0;
  let view = null;
  let cancelMount = null; // 장면 그림을 불러오는 중이면 그 대기를 취소하는 함수

  function setStep(n) {
    step = n;
    buttons.forEach(function (btn) {
      const s = Number(btn.dataset.step);
      btn.setAttribute("aria-pressed", String(s === n));
      btn.classList.toggle("is-done", s < n);
    });
    next.disabled = n >= last;
    if (view) view.goTo(n);
    // 마지막 단계까지 보면 알림 → 학습 띠의 배출방법 단계를 완료로 표시 (main.js)
    if (n === last) document.dispatchEvent(new CustomEvent("eco:lab-done", { detail: lab.dataset.ecoLab }));
  }

  // 자동 진행: 창을 열면 1단계부터 저절로 넘어감. 각 단계의 움직임이 끝난 뒤 그 단계 설명을 읽을 시간만큼 기다림.
  // 단계 버튼·다음 단계를 누르면 멈추고 사용자에게 맡김. 마지막 단계에서 멈춤.
  // 움직임 줄이기 설정이면 자동 진행 없이 지금처럼 직접 누르는 방식만 씀.
  // 읽을 시간 = 1.5초 + 설명 글자 수 × 언어별 글자당 시간, 2~4.5초 사이 (예전엔 모든 단계 3.5초 고정)
  //   같은 내용이라도 영어·베트남어는 글자가 2배쯤 많아 글자당 시간을 절반으로 둠 → 네 언어 평균 약 2.6초
  const PER_CHAR = { ko: 30, zh: 40, en: 15, vi: 15 };
  function dwell(n) {
    const btn = lab.querySelector('[data-step="' + n + '"]');
    const lang = (document.documentElement.lang || "ko").slice(0, 2);
    const len = btn ? btn.textContent.replace(/\s+/g, " ").trim().length : 0;
    return Math.min(4500, Math.max(2000, 1500 + len * (PER_CHAR[lang] || 30)));
  }
  const auto = lab.querySelector("[data-eco-auto]");
  const dialog = lab.closest("dialog");
  let run = 0; // 진행 회차. 멈추거나 새로 시작하면 올라가서 이전 회차의 대기를 무효로 만듦

  function setPlaying(on) {
    run++;
    if (auto) auto.dataset.state = on ? "playing" : "paused";
    if (on) autoLoop(run);
  }

  async function autoLoop(id) {
    if (step >= last) setStep(0);
    // 장면이 뜰 때까지 기다림 (보지도 않은 단계가 넘어가 완료 처리되지 않도록). 그림을 못 띄우면 글 단계만 시간으로 진행
    while (id === run && !view && !stage.classList.contains("is-fallback")) await wait(100);
    while (id === run && step < last) {
      while (id === run && view && view.busy()) await wait(100);
      const need = step === 0 ? 1200 : dwell(step);
      for (let t = 0; id === run && t < need; t += 100) await wait(100);
      if (id !== run) return;
      setStep(step + 1);
    }
    if (id === run && auto) auto.dataset.state = "paused";
  }

  buttons.forEach(function (btn) {
    btn.addEventListener("click", function () { setPlaying(false); setStep(Number(btn.dataset.step)); });
  });
  next.addEventListener("click", function () { setPlaying(false); setStep(Math.min(step + 1, last)); });
  reset.addEventListener("click", function () { setStep(0); setPlaying(!reduced); });
  // 장면 불러오기·반납: 지금 보이는 품목만 그리고, 안 보이게 되면(창을 닫거나 다른 품목) 그리기를 멈춤
  function load() {
    if (view || cancelMount) return;
    cancelMount = mount(stage, canvas, def, { interactive: true }, function (v) {
      cancelMount = null;
      view = v;
      view.goTo(step, true);
    });
  }
  function unload() {
    if (cancelMount) { cancelMount(); cancelMount = null; }
    if (!view) return;
    view.destroy();
    view = null;
    stage.classList.remove("is-ready");
  }
  if (auto) {
    auto.hidden = reduced;
    auto.addEventListener("click", function () { setPlaying(auto.dataset.state !== "playing"); });
  }
  // 열 때마다(품목을 바꿔 보일 때도) 1단계부터 자동 진행
  function start() { load(); setStep(0); setPlaying(!reduced); }
  function stop() { setPlaying(false); unload(); }
  lab.addEventListener("eco:start", start);
  lab.addEventListener("eco:stop", stop);
  if (dialog) {
    // 한 창에 품목이 여럿이면 지금 보이는 품목만 시작
    dialog.addEventListener("eco:open", function () { if (!lab.hidden) start(); });
    dialog.addEventListener("close", stop);
  }
  setStep(0);
  load();
}

function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

// 효과음 켜기·끄기 버튼([data-eco-sound]): 기본 꺼짐, 누르면 모든 체험 창 버튼이 함께 바뀜 (eco3d-sound.js)
function setupSound() {
  const btns = Array.from(document.querySelectorAll("[data-eco-sound]"));
  const sync = function () { btns.forEach(function (b) { b.setAttribute("aria-pressed", String(sfx.isOn())); }); };
  btns.forEach(function (b) {
    b.addEventListener("click", function () { sfx.set(!sfx.isOn()); sync(); });
  });
  sync();
}

// 한 창에 품목이 여럿(예: 페트병·캔·비닐·종이팩): 창 위 품목 버튼([data-eco-item="이름"])으로 체험을 바꿔 보임.
// 숨은 품목의 장면은 처음 보일 때 불러옴(mount의 IntersectionObserver). 창을 닫으면 다음에 첫 품목부터 보임
function setupItems() {
  document.querySelectorAll("dialog.eco-dialog").forEach(function (dialog) {
    const labs = Array.from(dialog.querySelectorAll("[data-eco-lab]"));
    if (labs.length < 2) return;
    const tabs = Array.from(dialog.querySelectorAll("[data-eco-item]"));

    function show(name, focus) {
      labs.forEach(function (lab) {
        const on = lab.dataset.ecoLab === name;
        if (!on && !lab.hidden) lab.dispatchEvent(new Event("eco:stop"));
        lab.hidden = !on;
        if (on) dialog.setAttribute("aria-labelledby", lab.querySelector("h3").id);
      });
      tabs.forEach(function (tab) { tab.setAttribute("aria-pressed", String(tab.dataset.ecoItem === name)); });
      if (focus) {
        const lab = labs.find(function (l) { return !l.hidden; });
        const btn = lab.querySelector('[data-eco-item="' + name + '"]');
        btn.focus({ preventScroll: true });
        // 휴대폰에서 버튼 줄이 옆으로 밀리는 경우: 고른 버튼이 닫기 버튼(오른쪽 64px)에 가리지 않게 줄을 밀어 둠
        const row = btn.parentElement, r = row.getBoundingClientRect(), b = btn.getBoundingClientRect();
        const over = b.right - (r.right - 64), under = r.left + 14 - b.left;
        if (over > 0) row.scrollLeft += over; else if (under > 0) row.scrollLeft -= under;
        lab.dispatchEvent(new Event("eco:start"));
      }
    }

    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        if (tab.getAttribute("aria-pressed") !== "true") show(tab.dataset.ecoItem, true);
      });
    });
    dialog.addEventListener("close", function () { show(labs[0].dataset.ecoLab, false); });
    show(labs[0].dataset.ecoLab, false);
  });
}

// data-eco-widget 안의 [data-eco-mark="n"] 요소에 지금 단계를 is-on으로 표시
function initLoop(stage) {
  // 카드 미리보기도 체험 창과 같은 장면을 씀
  const def = SCENES[stage.dataset.ecoLoop];
  const root = stage.closest("[data-eco-widget]") || stage;
  const marks = Array.from(root.querySelectorAll("[data-eco-mark]"));
  const canvas = stage.querySelector("canvas") || stage.appendChild(document.createElement("canvas"));

  function mark(n) {
    marks.forEach(function (m) { m.classList.toggle("is-on", Number(m.dataset.ecoMark) === n); });
  }

  mount(stage, canvas, def, { interactive: false, zoom: Number(stage.dataset.ecoZoom) || 1 }, async function (view) {
    view.goTo(0, true);
    if (reduced) return;
    await wait(1200);
    for (;;) {
      for (let s = 1; s < def.states.length; s++) {
        mark(s);
        view.goTo(s);
        while (view.busy()) await wait(100);
        await wait(1400);
      }
      await wait(800);
      stage.classList.add("is-fading");
      await wait(450);
      view.goTo(0, true);
      mark(0);
      stage.classList.remove("is-fading");
      await wait(1200);
    }
  });
}

// 체험 창은 한 페이지처럼: 열면 주소에 #food 같은 표시가 붙고, 휴대폰·브라우저의 뒤로 가기로 닫힘.
// #food 주소로 바로 들어오면 그 창이 열린 채로 시작
function setupDialogs() {
  const dialogs = Array.from(document.querySelectorAll("dialog.eco-dialog"));
  const hashOf = function (dialog) { return "#" + dialog.id.replace(/-dialog$/, ""); };
  const ours = function (dialog) { return !!history.state && history.state.ecoDialog === dialog.id; };

  function open(dialog, push) {
    if (dialog.open) return;
    dialog.showModal();
    // 열 때 알림 → initLab이 1단계부터 자동 진행을 시작
    dialog.dispatchEvent(new Event("eco:open"));
    if (push) history.pushState({ ecoDialog: dialog.id }, "", location.pathname + location.search + hashOf(dialog));
  }

  document.querySelectorAll("[data-eco-open]").forEach(function (btn) {
    const dialog = document.getElementById(btn.dataset.ecoOpen);
    btn.addEventListener("click", function () { open(dialog, true); });
  });
  // 배출방법 카드는 카드 어디를 눌러도 그 카드의 체험 창이 열림 (휴대폰 터치 영역을 카드 전체로)
  document.querySelectorAll(".guide-card").forEach(function (card) {
    const btn = card.querySelector("[data-eco-open]");
    if (btn) card.addEventListener("click", function (e) { if (!e.target.closest("button, a")) btn.click(); });
  });
  dialogs.forEach(function (dialog) {
    dialog.querySelector("[data-eco-close]").addEventListener("click", function () { dialog.close(); });
    dialog.addEventListener("click", function (e) {
      if (e.target === dialog) dialog.close();
    });
    // 닫기 버튼·바깥 누름·Esc로 닫으면 열 때 붙인 주소 기록도 되돌림
    dialog.addEventListener("close", function () { if (ours(dialog)) history.back(); });
  });

  // 뒤로 가기: 열린 창을 닫음 / 앞으로 가기: 그 창을 다시 엶
  window.addEventListener("popstate", function () {
    dialogs.forEach(function (dialog) {
      if (dialog.open && !ours(dialog)) dialog.close();
      else if (!dialog.open && ours(dialog)) open(dialog, false);
    });
  });

  const start = dialogs.find(function (dialog) { return hashOf(dialog) === location.hash; });
  if (start) {
    history.replaceState(null, "", location.pathname + location.search);
    open(start, true);
  }
}

// 화면 근처에 오면 장면 그림을 불러와 그림(eco2d.js). 실패하면 is-fallback(글 단계만)
// 돌려주는 함수를 부르면 아직 만들기 전인 대기를 취소함
function mount(stage, canvas, def, opts, onReady) {
  let cancelled = false;
  const loader = new IntersectionObserver(async function (entries) {
    if (!entries.some(function (e) { return e.isIntersecting; })) return;
    loader.disconnect();
    try {
      const view = await create2DView(stage, canvas, def, opts);
      if (cancelled) { view.destroy(); return; }
      stage.classList.add("is-ready");
      onReady(view);
    } catch (err) {
      console.error(err);
      stage.classList.add("is-fallback");
    }
  }, { rootMargin: "300px" });
  loader.observe(stage);
  return function () { cancelled = true; loader.disconnect(); };
}
