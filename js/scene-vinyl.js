// 비닐 장면 (클레이 스타일)
// 서울시·서대문구 폐비닐 안내: 내용물 비우기 → 음식물이 묻었다면 헹구기 → 따로 모아 배출
// (재활용품 분리배출 안내: 비닐류는 투명 비닐봉투에 담아 배출 / 씻어도 오염이 남은 비닐은 종량제 봉투)
import { GROUND, TAU, clamp01, smooth, easeInOut, backOut, lerp, canvasTexture, addShadow, createDrops, createFaucet, seeded, CLAY, clayMat, tiltCurve, wobble } from "./eco3d-util.js?v=20261108r";
import { sfx, hit } from "./eco3d-sound.js?v=20261108r";

const W = 1.3, H = 1.8, T = 0.22; // 과자 봉지 폭·높이·불룩한 두께
const PIV = GROUND + 1.0;
// 투명 봉투 옆모습: 넣을 때는 입구가 넓게 열려 있다가(OPEN) 묶으면 오므라듦(CLOSED)
const OPEN = [[0, 0], [0.85, 0.03], [1.05, 0.4], [1.08, 1.2], [1.05, 1.75], [0.98, 2.0], [1.02, 2.06]];
const CLOSED = [[0, 0], [0.85, 0.03], [1.05, 0.4], [1.08, 1.2], [0.85, 1.75], [0.32, 2.0], [0.2, 2.06]];

export default {
  // empty 1 = 부스러기를 털어 냄, rinse 1 = 물로 헹굼, bag 1 = 투명 봉투에 모아 묶음
  states: [
    { empty: 0, rinse: 0, bag: 0 },
    { empty: 1, rinse: 0, bag: 0 },
    { empty: 1, rinse: 1, bag: 0 },
    { empty: 1, rinse: 1, bag: 1 }
  ],
  moves: [null, [["empty", 2.4]], [["rinse", 3.6]], [["bag", 2.6]]],
  spin: 0.5,
  camera: [0.3, -0.3],
  clay: true, // 클레이 스타일 조명·그림자 (eco3d.js)
  endOrbit: true, // 마지막 단계가 끝나면 드래그로 수거함까지 장면 전체가 돎 (앞 단계는 물건만)
  build: build
};

