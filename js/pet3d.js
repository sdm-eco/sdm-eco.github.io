// 투명 페트병 3D 분리배출 체험
// 단계 버튼은 3D 없이도 동작하고, Three.js는 이 영역이 화면 근처에 왔을 때만 불러옵니다.
// 배출 순서: 서울시 안내(내용물 비우기 → 라벨 제거 → 압착 → 뚜껑 닫기 → 투명 페트병 전용 수거함)

// 단계별 최종 모습 (cap 1 = 뚜껑 열림, liquid 1 = 음료 가득, label 1 = 라벨 떨어짐, crush 1 = 찌그러짐, bin 1 = 수거함에 넣음)
const STATES = [
  { cap: 0, liquid: 1, label: 0, crush: 0, bin: 0 },
  { cap: 1, liquid: 0, label: 0, crush: 0, bin: 0 },
  { cap: 1, liquid: 0, label: 1, crush: 0, bin: 0 },
  { cap: 1, liquid: 0, label: 1, crush: 1, bin: 0 },
  { cap: 0, liquid: 0, label: 1, crush: 1, bin: 0 },
  { cap: 0, liquid: 0, label: 1, crush: 1, bin: 1 }
];
// 각 단계로 넘어갈 때 차례로 움직이는 값과 걸리는 시간(초)
const MOVES = [null, [["cap", 0.9], ["liquid", 2.2]], [["label", 1.4]], [["crush", 1.2]], [["cap", 0.9]], [["bin", 1.8]]];

// 페트병 옆모습 (반지름, 높이) — 바닥에서 입구까지
const PROFILE = [[0, 0], [0.42, 0], [0.58, 0.04], [0.62, 0.16], [0.62, 0.95], [0.57, 1.08], [0.62, 1.2],
  [0.62, 1.9], [0.56, 2.2], [0.4, 2.5], [0.23, 2.72], [0.2, 2.8], [0.2, 3]];
const NECK = 2.5;       // 이 높이 위(목·입구)는 찌그러지지 않음
const SQUASH = 0.55;    // 찌그러졌을 때 몸통 높이 비율
const GROUND = -1.5;    // 바닥 높이
const TAU = Math.PI * 2;

const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const lab = document.getElementById("pet-lab");
if (lab) init();
document.querySelectorAll("[data-pet-loop]").forEach(initLoop);
setupDialog();

// 단계 버튼으로 직접 조작하는 체험
function init() {
  const stage = lab.querySelector(".pet-stage");
  const canvas = lab.querySelector(".pet-canvas");
  const buttons = Array.from(lab.querySelectorAll("[data-step]"));
  const next = document.getElementById("pet-next");
  const reset = document.getElementById("pet-reset");
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

  mount(stage, canvas, { interactive: true }, function (v) {
    view = v;
    view.goTo(step, true);
  });
}

