// 헷갈리는 쓰레기 장면 ("재활용품인 척하는 쓰레기") — 클레이 스타일
// 서대문구·서울시 안내: 칫솔·영수증·나무젓가락·고무장갑·테이프 등은 재활용이 안 되므로 종량제 봉투에,
// 컵라면 용기·유색 스티로폼은 깨끗이 씻어 재질별로 모으면 재활용, 아니면 종량제 봉투
import { GROUND, TAU, clamp01, easeInOut, backOut, lerp, canvasTexture, binGroup, createFaucet, CLAY, clayMat, tiltCurve, bounceDrop, wobble } from "./eco3d-util.js?v=20261108r";
import { bagGroup, recycleSticker } from "./scene-general.js?v=20261108r";
import { sfx, hit } from "./eco3d-sound.js?v=20261108r";

const R_BIN = [-1.65, -0.6]; // 재활용품 수거함 (x, z)
const BAG = [1.45, -0.5];     // 종량제 봉투
const CUP = [0.0, 0.05];      // 컵라면 용기 (수도꼭지 물줄기와 같은 깊이)
const BIN_TOP = GROUND + 1.1;
const CUP_PIV = 0.32;         // 컵을 기울일 때 도는 중심 높이

export default {
  // show 1 = 헷갈리는 쓰레기가 나오고 재활용함에 ✕, bag 1 = 종량제 봉투에 담아 묶음, cup 1 = 컵라면 용기를 씻어 재활용함에
  states: [
    { show: 0, bag: 0, cup: 0 },
    { show: 1, bag: 0, cup: 0 },
    { show: 1, bag: 1, cup: 0 },
    { show: 1, bag: 1, cup: 1 }
  ],
  moves: [null, [["show", 2.4]], [["bag", 3.0]], [["cup", 3.6]]],
  spin: 0.2,
  camera: [1.4, -0.3],
  clay: true, // 클레이 스타일 조명·그림자 (eco3d.js)
  build: build
};

