// 비닐 장면
// 서울시·서대문구 폐비닐 안내: 내용물 비우기 → 음식물이 묻었다면 헹구기 → 따로 모아 배출
// (재활용품 분리배출 안내: 비닐류는 투명 비닐봉투에 담아 배출 / 씻어도 오염이 남은 비닐은 종량제 봉투)
import { GROUND, TAU, clamp01, smooth, easeInOut, backOut, lerp, canvasTexture, addShadow, createDrops, createFaucet, pourPhase, dropHeight, seeded } from "./eco3d-util.js?v=20261107s";

const W = 1.3, H = 1.8, T = 0.22; // 과자 봉지 폭·높이·불룩한 두께
const PIV = GROUND + 1.0;

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
  build: build
};

function build(THREE, scene, spin) {
  const root = new THREE.Group();
  const tilt = new THREE.Group();
  tilt.position.y = PIV;
  const pouch = new THREE.Group();
  pouch.position.y = GROUND - PIV;
  root.add(tilt);
  tilt.add(spin);
  spin.add(pouch);
  scene.add(root);

  // 베개 모양으로 부푼 과자 봉지 (가장자리는 얇게 붙어 있음)
  const geo = new THREE.BoxGeometry(W, H, 1, 20, 28, 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const nx = pos.getX(i) / (W / 2), ny = pos.getY(i) / (H / 2);
    const puff = Math.sqrt(Math.max(0, 1 - nx * nx)) * (1 - Math.pow(Math.abs(ny), 6));
    pos.setZ(i, Math.sign(pos.getZ(i)) * T * puff + 0.001 * Math.sign(pos.getZ(i)));
  }
  geo.computeVertexNormals();
  geo.translate(0, H / 2 + 0.06, 0);
  const foil = new THREE.MeshStandardMaterial({ map: bagTexture(THREE), metalness: 0.35, roughness: 0.3 });
  const bag = new THREE.Mesh(geo, foil);
  const sealMat = new THREE.MeshStandardMaterial({ color: 0xf2c94c, metalness: 0.4, roughness: 0.35 });
  const sealTop = new THREE.Mesh(new THREE.BoxGeometry(W + 0.04, 0.12, 0.03), sealMat);
  sealTop.position.y = H + 0.06;
  const sealBottom = sealTop.clone();
  sealBottom.position.y = 0.06;
  pouch.add(bag, sealTop, sealBottom);

  const shadow = addShadow(THREE, scene, 2.6);

  // 투명 봉투 (먼저 모아 둔 비닐 몇 장이 들어 있음) + 묶은 매듭
  const sack = new THREE.Group();
  // 봉투 옆모습을 곡선으로 이어 둥글게
  const sackCurve = new THREE.SplineCurve([[0, 0], [0.85, 0.03], [1.05, 0.4], [1.08, 1.2], [0.85, 1.75], [0.32, 2.0], [0.2, 2.06]].map(function (p) { return new THREE.Vector2(p[0], p[1]); }));
  const sackGeo = new THREE.LatheGeometry(sackCurve.getPoints(40), 64);
  const sackMat = { color: 0xf3f8fb, roughness: 0.15, transparent: true, depthWrite: false, clearcoat: 1 };
  const sackBack = new THREE.Mesh(sackGeo, new THREE.MeshPhysicalMaterial(Object.assign({ side: THREE.BackSide, opacity: 0.22 }, sackMat)));
  const sackFront = new THREE.Mesh(sackGeo, new THREE.MeshPhysicalMaterial(Object.assign({ side: THREE.FrontSide, opacity: 0.32 }, sackMat)));
  sackBack.renderOrder = 2;
  sackFront.renderOrder = 4;
  sack.add(sackBack, sackFront);
  const rand = seeded(7);
  [0x7fc6a4, 0xf29bb2, 0xffffff, 0x9cc3ec].forEach(function (c, i) {
    const piece = new THREE.Mesh(new THREE.IcosahedronGeometry(0.34, 1), new THREE.MeshStandardMaterial({ color: c, roughness: 0.35, metalness: 0.2, flatShading: true }));
    const a = (i / 4) * TAU + 0.4;
    piece.position.set(Math.cos(a) * 0.5, 0.25 + rand() * 0.2, Math.sin(a) * 0.5);
    piece.scale.set(1, 0.45, 0.8);
    piece.rotation.set(rand() * 3, rand() * 3, rand() * 3);
    piece.renderOrder = 3;
    sack.add(piece);
  });
  const knot = new THREE.Group();
  const knotMat = sackFront.material;
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 10), knotMat);
  knot.add(ball);
  [-1, 1].forEach(function (sd) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.42, 12), knotMat);
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

  const faucet = createFaucet(THREE, scene, 0.05, GROUND + H + 1.0);
  const crumbs = createDrops(THREE, scene, new THREE.MeshStandardMaterial({ color: 0xe8b04a, roughness: 0.8 }), 50, 0.06);
  const mouth = new THREE.Vector3();

  function update(v, dt) {
    const ph = pourPhase(v);
    // 털어 낼 때는 거꾸로 든 채 살짝 흔듦
    const shake = v.$key === "empty" ? Math.sin(v.$p * 60) * 0.12 * Math.sin(Math.PI * v.$p) : 0;
    tilt.rotation.z = ph.tilt * 2.6 + shake;
    tilt.position.x = ph.tilt * -0.3;
    faucet.update(ph.faucet, ph.flowing, dt);
    if (ph.pouring) faucet.pour(pouch, mouth.set(0, H + 0.1, 0), tilt, crumbs, dt);
    if (ph.rinsing) faucet.pour(pouch, mouth.set(0, H + 0.1, 0), tilt, faucet.drops, dt);
    crumbs.update(dt);

    // 투명 봉투가 나타나고 → 봉지를 구겨서 넣고 → 입구를 묶음
    const bp = v.bag;
    sack.visible = bp > 0;
    sack.scale.setScalar(Math.max(backOut(clamp01(bp / 0.3)), 0.001));
    const q = clamp01(bp / 0.8);
    const y = dropHeight(q, 2.1, 0.15);
    root.position.y = y;
    pouch.scale.setScalar(lerp(1, 0.55, smooth(0.2, 0.7, q)));
    const k = backOut(clamp01((bp - 0.8) / 0.2));
    knot.visible = k > 0.001;
    knot.scale.setScalar(Math.max(k, 0.001));

    shadow.position.x = tilt.position.x;
    const s = 1 / (1 + y * 0.5);
    shadow.scale.set(s, s, s);
    shadow.material.opacity = bp > 0.3 ? 0 : s;
  }

  return { update: update, reset: function () { crumbs.clear(); faucet.clear(); } };
}

// 과자 봉지 무늬: 주황 바탕에 과자 그림 (상표 없음)
function bagTexture(THREE) {
  return canvasTexture(THREE, 512, 512, function (g, w, h) {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "#ff8a3d");
    grad.addColorStop(1, "#e2502e");
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#fff3c4";
    g.beginPath();
    g.ellipse(w / 2, h * 0.42, w * 0.3, h * 0.17, -0.2, 0, TAU);
    g.fill();
    g.fillStyle = "#f2b33d";
    [[0.4, 0.42], [0.55, 0.38], [0.5, 0.5], [0.62, 0.47]].forEach(function (c) {
      g.beginPath();
      g.ellipse(w * c[0], h * c[1], 36, 24, c[0] * 4, 0, TAU);
      g.fill();
    });
    g.fillStyle = "#ffffff";
    g.fillRect(w * 0.2, h * 0.72, w * 0.6, 18);
    g.fillRect(w * 0.3, h * 0.78, w * 0.4, 14);
  });
}
