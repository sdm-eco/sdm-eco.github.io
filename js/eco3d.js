// 분리배출 3D 체험 (페트병·음식물·일반쓰레기·대형폐기물 장면 공통 장치)
// 단계 버튼은 3D 없이도 동작하고, Three.js는 장면이 화면 근처에 왔을 때만 불러옵니다.
//  [data-eco-lab="이름"]   단계 버튼으로 직접 조작하는 체험
//  [data-eco-loop="이름"]  혼자서 단계를 천천히 반복하는 작은 3D (대문·카드 장식용)
//  [data-eco-open="id"]    눌러서 체험 창(dialog)을 여는 버튼
import pet from "./scene-pet.js";
import food from "./scene-food.js";
import general from "./scene-general.js";
import bulky from "./scene-bulky.js";

const SCENES = { pet: pet, food: food, general: general, bulky: bulky };
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

document.querySelectorAll("[data-eco-lab]").forEach(initLab);
document.querySelectorAll("[data-eco-loop]").forEach(initLoop);
setupDialogs();

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
  }

  buttons.forEach(function (btn) {
    btn.addEventListener("click", function () { setStep(Number(btn.dataset.step)); });
  });
  next.addEventListener("click", function () { setStep(Math.min(step + 1, last)); });
  reset.addEventListener("click", function () { setStep(0); });
  setStep(0);

  mount(stage, canvas, def, { interactive: true }, function (v) {
    view = v;
    view.goTo(step, true);
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
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  mount(stage, canvas, def, { interactive: false }, async function (view) {
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

function setupDialogs() {
  document.querySelectorAll("[data-eco-open]").forEach(function (btn) {
    const dialog = document.getElementById(btn.dataset.ecoOpen);
    btn.addEventListener("click", function () { dialog.showModal(); });
  });
  document.querySelectorAll("dialog.eco-dialog").forEach(function (dialog) {
    dialog.querySelector("[data-eco-close]").addEventListener("click", function () { dialog.close(); });
    dialog.addEventListener("click", function (e) {
      if (e.target === dialog) dialog.close();
    });
  });
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
    threeLib = Promise.all([import("three"), import("three/addons/environments/RoomEnvironment.js")])
      .then(function (mods) { return { THREE: mods[0], RoomEnvironment: mods[1].RoomEnvironment }; });
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
      const view = createView(lib.THREE, lib.RoomEnvironment, stage, canvas, def, opts);
      stage.classList.add("is-ready");
      onReady(view);
    } catch (err) {
      console.error(err);
      stage.classList.add("is-fallback");
    }
  }, { rootMargin: "300px" });
  loader.observe(stage);
}

function createView(THREE, RoomEnvironment, stage, canvas, def, opts) {
  const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  const sun = new THREE.DirectionalLight(0xffffff, 1.3);
  sun.position.set(3, 5, 4);
  scene.add(sun);

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  camera.position.set(0, 0.6, 8.2);

  // 드래그로 돌리는 그룹 — 장면이 원하는 자리에 붙임
  const spin = new THREE.Group();
  const world = def.build(THREE, scene, spin);

  // 단계 애니메이션: 값을 0~1 사이에서 직선으로 바꾸고, 부드럽게 보이는 처리는 장면이 맡음
  const states = def.states, moves = def.moves;
  const v = Object.assign({ $key: null, $p: 0 }, states[0]);
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

  function update(dt) {
    runTweens(dt);
    if (!dragging) {
      velocity *= Math.pow(0.04, dt);
      spin.rotation.y += velocity * dt;
    }
    world.update(v, dt);
  }

  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // 세로로 긴 화면에서도 장면이 잘리지 않도록 거리를 맞춤
    const fit = 2.65 / Math.tan((camera.fov * Math.PI) / 360);
    const cam = def.camera || [0.6, 0.1];
    camera.position.set(0, cam[0], Math.max(fit, fit * 0.95 / camera.aspect));
    camera.lookAt(0, cam[1], 0);
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
    busy: function () { return !!active || queue.length > 0; }
  };
}