// 혼자서 5단계를 천천히 반복하는 작은 3D (대문·카드 장식용)
// data-pet-widget 안의 [data-pet-mark="n"] 요소에 지금 단계를 is-on으로 표시
function initLoop(stage) {
  const root = stage.closest("[data-pet-widget]") || stage;
  const marks = Array.from(root.querySelectorAll("[data-pet-mark]"));
  const canvas = stage.querySelector("canvas") || stage.appendChild(document.createElement("canvas"));

  function mark(n) {
    marks.forEach(function (m) { m.classList.toggle("is-on", Number(m.dataset.petMark) === n); });
  }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  mount(stage, canvas, { interactive: false }, async function (view) {
    view.goTo(0, true);
    if (reduced) return;
    await wait(1200);
    for (;;) {
      for (let s = 1; s < STATES.length; s++) {
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

// [data-pet-open] 버튼으로 체험 창(dialog) 열기
function setupDialog() {
  const dialog = document.getElementById("pet-dialog");
  if (!dialog) return;
  document.querySelectorAll("[data-pet-open]").forEach(function (btn) {
    btn.addEventListener("click", function () { dialog.showModal(); });
  });
  dialog.querySelector("[data-pet-close]").addEventListener("click", function () { dialog.close(); });
  dialog.addEventListener("click", function (e) {
    if (e.target === dialog) dialog.close();
  });
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
function mount(stage, canvas, opts, onReady) {
  if (!hasWebGL()) {
    stage.classList.add("is-fallback");
    return;
  }
  const loader = new IntersectionObserver(async function (entries) {
    if (!entries.some(function (e) { return e.isIntersecting; })) return;
    loader.disconnect();
    try {
      const lib = await loadThree();
      const view = createView(lib.THREE, lib.RoomEnvironment, stage, canvas, opts);
      stage.classList.add("is-ready");
      onReady(view);
    } catch (err) {
      console.error(err);
      stage.classList.add("is-fallback");
    }
  }, { rootMargin: "300px" });
  loader.observe(stage);
}

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch (e) {
    return false;
  }
}

function clamp01(x) { return Math.min(1, Math.max(0, x)); }
function smooth(a, b, x) { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); }
function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
function backOut(t) { const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }
function lerp(a, b, t) { return a + (b - a) * t; }

function createView(THREE, RoomEnvironment, stage, canvas, opts) {
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
  camera.lookAt(0, 0.1, 0);

  // root(들어 올리기) → tilt(쏟을 때 기울이기) → spin(드래그 회전) → bottle(병 본체)
  const root = new THREE.Group();
  const tilt = new THREE.Group();
  const spin = new THREE.Group();
  const bottle = new THREE.Group();
  bottle.position.y = GROUND;
  root.add(tilt);
  tilt.add(spin);
  spin.add(bottle);
  scene.add(root);

  // 병 몸통
  const bodyGeo = new THREE.LatheGeometry(densePoints(THREE, PROFILE, 5), 64);
  const bodyOrig = bodyGeo.attributes.position.array.slice();
  // 투명한 병은 안쪽 면 → 바깥 면 순서로 따로 그려야 돌릴 때 얼룩지지 않음
  const bodyMat = {
    color: 0xe8f6ff, roughness: 0.06, metalness: 0, transparent: true,
    clearcoat: 1, clearcoatRoughness: 0.05, depthWrite: false, envMapIntensity: 1.5
  };
  const bodyBack = new THREE.Mesh(bodyGeo, new THREE.MeshPhysicalMaterial(Object.assign({}, bodyMat, { side: THREE.BackSide, opacity: 0.18 })));
  const body = new THREE.Mesh(bodyGeo, new THREE.MeshPhysicalMaterial(Object.assign({}, bodyMat, { side: THREE.FrontSide, opacity: 0.3 })));
  bodyBack.renderOrder = 2;
  body.renderOrder = 3;
  bottle.add(bodyBack, body);

  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.035, 10, 40),
    new THREE.MeshStandardMaterial({ color: 0x2f6fd0, roughness: 0.4 }));
  ring.rotation.x = Math.PI / 2;
  bottle.add(ring);

  // 음료 (윗면 기준으로 줄어들어서, 병을 뒤집으면 입구 쪽으로 빠져나가는 것처럼 보임)
  const LIQUID_TOP = 1.85;
  const liquidGeo = new THREE.LatheGeometry(densePoints(THREE,
    [[0, 0.06], [0.54, 0.06], [0.585, 0.18], [0.585, 0.95], [0.54, 1.08], [0.585, 1.2], [0.585, LIQUID_TOP], [0, LIQUID_TOP]], 2), 48);
  liquidGeo.translate(0, -LIQUID_TOP, 0);
  const liquidMat = new THREE.MeshStandardMaterial({ color: 0xe3a23f, roughness: 0.2, transparent: true, opacity: 0.85 });
  const liquid = new THREE.Mesh(liquidGeo, liquidMat);
  liquid.position.y = LIQUID_TOP;
  liquid.renderOrder = 1;
  bottle.add(liquid);

  // 라벨
  const labelMat = new THREE.MeshStandardMaterial({ map: labelTexture(THREE), roughness: 0.35, transparent: true, side: THREE.DoubleSide });
  const label = new THREE.Mesh(new THREE.CylinderGeometry(0.633, 0.633, 0.62, 64, 1, true), labelMat);
  bottle.add(label);

  // 뚜껑 (병이 기울어도 따라 기울지 않도록 root에 둠)
  const cap = new THREE.Group();
  const capMat = new THREE.MeshStandardMaterial({ color: 0x2f6fd0, roughness: 0.35 });
  cap.add(new THREE.Mesh(new THREE.CylinderGeometry(0.245, 0.245, 0.28, 32), capMat));
  for (let i = 0; i < 16; i++) {
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.24, 0.03), capMat);
    const a = (i / 16) * TAU;
    rib.position.set(Math.cos(a) * 0.25, 0, Math.sin(a) * 0.25);
    cap.add(rib);
  }
  root.add(cap);

  // 바닥 그림자
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6),
    new THREE.MeshBasicMaterial({ map: shadowTexture(THREE), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = GROUND + 0.005;
  scene.add(shadow);

  // 투명 페트병 전용 수거함
  const bin = new THREE.Group();
  const binMat = new THREE.MeshPhysicalMaterial({ color: 0x3b8fd0, roughness: 0.3, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false });
  const binWall = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 0.82, 1.5, 48, 1, true), binMat);
  binWall.position.y = 0.75;
  binWall.renderOrder = 3;
  const binFloor = new THREE.Mesh(new THREE.CircleGeometry(0.82, 48), binMat);
  binFloor.rotation.x = -Math.PI / 2;
  binFloor.position.y = 0.01;
  const binRim = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.05, 10, 64), new THREE.MeshStandardMaterial({ color: 0x1f5f9a, roughness: 0.4 }));
  binRim.rotation.x = Math.PI / 2;
  binRim.position.y = 1.5;
  const sticker = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.55), new THREE.MeshStandardMaterial({ map: stickerTexture(THREE), roughness: 0.5, transparent: true }));
  sticker.position.set(0, 0.8, 0.93);
  sticker.rotation.x = -0.11;
  sticker.renderOrder = 4;
  bin.add(binWall, binFloor, binRim, sticker);
  bin.position.y = GROUND;
  bin.visible = false;
  scene.add(bin);

  // 쏟아지는 음료 방울
  const DROPS = 60;
  const drops = new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 8, 6), liquidMat, DROPS);
  drops.frustumCulled = false;
  const dropData = Array.from({ length: DROPS }, function () {
    return { pos: new THREE.Vector3(), vel: new THREE.Vector3(), life: 0 };
  });
  scene.add(drops);
  const dummy = new THREE.Object3D();
  const mouth = new THREE.Vector3();
  const axis = new THREE.Vector3();
  let nextDrop = 0;
  let emitClock = 0;

  // 애니메이션 상태
  const v = Object.assign({ pour: 0 }, STATES[0]);
  let shown = 0;
  let active = null;
  const queue = [];

  function goTo(n, instant) {
    if (instant || reduced || n < shown) {
      queue.length = 0;
      active = null;
      Object.assign(v, STATES[n], { pour: 0 });
      dropData.forEach(function (d) { d.life = 0; });
      shown = n;
      return;
    }
    for (let s = shown + 1; s <= n; s++) {
      MOVES[s].forEach(function (m) {
        queue.push({ key: m[0], from: STATES[s - 1][m[0]], to: STATES[s][m[0]], dur: m[1], t: 0 });
      });
    }
    shown = Math.max(shown, n);
  }

  function runTweens(dt) {
    if (!active) active = queue.shift() || null;
    if (!active) return;
    active.t += dt;
    const p = clamp01(active.t / active.dur);
    if (active.key === "liquid") {
      v.pour = p;
      v.liquid = lerp(active.from, active.to, smooth(0.32, 0.78, p));
    } else {
      v[active.key] = lerp(active.from, active.to, active.key === "bin" ? p : easeInOut(p));
    }
    if (p >= 1) {
      v[active.key] = active.to;
      if (active.key === "liquid") v.pour = 0;
      active = null;
    }
  }

  let crushed = -1;
  function deform(c) {
    if (c === crushed) return;
    crushed = c;
    const pos = bodyGeo.attributes.position.array;
    for (let i = 0; i < pos.length; i += 3) {
      const x = bodyOrig[i], y = bodyOrig[i + 1], z = bodyOrig[i + 2];
      const a = Math.atan2(z, x);
      const mask = smooth(0.1, 0.4, y) * (1 - smooth(2.1, 2.45, y));
      // 가로 방향 접힘 주름 + 군데군데 눌린 자국 (나선이 아니라서 돌려도 꼬여 보이지 않음)
      const fold = 1 - 0.1 * mask * (0.5 + 0.5 * Math.sin(y * 14));
      const dent = 1 - 0.06 * mask * Math.max(0, Math.sin(a * 3)) * Math.cos(y * 6);
      const r = fold * dent;
      const cy = y <= NECK ? y * SQUASH : NECK * SQUASH + (y - NECK);
      pos[i] = lerp(x, x * r * (1 + 0.15 * mask), c);
      pos[i + 1] = lerp(y, cy, c);
      pos[i + 2] = lerp(z, z * r * (1 - 0.3 * mask), c);
    }
    bodyGeo.attributes.position.needsUpdate = true;
    bodyGeo.computeVertexNormals();
  }

  function topY(c) { return lerp(3, NECK * SQUASH + (3 - NECK), c); }

  function updateDrops(dt) {
    emitClock += dt;
    if (v.pour > 0.32 && v.pour < 0.78) {
      bottle.localToWorld(mouth.set(0, topY(v.crush), 0));
      axis.set(0, 1, 0).applyQuaternion(tilt.quaternion);
      while (emitClock > 0.025) {
        emitClock -= 0.025;
        const d = dropData[nextDrop];
        nextDrop = (nextDrop + 1) % DROPS;
        d.pos.copy(mouth);
        d.vel.copy(axis).multiplyScalar(1.4).add(new THREE.Vector3((Math.random() - 0.5) * 0.5, 0, (Math.random() - 0.5) * 0.5));
        d.life = 1;
      }
    } else {
      emitClock = 0;
    }
    dropData.forEach(function (d, i) {
      if (d.life > 0) {
        d.life -= dt * 1.4;
        d.vel.y -= 9 * dt;
        d.pos.addScaledVector(d.vel, dt);
        if (d.pos.y < GROUND) d.life = 0;
      }
      dummy.position.copy(d.pos);
      dummy.scale.setScalar(d.life > 0 ? 0.6 + d.life * 0.6 : 0);
      dummy.updateMatrix();
      drops.setMatrixAt(i, dummy.matrix);
    });
    drops.instanceMatrix.needsUpdate = true;
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
    spin.rotation.y = 0.5; // 라벨 무늬가 보이는 각도로 고정
  }

  function update(dt) {
    runTweens(dt);
    if (!dragging) {
      velocity *= Math.pow(0.04, dt);
      spin.rotation.y += velocity * dt;
    }

    deform(v.crush);
    const top = topY(v.crush);
    ring.position.y = top - 0.2;

    tilt.rotation.z = Math.sin(Math.PI * v.pour) * 2.3;
    tilt.position.x = Math.sin(Math.PI * v.pour) * -0.5;

    liquid.visible = v.liquid > 0.005;
    liquid.scale.y = Math.max(v.liquid, 0.001);

    const lp = v.label;
    label.visible = lp < 0.99;
    label.position.set(easeInOut(lp) * 1.8, 1.55 + Math.sin(Math.PI * lp) * 0.6 - smooth(0.6, 1, lp) * 1.2, 0);
    label.rotation.set(0, lp * 5, -lp * 0.9);
    labelMat.opacity = 1 - smooth(0.65, 1, lp);

    // 뚜껑: 돌려서 들어 올린 뒤 병 옆 바닥에 내려놓음
    const cp = v.cap;
    const onY = GROUND + top + 0.13;
    const liftY = onY + 0.6;
    if (cp < 0.45) {
      const q = easeInOut(cp / 0.45);
      cap.position.set(0, lerp(onY, liftY, q), 0);
      cap.rotation.set(0, -q * 4 * Math.PI, 0);
    } else {
      const q = easeInOut((cp - 0.45) / 0.55);
      cap.position.set(lerp(0, 1.3, q), lerp(liftY, GROUND + 0.14, q) + Math.sin(Math.PI * q) * 0.5, lerp(0, 0.5, q));
      cap.rotation.set(0, 0, 0);
    }

    // 수거함: 나타난 뒤 병을 들어 올려 떨어뜨림
    const bp = v.bin;
    bin.visible = bp > 0;
    bin.scale.setScalar(Math.max(backOut(clamp01(bp / 0.35)), 0.001));
    const LIFT = 1.7;
    let rootY = 0;
    if (bp > 0.12 && bp < 0.55) rootY = easeInOut(clamp01((bp - 0.12) / 0.38)) * LIFT;
    else if (bp >= 0.55) {
      const q = clamp01((bp - 0.55) / 0.45);
      rootY = lerp(LIFT, 0.1, q * q);
    }
    root.position.y = rootY;

    shadow.position.x = tilt.position.x;
    const s = 1 / (1 + rootY * 0.5);
    shadow.scale.set(s, s, s);
    shadow.material.opacity = bp >= 0.55 && rootY < 0.2 ? 0 : s;

    updateDrops(dt);
  }

  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // 세로로 긴 화면에서도 병과 수거함이 잘리지 않도록 거리를 맞춤
    const fit = 2.65 / Math.tan((camera.fov * Math.PI) / 360);
    camera.position.z = Math.max(fit, fit * 0.95 / camera.aspect);
    camera.lookAt(0, 0.1, 0);
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

