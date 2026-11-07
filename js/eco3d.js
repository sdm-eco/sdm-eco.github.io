// 분리배출 3D 체험 (페트병·음식물·일반쓰레기·대형폐기물 장면 공통 장치)
// 단계 버튼은 3D 없이도 동작하고, Three.js는 장면이 화면 근처에 왔을 때만 불러옵니다.
//  [data-eco-lab="이름"]   단계 버튼으로 직접 조작하는 체험
//  [data-eco-loop="이름"]  혼자서 단계를 천천히 반복하는 작은 3D (대문·카드 장식용)
//    data-eco-zoom="1.4"   작은 칸에서 물건이 잘 보이도록 카메라를 당김 (기본 1)
//  [data-eco-open="id"]    눌러서 체험 창(dialog)을 여는 버튼
import pet from "./scene-pet.js?v=20261108h";
import food from "./scene-food.js?v=20261108h";
import general from "./scene-general.js?v=20261108h";
import bulky from "./scene-bulky.js?v=20261108h";
import can from "./scene-can.js?v=20261108h";
import vinyl from "./scene-vinyl.js?v=20261108h";
import carton from "./scene-carton.js?v=20261108h";
import medicine from "./scene-medicine.js?v=20261108h";
import battery from "./scene-battery.js?v=20261108h";
import glass from "./scene-glass.js?v=20261108h";
import paper from "./scene-paper.js?v=20261108h";
import appliance from "./scene-appliance.js?v=20261108h";
import confuse from "./scene-confuse.js?v=20261108h";

import { GROUND } from "./eco3d-util.js?v=20261108h";
import { sfx } from "./eco3d-sound.js?v=20261108h";

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
  const stage = lab.querySelector(".eco-stage");
  const canvas = lab.querySelector(".eco-canvas");
  const buttons = Array.from(lab.querySelectorAll("[data-step]"));
  const next = lab.querySelector("[data-eco-next]");
  const reset = lab.querySelector("[data-eco-reset]");
  const last = buttons.length;
  let step = 0;
  let view = null;

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

  // 자동 진행: 창을 열면 1단계부터 저절로 넘어감. 각 단계의 3D 움직임이 끝난 뒤 DWELL만큼 읽을 시간을 줌.
  // 단계 버튼·다음 단계를 누르면 멈추고 사용자에게 맡김. 마지막 단계에서 멈춤.
  // 3D를 드래그하는 동안에는 읽을 시간을 세지 않고, 손을 떼면 그 단계의 읽을 시간을 처음부터 다시 셈.
  // 움직임 줄이기 설정이면 자동 진행 없이 지금처럼 직접 누르는 방식만 씀.
  const DWELL = 3500;
  const auto = lab.querySelector("[data-eco-auto]");
  const dialog = lab.closest("dialog");
  let run = 0; // 진행 회차. 멈추거나 새로 시작하면 올라가서 이전 회차의 대기를 무효로 만듦
  let held = false; // 3D를 누르고(드래그하고) 있는 동안 true

  function setPlaying(on) {
    run++;
    if (auto) auto.dataset.state = on ? "playing" : "paused";
    if (on) autoLoop(run);
  }

  async function autoLoop(id) {
    if (step >= last) setStep(0);
    // 3D가 뜰 때까지 기다림 (보지도 않은 단계가 넘어가 완료 처리되지 않도록). 3D를 못 쓰는 기기면 글 단계만 시간으로 진행
    while (id === run && !view && !stage.classList.contains("is-fallback")) await wait(100);
    while (id === run && step < last) {
      while (id === run && view && view.busy()) await wait(100);
      const need = step === 0 ? 1200 : DWELL;
      for (let t = 0; id === run && t < need; t = held ? 0 : t + 100) await wait(100);
      if (id !== run) return;
      setStep(step + 1);
    }
    if (id === run && auto) auto.dataset.state = "paused";
  }

  buttons.forEach(function (btn) {
    btn.addEventListener("click", function () { setPlaying(false); setStep(Number(btn.dataset.step)); });
  });
  next.addEventListener("click", function () { setPlaying(false); setStep(Math.min(step + 1, last)); });
  reset.addEventListener("click", function () { held = false; setStep(0); setPlaying(!reduced); });
  // 3D가 뜨기 전에도 캔버스 밖에서 손을 떼는 것을 받도록 누르는 순간 포인터를 붙잡음
  canvas.addEventListener("pointerdown", function (e) {
    held = true;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* 이미 끝난 포인터면 무시 */ }
  });
  ["pointerup", "pointercancel", "lostpointercapture"].forEach(function (type) {
    canvas.addEventListener(type, function () { held = false; });
  });
  if (auto) {
    auto.hidden = reduced;
    auto.addEventListener("click", function () { setPlaying(auto.dataset.state !== "playing"); });
  }
  // 열 때마다(품목을 바꿔 보일 때도) "드래그해서 돌려 보세요" 안내를 다시 보이고 1단계부터 자동 진행
  // (드래그하면 createView가 is-touched로 숨김)
  function start() { held = false; stage.classList.remove("is-touched"); setStep(0); setPlaying(!reduced); }
  function stop() { held = false; setPlaying(false); }
  lab.addEventListener("eco:start", start);
  lab.addEventListener("eco:stop", stop);
  if (dialog) {
    // 한 창에 품목이 여럿이면 지금 보이는 품목만 시작
    dialog.addEventListener("eco:open", function () { if (!lab.hidden) start(); });
    dialog.addEventListener("close", stop);
  }
  setStep(0);

  mount(stage, canvas, def, { interactive: true }, function (v) {
    view = v;
    view.goTo(step, true);
  });
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
// 숨은 품목의 3D는 처음 보일 때 불러옴(mount의 IntersectionObserver). 창을 닫으면 다음에 첫 품목부터 보임
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
        row.scrollLeft = Math.max(0, b.right - (r.right - 64));
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

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch (e) {
    return false;
  }
}

