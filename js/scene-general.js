// 일반 쓰레기 장면 (클레이 스타일)
// 서대문구청 안내: 재활용품은 품목별로 따로 배출, 일반(가연성) 쓰레기는 종량제 봉투에 담아
// 18시~23시에 내 집 앞·내 점포 앞에 배출 (규격봉투 미사용 시 과태료)
import { GROUND, TAU, clamp01, smooth, easeInOut, backOut, lerp, densePoints, canvasTexture, stickerTexture, binGroup, seeded, houseFront, CLAY, clayMat, bounceDrop, wobble } from "./eco3d-util.js?v=20261108k";
import { sfx, hit } from "./eco3d-sound.js?v=20261108k";

const R_BIN = [1.6, 0.35];     // 재활용품 수거함 위치 (x, z)
const BAG = [-1.45, 0.15];      // 종량제 봉투가 나타나는 곳
const BAG_OUT = [0.3, -0.85];  // 집 앞에 내놓는 곳
const HOUSE_Z = -1.55;
const BAG_SIZE = 0.82;          // 봉투 크기 비율

export default {
  // sort 1 = 재활용품을 골라냄, bag 1 = 종량제 봉투에 담아 묶음, out 1 = 저녁에 집 앞에 내놓음
  states: [
    { sort: 0, bag: 0, out: 0 },
    { sort: 1, bag: 0, out: 0 },
    { sort: 1, bag: 1, out: 0 },
    { sort: 1, bag: 1, out: 1 }
  ],
  moves: [null, [["sort", 2.8]], [["bag", 3.8]], [["out", 3.2]]],
  spin: 0.3,
  camera: [1.6, -0.2],
  clay: true, // 클레이 스타일 조명·그림자 (eco3d.js)
  build: build
};