// 꼭짓점 사이를 잘게 나눠 찌그러뜨릴 때 주름이 부드럽게 생기게 함
function densePoints(THREE, pts, per) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    for (let k = 0; k < per; k++) {
      const t = k / per;
      out.push(new THREE.Vector2(lerp(pts[i][0], pts[i + 1][0], t), lerp(pts[i][1], pts[i + 1][1], t)));
    }
  }
  const end = pts[pts.length - 1];
  out.push(new THREE.Vector2(end[0], end[1]));
  return out;
}

function canvasTexture(THREE, w, h, draw) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d"), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function labelTexture(THREE) {
  return canvasTexture(THREE, 1024, 256, function (g, w, h) {
    g.fillStyle = "#2f8f5b";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#d4f29a";
    g.beginPath();
    g.moveTo(0, h * 0.62);
    for (let x = 0; x <= w; x += 8) g.lineTo(x, h * 0.62 + Math.sin((x / w) * TAU * 3) * 18);
    g.lineTo(w, h);
    g.lineTo(0, h);
    g.fill();
    g.fillStyle = "#ffffff";
    for (let i = 0; i < 3; i++) {
      const cx = w * (i / 3 + 1 / 6), cy = h * 0.36;
      g.beginPath();
      g.moveTo(cx, cy - 46);
      g.bezierCurveTo(cx + 40, cy, cx + 30, cy + 34, cx, cy + 34);
      g.bezierCurveTo(cx - 30, cy + 34, cx - 40, cy, cx, cy - 46);
      g.fill();
    }
  });
}

function stickerTexture(THREE) {
  return canvasTexture(THREE, 512, 312, function (g, w, h) {
    g.fillStyle = "#ffffff";
    g.beginPath();
    g.roundRect(8, 8, w - 16, h - 16, 40);
    g.fill();
    g.strokeStyle = "#1f5f9a";
    g.lineWidth = 12;
    g.stroke();
    // 페트병 아이콘
    g.fillStyle = "#1f5f9a";
    g.beginPath();
    g.roundRect(70, 120, 90, 150, 22);
    g.moveTo(92, 120);
    g.lineTo(100, 78);
    g.lineTo(130, 78);
    g.lineTo(138, 120);
    g.fill();
    g.fillRect(98, 56, 34, 24);
    g.font = "900 120px system-ui, sans-serif";
    g.textBaseline = "middle";
    g.fillText("PET", 190, h / 2 + 8);
  });
}

function shadowTexture(THREE) {
  return canvasTexture(THREE, 128, 128, function (g, w, h) {
    const grad = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grad.addColorStop(0, "rgba(0,0,0,0.45)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
  });
}