function build(THREE, scene, spin, ext) {
  const root = new THREE.Group();
  const tilt = new THREE.Group();
  tilt.position.y = PIV;
  const pouch = new THREE.Group();
  pouch.position.y = GROUND - PIV;
  root.add(tilt);
  tilt.add(spin);
  spin.add(pouch);
  scene.add(root);

  // 베개 모양으로 부푼 과자 봉지 (가장자리는 얇게 붙어 있음) — 파스텔 점토에 은은한 윤기
  const geo = new THREE.BoxGeometry(W, H, 1, 20, 28, 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const nx = pos.getX(i) / (W / 2), ny = pos.getY(i) / (H / 2);
    const puff = Math.sqrt(Math.max(0, 1 - nx * nx)) * (1 - Math.pow(Math.abs(ny), 6));
    pos.setZ(i, Math.sign(pos.getZ(i)) * T * puff + 0.001 * Math.sign(pos.getZ(i)));
  }
  geo.computeVertexNormals();
  geo.translate(0, H / 2 + 0.06, 0);
  const foil = clayMat(THREE, 0xffffff, { map: bagTexture(THREE), roughness: 0.4, metalness: 0.08, clearcoat: 0.5, clearcoatRoughness: 0.35 });
  const bag = new THREE.Mesh(geo, foil);
  // 위아래 접착부: 둥근 모서리의 노란 띠
  const sealGeo = ext && ext.RoundedBoxGeometry ? new ext.RoundedBoxGeometry(W + 0.04, 0.12, 0.07, 3, 0.03) : new THREE.BoxGeometry(W + 0.04, 0.12, 0.05);
  const sealMat = clayMat(THREE, CLAY.yellow, { roughness: 0.45, clearcoat: 0.3 });
  const sealTop = new THREE.Mesh(sealGeo, sealMat);
  sealTop.position.y = H + 0.06;
  const sealBottom = new THREE.Mesh(sealGeo, sealMat);
  sealBottom.position.y = 0.06;
  pouch.add(bag, sealTop, sealBottom);

  // 투명 봉투 (먼저 모아 둔 비닐 몇 장이 들어 있음) + 묶은 매듭
  const sack = new THREE.Group();
  function sackPoints(pts) {
    return new THREE.SplineCurve(pts.map(function (p) { return new THREE.Vector2(p[0], p[1]); })).getPoints(40);
  }
  const sackGeo = new THREE.LatheGeometry(sackPoints(OPEN), 64);
  const openPos = sackGeo.attributes.position.array.slice();
  const closedPos = new THREE.LatheGeometry(sackPoints(CLOSED), 64).attributes.position.array;
  const sackMat = { color: 0xf3faf6, roughness: 0.15, transparent: true, depthWrite: false, clearcoat: 1 };
  const sackBack = new THREE.Mesh(sackGeo, new THREE.MeshPhysicalMaterial(Object.assign({ side: THREE.BackSide, opacity: 0.22 }, sackMat)));
  const sackFront = new THREE.Mesh(sackGeo, new THREE.MeshPhysicalMaterial(Object.assign({ side: THREE.FrontSide, opacity: 0.3 }, sackMat)));
  sackBack.renderOrder = 2;
  sackFront.renderOrder = 4;
  sack.add(sackBack, sackFront);
  // 바닥에 깔린 비닐 뭉치: 말랑한 파스텔 덩어리
  const rand = seeded(7);
  [CLAY.mint, CLAY.coral, CLAY.cream, CLAY.blue].forEach(function (c, i) {
    const piece = new THREE.Mesh(new THREE.IcosahedronGeometry(0.34, 3), clayMat(THREE, c, { clearcoat: 0.35 }));
    const a = (i / 4) * TAU + 0.4;
    piece.position.set(Math.cos(a) * 0.5, 0.17 + rand() * 0.05, Math.sin(a) * 0.5);
    piece.scale.set(1, 0.42, 0.8);
    piece.rotation.set(rand() * 0.4, rand() * 3, rand() * 0.4);
    piece.renderOrder = 3;
    sack.add(piece);
  });
  const knot = new THREE.Group();
  const knotMat = sackFront.material;
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 10), knotMat);
  knot.add(ball);
  [-1, 1].forEach(function (sd) {
    const ear = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.26, 4, 12), knotMat);
    ear.position.set(sd * 0.18, 0.16, 0);
    ear.rotation.z = -sd * 0.7;
    knot.add(ear);
  });
  knot.position.y = 2.12;
  knot.renderOrder = 4;
  sack.add(knot);
  sack.position.y = GROUND;
  sack.visible = false;
  scene.add(sack);
  // 투명 봉투는 그림자를 드리우지 않으므로 바닥의 흐린 그림자를 씀
  const sackShadow = addShadow(THREE, scene, 2.8);

  const faucet = createFaucet(THREE, scene, 0.05, GROUND + H + 1.0);
  const crumbs = createDrops(THREE, scene, clayMat(THREE, 0xf0c46a, { roughness: 0.8 }), 50, 0.06);
  const mouth = new THREE.Vector3();

  // 봉투 입구 오므리기 (c 0 = 열림, 1 = 묶임)
  let cinched = -1;
  function cinch(c) {
    if (c === cinched) return;
    cinched = c;
    const p = sackGeo.attributes.position.array;
    for (let i = 0; i < p.length; i++) p[i] = lerp(openPos[i], closedPos[i], c);
    sackGeo.attributes.position.needsUpdate = true;
    sackGeo.computeVertexNormals();
  }

  function update(v, dt) {
    // 털기·헹군 물 쏟기: 살짝 젖혔다(준비) 거꾸로 들어 머무는 동안 탈탈 흔들고 → 살짝 지나쳐 세움
    const pour = v.$key === "empty" ? v.$p : 0;
    const r = v.$key === "rinse" ? v.$p : 0;
    const rq = clamp01((r - 0.55) / 0.45);
    const tp = pour > 0 ? tiltCurve(pour) : rq > 0 ? tiltCurve(rq) : 0;
    const hold = smooth(0.3, 0.4, pour) * (1 - smooth(0.66, 0.74, pour));
    const shake = Math.sin(pour * 60) * 0.12 * hold;
    tilt.rotation.z = tp * 2.6 + shake;
    tilt.position.x = tp * -0.3;
    faucet.update(smooth(0, 0.12, r) * (1 - smooth(0.45, 0.55, r)), r > 0.12 && r < 0.42, dt);
    if (pour > 0.36 && pour < 0.72) faucet.pour(pouch, mouth.set(0, H + 0.1, 0), tilt, crumbs, dt);
    if (rq > 0.36 && rq < 0.72) faucet.pour(pouch, mouth.set(0, H + 0.1, 0), tilt, faucet.drops, dt);
    crumbs.update(dt);

    // 봉지가 움츠렸다(준비) 뛰어오르며 구겨지고 → 그 아래로 투명 봉투가 통통 튀며 나타남 → 열린 입구로 쏙 들어감
    // → 봉투가 출렁이고 입구가 오므라들며 매듭이 톡 생김
    const bp = v.bag;
    sack.visible = bp > 0.22;
    const pop = Math.max(backOut(clamp01((bp - 0.22) / 0.2)), 0.001);
    sack.scale.setScalar(pop);
    const crouch = bp > 0 && bp < 0.12 ? Math.sin(Math.PI * bp / 0.12) : 0;
    const jump = clamp01((bp - 0.1) / 0.55);
    const LIFT = 2.15, END = 0.28;
    const y = jump <= 0 ? 0 : jump < 0.45 ? easeInOut(jump / 0.45) * LIFT : lerp(LIFT, END, Math.pow((jump - 0.45) / 0.55, 2));
    root.position.y = y;
    root.rotation.z = Math.sin(Math.PI * jump) * 0.18;
    const crumple = lerp(1, 0.55, smooth(0.05, 0.4, jump));
    const sy = 1 - crouch * 0.12;
    pouch.scale.set(crumple / Math.sqrt(sy), crumple * sy, crumple / Math.sqrt(sy));
    pouch.rotation.y = smooth(0.05, 0.6, jump) * 0.6;
    const land = clamp01((bp - 0.65) / 0.3);
    sack.rotation.z = wobble(land, 2) * 0.06;
    sack.scale.y *= 1 - wobble(land, 2) * 0.05;
    cinch(easeInOut(clamp01((bp - 0.7) / 0.15)));
    const k = backOut(clamp01((bp - 0.82) / 0.16));
    knot.visible = k > 0.001;
    knot.scale.setScalar(Math.max(k, 0.001));

    sackShadow.visible = bp > 0.22;
    sackShadow.scale.set(pop, pop, pop);
    sackShadow.material.opacity = 0.7;

    // 효과음 (체험 창에서 효과음을 켰을 때만): 진행률이 그 순간을 지날 때 한 번
    if (hit(v, "empty", 0.32)) sfx.play("rustle", 0.96); // 거꾸로 들고 탈탈 터는 바스락
    if (hit(v, "rinse", 0.12)) sfx.play("water", 1.08);  // 수도꼭지 물줄기
    if (hit(v, "rinse", 0.71)) sfx.play("pour", 0.58);   // 헹군 물 쏟기
    if (hit(v, "bag", 0.13)) sfx.play("rustle", 0.5);    // 뛰어오르며 구겨지는 바스락
    if (hit(v, "bag", 0.62)) sfx.play("slide");          // 투명 봉투에 쏙
    if (hit(v, "bag", 0.72)) sfx.play("tie");            // 입구 묶기 슥슥
    if (hit(v, "bag", 0.95)) sfx.play("chime");          // 끝 띵동
  }

  return { update: update, reset: function () { crumbs.clear(); faucet.clear(); } };
}