function build(THREE, scene, spin, ext) {
  scene.add(spin);
  const rand = seeded(11);

  // 일반쓰레기: 휴지 뭉치, 스펀지, 낙엽
  const trash = [tissue(THREE, rand, 0.2), tissue(THREE, rand, 0.16), sponge(THREE, ext), leaf(THREE, CLAY.green), leaf(THREE, 0xf2b880)];
  // 작은 카드에서도 보이도록 1.35배로 키움 (높이는 바닥에 닿도록)
  [[-0.45, 0.17, 0.25], [0.15, 0.13, 0.5], [-0.05, 0.06, -0.05], [0.5, 0.02, 0.15], [-0.75, 0.02, -0.15]].forEach(function (p, i) {
    trash[i].scale.multiplyScalar(1.35);
    trash[i].position.set(p[0] * 1.3, GROUND + p[1] * 1.35, p[2] * 1.3);
    trash[i].userData.home = trash[i].position.clone();
    trash[i].userData.rot = trash[i].rotation.clone();
    trash[i].userData.size = trash[i].scale.x;
    spin.add(trash[i]);
  });

  // 섞여 있던 재활용품: 캔, 유리병
  const recyc = [can(THREE), glassBottle(THREE)];
  [[0.42, 0, -0.3], [-0.3, 0, -0.45]].forEach(function (p, i) {
    recyc[i].scale.multiplyScalar(1.35);
    recyc[i].position.set(p[0] * 1.3, GROUND + p[1], p[2] * 1.3);
    recyc[i].userData.home = recyc[i].position.clone();
    recyc[i].userData.size = recyc[i].scale.x;
    spin.add(recyc[i]);
  });

  // 재활용품 수거함: 파스텔 파랑 + 진한 테두리
  const rBin = binGroup(THREE, 0.46, 0.4, 0.72, CLAY.blue, CLAY.blueDeep, recycleSticker(THREE));
  rBin.position.set(R_BIN[0], GROUND, R_BIN[1]);
  spin.add(rBin);

  // 종량제 봉투 (불투명해서 진짜 그림자가 생김)
  const bag = bagGroup(THREE);
  spin.add(bag.group);

  // 집 앞 (배출 시간 안내판)과 달
  const house = clayHouse(THREE, ext, timeSign(THREE));
  house.position.set(0, GROUND, HOUSE_Z);
  spin.add(house);
  const moon = new THREE.Mesh(new THREE.SphereGeometry(0.26, 32, 20), clayMat(THREE, 0xfff1b8, { emissive: 0xffe08a, emissiveIntensity: 0.55 }));
  moon.position.set(-1.9, 1.75, HOUSE_Z - 0.4);
  moon.userData.noShadow = true;
  spin.add(moon);

  const to = new THREE.Vector3();

  // home에서 target으로 포물선을 그리며 날아감 (q 0~1)
  function fly(obj, target, q, arc) {
    const e = easeInOut(q);
    obj.position.lerpVectors(obj.userData.home, target, e);
    obj.position.y += Math.sin(Math.PI * e) * arc;
  }
  // 부피는 그대로인 느낌으로 늘이거나 눌러 크기를 정함 (k > 1 늘어남, k < 1 눌림)
  function squash(obj, size, k) {
    const w = size / Math.sqrt(k);
    obj.scale.set(w, size * k, w);
  }
  // 움츠렸다(준비) → 포물선으로 날아가 → 끝에서 작아지며 쏙 들어감 (q 0~1)
  function hop(obj, target, q, arc) {
    const crouch = q > 0 && q < 0.18 ? Math.sin(Math.PI * q / 0.18) : 0;
    const f = clamp01((q - 0.15) / 0.85);
    fly(obj, target, f, arc);
    const shrink = f > 0.8 ? lerp(1, 0.25, (f - 0.8) / 0.2) : 1;
    squash(obj, obj.userData.size * shrink, 1 - crouch * 0.2 + (f > 0 && f < 0.4 ? Math.sin(Math.PI * f / 0.4) * 0.12 : 0));
    return f;
  }

  function update(v) {
    // 1단계: 재활용품 수거함이 통통 튀며 나오고, 캔·병이 움츠렸다 뛰어 차례로 쏙 들어감 → 수거함이 출렁
    const sp = v.sort;
    rBin.visible = sp > 0;
    rBin.scale.setScalar(Math.max(backOut(clamp01(sp / 0.18)), 0.001));
    rBin.position.y = GROUND + bounceDrop(clamp01(sp / 0.22)) * 0.5;
    let shake = 0;
    recyc.forEach(function (r, i) {
      const q = clamp01((sp - 0.15 - i * 0.25) / 0.4);
      r.visible = q < 1;
      to.set(R_BIN[0], GROUND + 0.55, R_BIN[1]);
      const f = hop(r, to, q, 1.1);
      r.rotation.set(0, 0, -easeInOut(f) * 2.2);
      shake += wobble(clamp01((sp - 0.55 - i * 0.25) / 0.2), 2);
    });
    rBin.rotation.z = shake * 0.07;

    // 2단계: 봉투가 위에서 떨어져 통통 튀고, 일반쓰레기가 하나씩 들어간 뒤(봉투가 출렁) 입구를 묶음
    const bp = v.bag;
    const appear = backOut(clamp01(bp / 0.16));
    const tie = easeInOut(clamp01((bp - 0.78) / 0.18));
    let jiggle = 0;
    trash.forEach(function (t, i) {
      const q = clamp01((bp - 0.1 - i * 0.1) / 0.26);
      t.visible = q < 1;
      to.set(BAG[0], GROUND + 1.0, BAG[1]);
      const f = hop(t, to, q, 0.7);
      t.rotation.set(t.userData.rot.x + easeInOut(f) * 3, t.userData.rot.y, t.userData.rot.z + easeInOut(f) * 2);
      jiggle += wobble(clamp01((bp - 0.36 - i * 0.1) / 0.16), 1);
    });
    bag.setTie(tie, smooth(0.2, 0.75, bp));
    const tied = wobble(clamp01((bp - 0.9) / 0.1), 2);

    // 3단계: 집 앞이 솟아오르고 달이 뜬 뒤, 봉투가 움츠렸다 폴짝 뛰어 집 앞에 내려앉음
    const op = v.out;
    const rise = backOut(clamp01(op / 0.3));
    house.visible = op > 0;
    house.scale.set(1, Math.max(rise, 0.001), 1);
    moon.visible = op > 0.15;
    moon.scale.setScalar(Math.max(backOut(clamp01((op - 0.15) / 0.25)), 0.001));
    moon.position.y = 1.75 + (1 - easeInOut(clamp01((op - 0.15) / 0.35))) * -0.5;
    house.userData.sign.scale.setScalar(Math.max(backOut(clamp01((op - 0.75) / 0.22)), 0.001));
    const crouch = op > 0.28 && op < 0.38 ? Math.sin(Math.PI * (op - 0.28) / 0.1) : 0;
    const carry = easeInOut(clamp01((op - 0.34) / 0.36));
    const land = wobble(clamp01((op - 0.7) / 0.25), 2);

    const g = bag.group;
    g.visible = bp > 0;
    g.position.set(lerp(BAG[0], BAG_OUT[0], carry),
      GROUND + bounceDrop(clamp01(bp / 0.22)) * 0.6 + Math.sin(Math.PI * carry) * 0.8,
      lerp(BAG[1], BAG_OUT[1], carry));
    g.rotation.z = Math.sin(Math.PI * carry) * -0.15 + tied * 0.05;
    const k = 1 - jiggle * 0.07 - crouch * 0.14 + (carry > 0 && carry < 0.5 ? Math.sin(Math.PI * carry / 0.5) * 0.08 : 0) - land * 0.08;
    squash(g, Math.max(appear, 0.001) * BAG_SIZE, k);

    // 효과음 (체험 창에서 효과음을 켰을 때만): 진행률이 그 순간을 지날 때 한 번
    if (hit(v, "sort", 0.132)) sfx.play("tap");           // 수거함이 내려앉을 때 톡
    if (hit(v, "sort", 0.52)) sfx.play("slide");          // 캔이 수거함에 쏙
    if (hit(v, "sort", 0.77)) sfx.play("clink");          // 유리병이 수거함에 쨍
    if (hit(v, "bag", 0.132)) sfx.play("rustle", 0.25);   // 봉투가 떨어질 때 바스락
    if (hit(v, "bag", 0.33)) sfx.play("rustle", 1.6);     // 쓰레기가 하나씩 들어가는 동안 바스락
    if (hit(v, "bag", 0.82)) sfx.play("tie");             // 입구 묶기 슥슥
    if (hit(v, "out", 0.7)) sfx.play("thud");             // 집 앞에 털썩
    if (hit(v, "out", 0.95)) sfx.play("chime");           // 끝 띵동
  }

  // 되돌릴 때 따로 정리할 것은 없음 (모두 상태값으로 그림)
  return { update: update };
}