let threeLib = null;
function loadThree() {
  if (!threeLib) {
    threeLib = Promise.all([import("three"), import("three/addons/environments/RoomEnvironment.js"), import("three/addons/geometries/RoundedBoxGeometry.js")])
      .then(function (mods) { return { THREE: mods[0], RoomEnvironment: mods[1].RoomEnvironment, ext: { RoundedBoxGeometry: mods[2].RoundedBoxGeometry } }; });
  }
  return threeLib;
}

// 화면 근처에 오면 Three.js를 불러와 장면을 만듦. 실패하면 is-fallback
function mount(stage, canvas, def, opts, onReady) {
  if (!hasWebGL()) {
    stage.classList.add("is-fallback");
    return;
  }
  const loader = new IntersectionObserver(async function (entries) {
    if (!entries.some(function (e) { return e.isIntersecting; })) return;
    loader.disconnect();
    try {
      const lib = await loadThree();
      const view = createView(lib, stage, canvas, def, opts);
      stage.classList.add("is-ready");
      onReady(view);
    } catch (err) {
      console.error(err);
      stage.classList.add("is-fallback");
    }
  }, { rootMargin: "300px" });
  loader.observe(stage);
}

// 클레이(점토) 스타일 조명: 위아래로 은은한 하늘·바닥 빛 + 따뜻한 주광(부드러운 그림자) + 뒤쪽 테두리 빛
// 바닥에는 그림자만 받는 투명한 판을 깔아 물건이 바닥에 붙어 보이게 함 (def.clay인 장면만)
// 한계: 그림자 지도 1장(1024px)·VSM 흐림이라 아주 작은 물건의 그림자는 흐릿함. 더 선명하게 하려면 mapSize를 늘릴 것
function clayLook(THREE, renderer, scene, sun) {
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  sun.color.set(0xfff3e4);
  sun.intensity = 1.7;
  sun.position.set(-1.8, 8, 4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.radius = 14;
  sun.shadow.blurSamples = 16;
  sun.shadow.bias = -0.0005;
  const cam = sun.shadow.camera;
  cam.left = -4; cam.right = 4; cam.top = 4; cam.bottom = -4; cam.near = 1; cam.far = 16;
  scene.add(new THREE.HemisphereLight(0xffffff, 0xdcefe3, 1.1));
  const rim = new THREE.DirectionalLight(0xdcecff, 0.9);
  rim.position.set(3, 3, -5);
  scene.add(rim);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.ShadowMaterial({ color: 0x2d5a44, opacity: 0.22 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = GROUND;
  floor.receiveShadow = true;
  scene.add(floor);
}

function createView(lib, stage, canvas, def, opts) {
  const THREE = lib.THREE;
  const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new lib.RoomEnvironment(), 0.04).texture;
  const sun = new THREE.DirectionalLight(0xffffff, 1.3);
  sun.position.set(3, 5, 4);
  scene.add(sun);
  if (def.clay) clayLook(THREE, renderer, scene, sun);

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  camera.position.set(0, 0.6, 8.2);

  // 드래그로 돌리는 그룹 — 장면이 원하는 자리에 붙임
  const spin = new THREE.Group();
  // ext: 장면이 쓸 수 있는 three.js 부가 도구 (둥근 상자 등)
  const world = def.build(THREE, scene, spin, lib.ext);
  // 클레이 장면: 불투명한 물건만 부드러운 그림자를 드리움 (물방울·투명한 병·바닥 그림자 판은 제외)
  if (def.clay) {
    scene.traverse(function (o) {
      if (o.isMesh && !o.isInstancedMesh && !o.userData.noShadow && !(o.material && o.material.transparent)) o.castShadow = true;
    });
  }

  // 단계 애니메이션: 값을 0~1 사이에서 직선으로 바꾸고, 부드럽게 보이는 처리는 장면이 맡음
  const states = def.states, moves = def.moves;
  // $sound: 체험 창의 3D만 효과음을 냄(카드 미리보기는 조용히), $k0·$p0: 이번 그림 직전 진행 상태(효과음 순간 판단용)
  const v = Object.assign({ $key: null, $p: 0, $k0: null, $p0: 0, $sound: !!opts.interactive }, states[0]);
  let shown = 0;
  let active = null;
  const queue = [];

  function goTo(n, instant) {
    if (instant || reduced || n < shown) {
      queue.length = 0;
      active = null;
      Object.assign(v, states[n], { $key: null, $p: 0 });
      if (world.reset) world.reset();
      shown = n;
      return;
    }
    for (let s = shown + 1; s <= n; s++) {
      moves[s].forEach(function (m) {
        queue.push({ key: m[0], from: states[s - 1][m[0]], to: states[s][m[0]], dur: m[1], t: 0 });
      });
    }
    shown = Math.max(shown, n);
  }

  function runTweens(dt) {
    if (!active) active = queue.shift() || null;
    if (!active) return;
    active.t += dt;
    const p = Math.min(1, active.t / active.dur);
    v[active.key] = active.from + (active.to - active.from) * p;
    v.$key = active.key;
    v.$p = p;
    if (p >= 1) {
      v.$key = null;
      v.$p = 0;
      active = null;
    }
  }

  // 드래그로 좌우 회전 (세로 스크롤은 막지 않음)
  let dragging = false, lastX = 0, velocity = 0;
  if (opts.interactive) {
    canvas.addEventListener("pointerdown", function (e) {
      dragging = true;
      lastX = e.clientX;
      velocity = 0;
      canvas.setPointerCapture(e.pointerId);
      stage.classList.add("is-touched");
    });
    canvas.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      spin.rotation.y += dx * 0.012;
      velocity = dx * 0.7;
    });
    const endDrag = function () { dragging = false; };
    canvas.addEventListener("pointerup", endDrag);
    canvas.addEventListener("pointercancel", endDrag);
  } else {
    spin.rotation.y = def.spin || 0;
  }

  // 클레이 장면: 카메라가 아주 천천히 좌우로 흔들려(숨 쉬듯) 멈춰 있어도 입체감이 보임
  const camBase = new THREE.Vector3();
  let lookY = 0, idle = 0;
  function update(dt) {
    v.$k0 = v.$key;
    v.$p0 = v.$p;
    runTweens(dt);
    if (!dragging) {
      velocity *= Math.pow(0.04, dt);
      spin.rotation.y += velocity * dt;
    }
    world.update(v, dt);
    if (def.clay && !reduced) {
      idle += dt;
      camera.position.set(camBase.x + Math.sin(idle * 0.45) * 0.4, camBase.y + Math.sin(idle * 0.31) * 0.1, camBase.z);
      camera.lookAt(0, lookY, 0);
    }
  }

  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // 세로로 긴 화면에서도 장면이 잘리지 않도록 거리를 맞춤
    const fit = 2.65 / Math.tan((camera.fov * Math.PI) / 360);
    const cam = def.camera || [0.6, 0.1];
    camera.position.set(0, cam[0], Math.max(fit, fit * 0.95 / camera.aspect) / (opts.zoom || 1));
    camera.lookAt(0, cam[1], 0);
    camBase.copy(camera.position);
    lookY = cam[1];
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  }
  new ResizeObserver(resize).observe(stage);
  resize();

  // 화면에 보일 때만 그림
  let visible = false, running = false, prev = 0;
  function frame(now) {
    if (!visible || document.hidden) { running = false; return; }
    const dt = Math.min((now - prev) / 1000, 0.05);
    prev = now;
    update(dt);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  function start() {
    if (running || !visible || document.hidden) return;
    running = true;
    prev = performance.now();
    requestAnimationFrame(frame);
  }
  new IntersectionObserver(function (entries) {
    visible = entries[entries.length - 1].isIntersecting;
    start();
  }).observe(stage);
  document.addEventListener("visibilitychange", start);

  update(0);
  renderer.render(scene, camera);

  return {
    goTo: goTo,
    busy: function () {
      // 체험 창에서 3D가 화면 밖이면(휴대폰에서 설명을 읽으려 내린 경우 등) 그리기가 멈춰 움직임이 끝나지 않음
      // → 남은 움직임을 건너뛰고 그 단계의 완성 모습으로 바로 맞춤. 카드 장식 3D는 지금처럼 보일 때 이어서 움직임
      if (opts.interactive && (!visible || document.hidden) && (active || queue.length)) goTo(shown, true);
      return !!active || queue.length > 0;
    }
  };
}