// 과자 봉지 무늬: 파스텔 산호색 바탕에 크림 접시와 과자 그림 (상표 없음)
function bagTexture(THREE) {
  return canvasTexture(THREE, 512, 512, function (g, w, h) {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "#f8bfa4");
    grad.addColorStop(1, "#f29a86");
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#fff6e6";
    g.beginPath();
    g.ellipse(w / 2, h * 0.42, w * 0.3, h * 0.17, -0.2, 0, TAU);
    g.fill();
    g.fillStyle = "#f7d36e";
    [[0.4, 0.42], [0.55, 0.38], [0.5, 0.5], [0.62, 0.47]].forEach(function (c) {
      g.beginPath();
      g.ellipse(w * c[0], h * c[1], 36, 24, c[0] * 4, 0, TAU);
      g.fill();
    });
    // 작은 잎 (사이트 테마 초록)
    g.fillStyle = "#6cc596";
    g.save();
    g.translate(w * 0.78, h * 0.2);
    g.rotate(-0.6);
    g.beginPath();
    g.ellipse(0, 0, 30, 14, 0, 0, TAU);
    g.fill();
    g.restore();
    g.fillStyle = "#fff6e6";
    g.beginPath();
    g.roundRect(w * 0.2, h * 0.72, w * 0.6, 18, 9);
    g.roundRect(w * 0.3, h * 0.79, w * 0.4, 14, 7);
    g.fill();
  });
}