// 종량제 봉투: 몸통 + 입구(묶으면 오므라듦) + 묶은 매듭 — 말랑한 크림색 비닐에 초록 띠
// 종량제 봉투·재활용 스티커는 헷갈리는 쓰레기 장면(scene-confuse.js)에서도 씀
export function bagGroup(THREE) {
  const group = new THREE.Group();
  const film = { roughness: 0.5, clearcoat: 0.35, clearcoatRoughness: 0.4, side: THREE.DoubleSide };
  const mat = clayMat(THREE, 0xffffff, Object.assign({ map: bagTexture(THREE) }, film));
  const bodyGeo = new THREE.LatheGeometry(densePoints(THREE, [[0, 0], [0.42, 0.02], [0.62, 0.14], [0.7, 0.45], [0.68, 0.82], [0.56, 1.04], [0.4, 1.15]], 4), 56);
  const bp = bodyGeo.attributes.position;
  for (let i = 0; i < bp.count; i++) {
    const x = bp.getX(i), y = bp.getY(i), z = bp.getZ(i);
    // 비닐이 부드럽게 우는 정도 (예전보다 굵고 얕은 주름)
    const k = 1 + 0.035 * Math.sin(Math.atan2(z, x) * 5 + y * 4) * Math.sin(y * 7) * (1 - smooth(0.85, 1.1, y));
    bp.setXYZ(i, x * k, y, z * k);
  }
  bodyGeo.computeVertexNormals();
  const body = new THREE.Mesh(bodyGeo, mat);
  group.add(body);

  // 입구: 위쪽 반지름을 묶는 정도에 따라 줄임
  const NECK_H = 0.42, R = 0.4;
  const neckGeo = new THREE.CylinderGeometry(R, R, NECK_H, 40, 6, true);
  const neck = new THREE.Mesh(neckGeo, clayMat(THREE, CLAY.white, film));
  neck.position.y = 1.15 + NECK_H / 2;
  group.add(neck);
  const pos = neckGeo.attributes.position;
  const orig = pos.array.slice();

  const knotMat = clayMat(THREE, CLAY.white, { roughness: 0.5, clearcoat: 0.35 });
  const knot = new THREE.Group();
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 12), knotMat);
  knot.add(ball);
  [-1, 1].forEach(function (side) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 12), knotMat);
    ear.scale.set(1, 0.5, 0.4);
    ear.position.set(side * 0.16, 0.08, 0);
    ear.rotation.z = side * 0.6;
    knot.add(ear);
  });
  knot.position.y = 1.15 + NECK_H;
  group.add(knot);

  let lastTie = -1, lastFull = -1;
  function setTie(tie, full) {
    if (tie === lastTie && full === lastFull) return;
    lastTie = tie;
    lastFull = full;
    // 쓰레기가 찰수록 몸통이 조금 불룩해짐
    const wide = 0.92 + full * 0.1, tall = 0.94 + full * 0.06;
    body.scale.set(wide, tall, wide);
    neck.scale.set(wide, 1, wide);
    neck.position.y = 1.15 * tall + NECK_H * lerp(1, 0.75, tie) / 2;
    const top = lerp(R, 0.05, tie);
    for (let i = 0; i < pos.count; i++) {
      const x = orig[i * 3], y = orig[i * 3 + 1], z = orig[i * 3 + 2];
      const t = (y + NECK_H / 2) / NECK_H;
      const r = lerp(R, top, smooth(0, 1, t)) / R;
      pos.setXYZ(i, x * r, y * lerp(1, 0.75, tie), z * r);
    }
    pos.needsUpdate = true;
    neckGeo.computeVertexNormals();
    knot.visible = tie > 0.5;
    knot.scale.setScalar(Math.max(backOut(clamp01((tie - 0.5) / 0.5)), 0.001));
    knot.position.y = 1.15 * tall + NECK_H * lerp(1, 0.75, tie) - 0.02;
  }
  return { group: group, setTie: setTie };
}

