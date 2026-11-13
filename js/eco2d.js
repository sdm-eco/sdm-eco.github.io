// 그림(2D)으로 보여 주는 체험 장면 장치
// 3D 장면(eco3d.js createView)과 같은 약속을 지켜 체험 창의 단계 버튼·자동 진행·효과음이 그대로 동작함
//  - def.kind === "2d", def.states / def.moves: 3D 장면과 같은 형식(단계별 값, 단계로 넘어갈 때 움직이는 값과 시간)
//  - def.images: { 이름: 주소 } — 장면을 만들기 전에 모두 불러옴
//  - def.draw(ctx, v, s): 그리는 일은 장면 파일이 맡음. s = { img, dt, t, mem }, 좌표는 아래 설계 크기(W×H) 기준
//  - 돌려주는 view: goTo(n, instant), busy(), destroy() — eco3d.js의 initLab이 쓰는 것과 같음
// 3D와 달리 Three.js·WebGL이 필요 없어 빨리 뜨고, 드래그 회전은 없음
const W = 820, H = 760; // 설계 크기: 장면은 이 안에 그리고, 화면 칸에 맞춰 비율을 지켜 줄이거나 늘림 (아래쪽 맞춤)
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

function loadImages(map) {
  const out = {};
  return Promise.all(Object.keys(map).map(function (k) {
    return new Promise(function (ok, fail) {
      const im = new Image();
      im.onload = function () { out[k] = im; ok(); };
      im.onerror = function () { fail(new Error("그림을 불러오지 못함: " + map[k])); };
      im.src = map[k];
    });
  })).then(function () { return out; });
}

export async function create2DView(stage, canvas, def, opts) {
  const img = await loadImages(def.images);
  const ctx = canvas.getContext("2d");
  const states = def.states, moves = def.moves;
  // 단계 진행 (eco3d.js createView와 같은 방식): 값을 차례로 0~1 사이에서 직선으로 바꾸고 부드럽게 보이는 처리는 장면이 맡음
  // $sound: 체험 창에서만 효과음, $k0·$p0: 이번 그림 직전 진행 상태(효과음 순간 판단용, eco3d-sound.js hit)
  const v = Object.assign({ $key: null, $p: 0, $k0: null, $p0: 0, $sound: !!opts.interactive }, states[0]);
  const mem = {}; // 장면이 그림 사이에 기억할 것(물방울 등)
  let shown = 0, active = null;
  const queue = [];
  function goTo(n, instant) {
    if (instant || reduced || n < shown) {
      queue.length = 0;
      active = null;
      Object.assign(v, states[n], { $key: null, $p: 0 });
      for (const k in mem) delete mem[k];
      shown = n;
      return;
    }
    for (let s = shown + 1; s <= n; s++) {
      moves[s].forEach(function (m) { queue.push({ key: m[0], from: states[s - 1][m[0]], to: states[s][m[0]], dur: m[1], t: 0 }); });
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
    if (p >= 1) { v.$key = null; v.$p = 0; active = null; }
  }

  // 화면 크기: 칸 크기 × 화면 배율로 캔버스를 맞추고, 설계 크기를 비율 지켜 넣음(가로 가운데, 아래쪽 맞춤)
  let scale = 1, ox = 0, oy = 0, dpr = 1;
  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    scale = Math.min(w / W, h / H) * (opts.zoom || 1);
    ox = (w - W * scale) / 2;
    oy = h - H * scale - h * 0.04;
    draw(0);
  }
  let t = 0;
  function draw(dt) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy);
    def.draw(ctx, v, { img: img, dt: dt, t: t, mem: mem, W: W, H: H });
  }
  function update(dt) {
    v.$k0 = v.$key;
    v.$p0 = v.$p;
    runTweens(dt);
    t += dt;
    draw(dt);
  }

  // 화면에 보일 때만 그림
  let visible = false, running = false, prev = 0, dead = false;
  function frame(now) {
    if (dead || !visible || document.hidden) { running = false; return; }
    const dt = Math.min((now - prev) / 1000, 0.05);
    prev = now;
    update(dt);
    requestAnimationFrame(frame);
  }
  function start() {
    if (dead || running || !visible || document.hidden) return;
    running = true;
    prev = performance.now();
    requestAnimationFrame(frame);
  }
  const sizer = new ResizeObserver(resize);
  sizer.observe(stage);
  const watcher = new IntersectionObserver(function (e) { visible = e[e.length - 1].isIntersecting; start(); });
  watcher.observe(stage);
  document.addEventListener("visibilitychange", start);
  resize();

  return {
    goTo: function (n, instant) { goTo(n, instant); if (!running) draw(0); },
    destroy: function () {
      dead = true;
      sizer.disconnect();
      watcher.disconnect();
      document.removeEventListener("visibilitychange", start);
    },
    busy: function () {
      // 화면 밖이면(휴대폰에서 설명을 읽으려 내린 경우 등) 남은 움직임을 건너뛰고 그 단계의 완성 모습으로
      if (opts.interactive && (!visible || document.hidden) && (active || queue.length)) goTo(shown, true);
      return !!active || queue.length > 0;
    }
  };
}