function build(THREE, scene, spin, ext) {
  scene.add(spin);

  // 재활용품 수거함: 파스텔 파랑 + 진한 테두리
  const rBin = binGroup(THREE, 0.72, 0.6, 1.1, CLAY.blue, CLAY.blueDeep, recycleSticker(THREE));
  rBin.position.set(R_BIN[0], GROUND, R_BIN[1]);
  rBin.visible = true;
  spin.add(rBin);

  // 재활용함 위의 표지: ✕(재활용 안 됨) → ✓(씻은 용기는 재활용). 떠 있는 표지라 그림자 없음(투명 재질)
  const noMap = signTexture(THREE, false), okMap = signTexture(THREE, true);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.62), new THREE.MeshBasicMaterial({ map: noMap, transparent: true }));
  sign.position.set(R_BIN[0], BIN_TOP + 0.55, R_BIN[1] + 0.2);
  sign.visible = false;
  spin.add(sign);

  const bag = bagGroup(THREE);
  bag.group.position.set(BAG[0], GROUND, BAG[1]);
  bag.group.visible = false;
  spin.add(bag.group);

  // 헷갈리는 쓰레기 5가지
  const items = [toothbrush(THREE, ext), receipt(THREE), chopsticks(THREE), glove(THREE), tape(THREE)];
  const HOME = [[-0.7, 0.6], [-0.15, 0.75], [0.35, 0.55], [0.85, 0.7], [1.35, 0.5]]; // 재활용함과 겹치지 않게 오른쪽으로
  items.forEach(function (it, i) {
    it.scale.multiplyScalar(1.2);
    it.userData.size = it.scale.x;
    it.position.set(HOME[i][0], GROUND, HOME[i][1]);
    it.visible = false;
    spin.add(it);
  });

  // 컵라면 용기: cup(자리) → cupTilt(기울이기, 가운데 높이에서 돎) → 컵
  const cup = new THREE.Group();
  const cupTilt = new THREE.Group();
  cupTilt.position.y = CUP_PIV;
  const cupBody = cupNoodle(THREE);
  cupBody.position.y = -CUP_PIV;
  cupTilt.add(cupBody);
  cup.add(cupTilt);
  cup.position.set(CUP[0], GROUND, CUP[1]);
  cup.visible = false;
  spin.add(cup);
  const faucet = createFaucet(THREE, scene, CUP[0], GROUND + 1.75);

  const p = new THREE.Vector3();
  const mouth = new THREE.Vector3();

  // 부피는 그대로인 느낌으로 늘이거나 눌러 크기를 정함 (k > 1 늘어남, k < 1 눌림)
  function squash(obj, size, k) {
    const w = size / Math.sqrt(k);
    obj.scale.set(w, size * k, w);
  }

  function update(v, dt) {
    // 1단계: 쓰레기가 하나씩 위에서 떨어져 통통 튀며 놓이고, 재활용함 위에 ✕가 고개 젓듯 흔들림
    const sp = v.show;
    items.forEach(function (it, i) {
      it.userData.k = clamp01((sp - i * 0.1) / 0.4);
    });
    const xk = backOut(clamp01((sp - 0.62) / 0.3));
    const cp = v.cup;
    // ✓로 바뀔 때는 표지가 한 바퀴 뒤집힘 (옆으로 선 순간 그림을 바꿈)
    const flip = easeInOut(clamp01((cp - 0.84) / 0.12));
    const ok = flip >= 0.5;
    if ((sign.material.map === okMap) !== ok) { sign.material.map = ok ? okMap : noMap; sign.material.needsUpdate = true; }
    sign.visible = xk > 0.001;
    const pop = 1 + 0.15 * Math.sin(clamp01((cp - 0.9) / 0.1) * Math.PI);
    sign.scale.set(Math.max(xk * pop * Math.abs(Math.cos(Math.PI * flip)), 0.001), Math.max(xk * pop, 0.001), 1);
    sign.rotation.z = wobble(clamp01((sp - 0.78) / 0.22), 2) * 0.35;

    // 2단계: 종량제 봉투가 떨어져 통통 튀고, 쓰레기가 움츠렸다 뛰어 하나씩 쏙 들어감(봉투 출렁) → 입구를 묶음
    const bp = v.bag;
    bag.group.visible = bp > 0;
    bag.group.position.y = GROUND + bounceDrop(clamp01(bp / 0.22)) * 0.7;
    let jiggle = 0;
    items.forEach(function (it, i) {
      const k = it.userData.k;
      const q = clamp01((bp - 0.15 - i * 0.1) / 0.3);
      const crouch = q > 0 && q < 0.15 ? Math.sin(Math.PI * q / 0.15) : 0;
      const f = easeInOut(clamp01((q - 0.12) / 0.88));
      it.visible = k > 0 && q < 1;
      p.set(lerp(HOME[i][0], BAG[0], f), lerp(GROUND, GROUND + 1.25, f) + Math.sin(Math.PI * f) * 0.9, lerp(HOME[i][1], BAG[1], f));
      // 나올 때: 위에서 떨어져 바닥에서 두 번 작게 튐
      if (q <= 0) p.y += bounceDrop(k) * 0.8;
      it.position.copy(p);
      it.rotation.y = f * Math.PI;
      const land = q <= 0 ? wobble(clamp01((k - 0.55) / 0.45), 2) : 0;
      const stretch = f > 0 && f < 0.4 ? Math.sin(Math.PI * f / 0.4) * 0.12 : 0;
      const shrink = f > 0.8 ? lerp(1, 0.3, (f - 0.8) / 0.2) : 1;
      squash(it, it.userData.size * Math.max(backOut(clamp01(k / 0.5)) * shrink, 0.001), 1 - crouch * 0.2 - land * 0.1 + stretch);
      jiggle += wobble(clamp01((bp - 0.45 - i * 0.1) / 0.14), 1);
    });
    bag.setTie(easeInOut(clamp01((bp - 0.8) / 0.18)), clamp01((bp - 0.15) / 0.6));
    squash(bag.group, Math.max(backOut(clamp01(bp / 0.2)), 0.001), 1 - jiggle * 0.07);

    // 3단계: 컵라면 용기가 통통 나오고 → 물로 헹군 뒤 → 기울여 물을 쏟고 → 움츠렸다 뛰어 ✓가 된 재활용함으로
    cup.visible = cp > 0 && cp < 1;
    const ck = backOut(clamp01(cp / 0.14));
    faucet.update(clamp01((cp - 0.12) / 0.08) * (1 - clamp01((cp - 0.44) / 0.06)), cp > 0.2 && cp < 0.42, dt);
    const pour = clamp01((cp - 0.48) / 0.16);
    const tp = pour > 0 && pour < 1 ? tiltCurve(pour) : 0;
    cupTilt.rotation.z = -tp * 1.9;
    if (pour > 0.36 && pour < 0.72) faucet.pour(cupBody, mouth.set(0.36, 0.64, 0), cupTilt, faucet.drops, dt);
    const crouch = cp > 0.64 && cp < 0.7 ? Math.sin(Math.PI * (cp - 0.64) / 0.06) : 0;
    const q = easeInOut(clamp01((cp - 0.68) / 0.24));
    cup.position.set(lerp(CUP[0], R_BIN[0], q),
      lerp(GROUND, BIN_TOP + 0.1, q) + Math.sin(Math.PI * q) * 1.2 + tp * 0.35 + bounceDrop(clamp01(cp / 0.16)) * 0.6,
      lerp(CUP[1], R_BIN[1], q));
    cup.rotation.z = q * 0.8;
    const stretch = q > 0 && q < 0.4 ? Math.sin(Math.PI * q / 0.4) * 0.12 : 0;
    squash(cup, Math.max(ck * (q > 0.8 ? lerp(1, 0.3, (q - 0.8) / 0.2) : 1), 0.001), 1 - crouch * 0.18 + stretch);
    // 컵이 들어가면 재활용함이 출렁
    const binLand = wobble(clamp01((cp - 0.9) / 0.1), 2);
    rBin.rotation.z = binLand * 0.06;
    rBin.scale.set(1, 1 - binLand * 0.05, 1);

    // 효과음 (체험 창에서 효과음을 켰을 때만): 진행률이 그 순간을 지날 때 한 번
    if (hit(v, "show", 0.24) || hit(v, "show", 0.44) || hit(v, "show", 0.64)) sfx.play("tap"); // 쓰레기가 떨어져 톡톡 (5개 중 3번만)
    if (hit(v, "bag", 0.132)) sfx.play("rustle", 0.25);  // 봉투가 떨어질 때 바스락
    if (hit(v, "bag", 0.42)) sfx.play("rustle", 1.3);    // 쓰레기가 하나씩 들어가는 동안 바스락
    if (hit(v, "bag", 0.86)) sfx.play("tie");            // 입구 묶기 슥슥
    if (hit(v, "cup", 0.2)) sfx.play("water", 0.79);     // 수도꼭지 물줄기
    if (hit(v, "cup", 0.538)) sfx.play("pour", 0.21);    // 헹군 물 쏟기
    if (hit(v, "cup", 0.86)) sfx.play("slide");          // 컵이 재활용함에 쏙
    if (hit(v, "cup", 0.95)) sfx.play("chime");          // ✓로 바뀌며 끝 띵동
  }

  return { update: update, reset: function () { faucet.clear(); } };
}