function bagTexture(THREE) {
  return canvasTexture(THREE, 1024, 256, function (g, w, h) {
    g.fillStyle = "#fbf8f0";
    g.fillRect(0, 0, w, h);
    // 옆면 가운데 파스텔 초록 띠 두 줄
    g.fillStyle = "#6cc596";
    g.fillRect(0, h * 0.3, w, h * 0.13);
    g.fillRect(0, h * 0.47, w, h * 0.04);
  });
}

// 집 앞 벽: 공용 houseFront를 그대로 쓰고, 상자는 둥근 상자로·색은 파스텔 점토로 바꿈
function clayHouse(THREE, ext, signMap) {
  const house = houseFront(THREE, signMap);
  // 원래 색 → 클레이 팔레트 (벽 따뜻한 크림, 처마 나무, 문 초록, 불 켜진 창 노랑)
  const COL = { 0xefe6d6: 0xf8e4c8, 0xa58f74: CLAY.wood, 0xbdb19c: CLAY.mint, 0x7a5236: CLAY.green, 0x5c3d28: CLAY.greenDeep, 0xffd98a: CLAY.yellow, 0xd8b25a: CLAY.yellowDeep };
  house.traverse(function (o) {
    if (!o.isMesh || o === house.userData.sign) return;
    const old = o.material;
    if (ext && ext.RoundedBoxGeometry && o.geometry.type === "BoxGeometry") {
      const p = o.geometry.parameters;
      o.geometry = new ext.RoundedBoxGeometry(p.width, p.height, p.depth, 3, Math.min(p.width, p.height, p.depth) * 0.35);
    }
    const hex = old.color.getHex();
    o.material = clayMat(THREE, COL[hex] !== undefined ? COL[hex] : hex, { emissive: old.emissive.clone(), emissiveIntensity: old.emissiveIntensity });
    old.dispose();
  });
  return house;
}

function tissue(THREE, rand, size) {
  const geo = new THREE.SphereGeometry(size, 28, 18);
  const pos = geo.attributes.position;
  // 위치로 울퉁불퉁함을 정해서 이음매가 벌어지지 않게 함 (점토처럼 굵고 둥근 혹)
  const a = rand() * 10;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const k = 1 + 0.14 * Math.sin(x * 17 + a) * Math.sin(y * 15 + a) * Math.sin(z * 16 + a);
    pos.setXYZ(i, x * k, y * k, z * k);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, clayMat(THREE, CLAY.white, { roughness: 0.8, sheen: 0.7 }));
  m.rotation.set(rand() * 3, rand() * 3, 0);
  return m;
}

function sponge(THREE, ext) {
  function box(w, h, d, r) { return ext && ext.RoundedBoxGeometry ? new ext.RoundedBoxGeometry(w, h, d, 3, r) : new THREE.BoxGeometry(w, h, d); }
  const g = new THREE.Group();
  const soft = new THREE.Mesh(box(0.4, 0.12, 0.26, 0.04), clayMat(THREE, CLAY.yellow, { roughness: 0.85 }));
  const scrub = new THREE.Mesh(box(0.4, 0.06, 0.26, 0.025), clayMat(THREE, CLAY.green, { roughness: 0.85 }));
  scrub.position.y = 0.085;
  g.add(soft, scrub);
  g.rotation.y = 0.5;
  return g;
}

// 낙엽: 두께가 있고 가장자리가 둥근 잎
function leaf(THREE, color) {
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.2);
  shape.quadraticCurveTo(0.16, -0.05, 0, 0.2);
  shape.quadraticCurveTo(-0.16, -0.05, 0, -0.2);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.015, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2, curveSegments: 10 });
  const m = new THREE.Mesh(geo, clayMat(THREE, color, { roughness: 0.7 }));
  m.rotation.set(-Math.PI / 2 + 0.15, 0, 0.8);
  return m;
}

// 캔: 은색 몸통 + 산호색 띠 + 두툼한 위아래 테두리
function can(THREE) {
  const g = new THREE.Group();
  const metal = clayMat(THREE, CLAY.silver, { metalness: 0.3, roughness: 0.35, clearcoat: 0.4 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.4, 32), metal);
  body.position.y = 0.21;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.134, 0.134, 0.24, 32, 1, true), clayMat(THREE, CLAY.coral));
  band.position.y = 0.21;
  g.add(body, band);
  [0.02, 0.4].forEach(function (y) {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.022, 10, 32), metal);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = y;
    g.add(rim);
  });
  return g;
}

// 유리병: 맑은 초록을 반짝이는 점토처럼 (불투명이라 그림자가 생김)
function glassBottle(THREE) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(
    new THREE.LatheGeometry(densePoints(THREE, [[0, 0], [0.13, 0], [0.16, 0.03], [0.16, 0.36], [0.12, 0.46], [0.065, 0.54], [0.065, 0.66], [0.075, 0.68], [0.07, 0.7], [0, 0.7]], 3), 36),
    clayMat(THREE, 0x9ad7b0, { roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.12, sheen: 0.3 })
  );
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.06, 20), clayMat(THREE, CLAY.yellowDeep));
  cap.position.y = 0.71;
  g.add(m, cap);
  return g;
}

export function recycleSticker(THREE) {
  return stickerTexture(THREE, 512, 312, "#4a8fe0", function (g, w, h) {
    // 돌고 도는 화살표 세 개
    g.lineWidth = 22;
    g.lineCap = "round";
    g.strokeStyle = "#4a8fe0";
    for (let i = 0; i < 3; i++) {
      const a0 = i * TAU / 3 - Math.PI / 2 + 0.25, a1 = a0 + TAU / 3 - 0.6;
      g.beginPath();
      g.arc(w / 2, h / 2 + 6, 82, a0, a1);
      g.stroke();
      const ex = w / 2 + Math.cos(a1) * 82, ey = h / 2 + 6 + Math.sin(a1) * 82;
      const tx = -Math.sin(a1), ty = Math.cos(a1);
      g.beginPath();
      g.moveTo(ex + tx * 30, ey + ty * 30);
      g.lineTo(ex - ty * 26, ey + tx * 26);
      g.lineTo(ex + ty * 26, ey - tx * 26);
      g.fill();
    }
  });
}

// 벽에 붙는 배출 시간 안내판 (달 + 18:00 ~, 서대문구 안내문: 오후 6시부터): 파스텔 밤하늘색
function timeSign(THREE) {
  return canvasTexture(THREE, 512, 336, function (g, w, h) {
    g.fillStyle = "#6f8fd8";
    g.beginPath();
    g.roundRect(6, 6, w - 12, h - 12, 48);
    g.fill();
    g.strokeStyle = "#fff6e6";
    g.lineWidth = 10;
    g.stroke();
    g.fillStyle = "#f7d36e";
    g.beginPath();
    g.arc(w / 2, 108, 60, 0, TAU);
    g.fill();
    g.fillStyle = "#6f8fd8";
    g.beginPath();
    g.arc(w / 2 + 30, 88, 54, 0, TAU);
    g.fill();
    g.fillStyle = "#fff6e6";
    g.font = "bold 78px system-ui, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("18:00 ~", w / 2, 250);
  });
}