// ✕ 산호색 동그라미 / ✓ 초록 동그라미 (파스텔, 크림 테두리)
function signTexture(THREE, ok) {
  return canvasTexture(THREE, 256, 256, function (g, w, h) {
    g.fillStyle = "#fff6e6";
    g.beginPath();
    g.arc(w / 2, h / 2, 124, 0, TAU);
    g.fill();
    g.fillStyle = ok ? "#5cb98a" : "#ee8f7b";
    g.beginPath();
    g.arc(w / 2, h / 2, 110, 0, TAU);
    g.fill();
    g.strokeStyle = "#ffffff";
    g.lineWidth = 30;
    g.lineCap = "round";
    g.lineJoin = "round";
    g.beginPath();
    if (ok) { g.moveTo(72, 132); g.lineTo(112, 172); g.lineTo(186, 92); }
    else { g.moveTo(88, 88); g.lineTo(168, 168); g.moveTo(168, 88); g.lineTo(88, 168); }
    g.stroke();
  });
}

// 칫솔: 둥근 손잡이 + 둥근 솔 (오른쪽으로 비스듬히 세워 재활용함과 겹치지 않게)
function toothbrush(THREE, ext) {
  const g = new THREE.Group();
  const handle = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.86, 4, 14), clayMat(THREE, CLAY.blue));
  handle.scale.z = 0.7;
  handle.position.y = 0.48;
  const bGeo = ext && ext.RoundedBoxGeometry ? new ext.RoundedBoxGeometry(0.09, 0.22, 0.12, 3, 0.035) : new THREE.BoxGeometry(0.09, 0.22, 0.12);
  const bristle = new THREE.Mesh(bGeo, clayMat(THREE, CLAY.white, { roughness: 0.85, sheen: 0.8 }));
  bristle.position.set(0, 0.84, 0.07);
  g.add(handle, bristle);
  g.rotation.z = -0.3;
  return g;
}

// 영수증: 살짝 말린 흰 종이
function receipt(THREE) {
  const g = new THREE.Group();
  const geo = new THREE.PlaneGeometry(0.42, 0.8, 1, 12);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.pow((pos.getY(i) + 0.4) / 0.8, 2) * 0.18);
  geo.computeVertexNormals();
  const paper = new THREE.Mesh(geo, clayMat(THREE, 0xffffff, { map: receiptTexture(THREE), roughness: 0.8, side: THREE.DoubleSide }));
  paper.position.y = 0.42;
  paper.rotation.x = -0.25;
  g.add(paper);
  return g;
}

// 나무젓가락 한 쌍 (기대어 세움)
function chopsticks(THREE) {
  const g = new THREE.Group();
  const wood = clayMat(THREE, CLAY.wood, { roughness: 0.75 });
  [-0.05, 0.05].forEach(function (x, i) {
    const s = new THREE.Mesh(new THREE.CapsuleGeometry(0.028, 0.95, 4, 10), wood);
    s.position.set(x, 0.5, 0);
    s.rotation.z = i ? -0.18 : -0.12;
    g.add(s);
  });
  return g;
}

// 고무장갑: 손바닥 + 손가락 넷 + 엄지 + 소매 (말랑한 파스텔 노랑)
function glove(THREE) {
  const g = new THREE.Group();
  const rubber = clayMat(THREE, CLAY.yellow, { roughness: 0.4, clearcoat: 0.35 });
  const palm = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.22, 6, 14), rubber);
  palm.scale.z = 0.45;
  palm.position.y = 0.45;
  g.add(palm);
  [-0.12, -0.04, 0.04, 0.12].forEach(function (x, i) {
    const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.048, 0.2 + (i === 1 || i === 2 ? 0.05 : 0), 4, 10), rubber);
    f.position.set(x, 0.78 + (i === 1 || i === 2 ? 0.03 : 0), 0);
    g.add(f);
  });
  const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.052, 0.16, 4, 10), rubber);
  thumb.position.set(0.22, 0.5, 0);
  thumb.rotation.z = -0.7;
  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.17, 0.28, 24, 1, true), clayMat(THREE, CLAY.yellow, { roughness: 0.4, clearcoat: 0.35, side: THREE.DoubleSide }));
  cuff.scale.z = 0.5;
  cuff.position.y = 0.16;
  const cuffRim = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.03, 10, 32), rubber);
  cuffRim.rotation.x = Math.PI / 2;
  cuffRim.scale.y = 0.5;
  cuffRim.position.y = 0.03;
  g.add(thumb, cuff, cuffRim);
  return g;
}

// 테이프 한 롤 (세워 둠): 두툼한 나무색 롤 + 크림색 심
function tape(THREE) {
  const g = new THREE.Group();
  const roll = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.1, 18, 40), clayMat(THREE, 0xf0d9a8, { roughness: 0.3, clearcoat: 0.5 }));
  roll.position.y = 0.3;
  roll.scale.z = 1.5;
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.26, 28, 1, true), clayMat(THREE, CLAY.cream, { side: THREE.DoubleSide }));
  core.rotation.x = Math.PI / 2;
  core.position.y = 0.3;
  g.add(roll, core);
  return g;
}

// 컵라면 용기: 크림색 컵 + 산호색 띠 + 두툼한 입구 테두리
function cupNoodle(THREE) {
  const g = new THREE.Group();
  const geo = new THREE.LatheGeometry([[0, 0], [0.28, 0], [0.31, 0.02], [0.32, 0.05], [0.42, 0.62], [0.43, 0.64]].map(function (p) { return new THREE.Vector2(p[0], p[1]); }), 48);
  // 무늬가 바닥 쪽에 몰리지 않도록 세로 무늬 좌표를 높이에 맞춤
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setY(i, pos.getY(i) / 0.64);
  const cup = new THREE.Mesh(geo, clayMat(THREE, 0xffffff, { map: cupTexture(THREE), roughness: 0.6, side: THREE.DoubleSide }));
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.03, 12, 48), clayMat(THREE, CLAY.white));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.64;
  g.add(cup, rim);
  return g;
}

function receiptTexture(THREE) {
  return canvasTexture(THREE, 128, 256, function (g, w, h) {
    g.fillStyle = "#fffdf6";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#c9d3cd";
    for (let i = 0; i < 9; i++) g.fillRect(14, 24 + i * 22, w - 28 - (i % 3) * 22, 7);
    g.fillStyle = "#6cc596";
    g.fillRect(14, 228, w - 28, 10);
  });
}

function cupTexture(THREE) {
  return canvasTexture(THREE, 256, 128, function (g, w, h) {
    g.fillStyle = "#fff6e6";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#f29a86";
    g.fillRect(0, h * 0.45, w, h * 0.3);
    g.fillStyle = "#f7d36e";
    g.fillRect(0, h * 0.75, w, 8);
  });
}
