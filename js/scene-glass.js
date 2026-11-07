// 유리병 장면
// 서대문구청 재활용품 분리배출 안내(병류): 라벨·병뚜껑을 제거하고 내용물을 비운 뒤 배출, 담배꽁초 등 이물질 넣지 않기
// (깨진 유리·거울·도자기·화분·강화유리는 재활용 불가)
import { GROUND, TAU, clamp01, smooth, easeInOut, backOut, lerp, densePoints, canvasTexture, addShadow, stickerTexture, createDrops, createFaucet, binGroup, pourPhase, dropHeight } from "./eco3d-util.js?v=20261107s";

const PROFILE = [[0, 0], [0.4, 0], [0.46, 0.04], [0.48, 0.15], [0.48, 1.6], [0.44, 1.85], [0.3, 2.1], [0.17, 2.35], [0.15, 2.6], [0.165, 2.66], [0.15, 2.72]];
const TOP = 2.72;
const PIV = GROUND + 1.3;

export default {
  // cap 1 = 뚜껑을 뗌, empty 1 = 내용물을 비움, label 1 = 라벨을 뗌, bin 1 = 유리병 수거함에 넣음
  states: [
    { cap: 0, empty: 0, label: 0, bin: 0 },
    { cap: 1, empty: 0, label: 0, bin: 0 },
    { cap: 1, empty: 1, label: 0, bin: 0 },
    { cap: 1, empty: 1, label: 1, bin: 0 },
    { cap: 1, empty: 1, label: 1, bin: 1 }
  ],
  moves: [null, [["cap", 1.2]], [["empty", 2.2]], [["label", 1.4]], [["bin", 1.8]]],
  spin: 0.4,
  camera: [0.5, 0.0],
  build: build
};

function build(THREE, scene, spin) {
  const root = new THREE.Group();
  const tilt = new THREE.Group();
  tilt.position.y = PIV;
  const bottle = new THREE.Group();
  bottle.position.y = GROUND - PIV;
  root.add(tilt);
  tilt.add(spin);
  spin.add(bottle);
  scene.add(root);

  // 초록 유리 (안쪽 면 → 바깥 면 순서로 그려 얼룩지지 않게)
  const geo = new THREE.LatheGeometry(densePoints(THREE, PROFILE, 4), 56);
  const glassMat = { color: 0x2f9a5c, roughness: 0.05, transparent: true, depthWrite: false, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.4 };
  const back = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial(Object.assign({ side: THREE.BackSide, opacity: 0.4 }, glassMat)));
  const front = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial(Object.assign({ side: THREE.FrontSide, opacity: 0.55 }, glassMat)));
  back.renderOrder = 2;
  front.renderOrder = 3;
  bottle.add(back, front);

  // 내용물 (윗면 기준으로 줄어듦)
  const LT = 1.55;
  const liquidGeo = new THREE.LatheGeometry(densePoints(THREE, [[0, 0.05], [0.44, 0.05], [0.455, 0.15], [0.455, LT], [0, LT]], 2), 40);
  liquidGeo.translate(0, -LT, 0);
  const liquidMat = new THREE.MeshStandardMaterial({ color: 0xd9c36a, roughness: 0.2, transparent: true, opacity: 0.8 });
  const liquid = new THREE.Mesh(liquidGeo, liquidMat);
  liquid.position.y = LT;
  liquid.renderOrder = 1;
  bottle.add(liquid);

  // 종이 라벨
  const labelMat = new THREE.MeshStandardMaterial({ map: labelTexture(THREE), roughness: 0.6, transparent: true, side: THREE.DoubleSide });
  const label = new THREE.Mesh(new THREE.CylinderGeometry(0.49, 0.49, 0.7, 56, 1, true), labelMat);
  bottle.add(label);

  // 금속 병뚜껑 (톱니 테두리)
  const cap = new THREE.Group();
  const capMat = new THREE.MeshStandardMaterial({ color: 0xc9a227, metalness: 0.8, roughness: 0.3 });
  cap.add(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.19, 0.12, 21), capMat));
  root.add(cap);

  const shadow = addShadow(THREE, scene, 2.2);

  const bin = binGroup(THREE, 1.05, 0.88, 1.5, 0x3a9a5b, 0x24733f, glassSticker(THREE));
  bin.position.y = GROUND;
  scene.add(bin);

  const faucet = createFaucet(THREE, scene, 0, 10); // 비우기 방울만 씀 (수도꼭지는 안 보임)
  const drops = createDrops(THREE, scene, liquidMat, 60, 0.05);
  const mouth = new THREE.Vector3();

  function update(v, dt) {
    const ph = pourPhase(v);
    tilt.rotation.z = ph.tilt * 2.3;
    tilt.position.x = ph.tilt * -0.4;
    const level = v.$key === "empty" ? 1 - smooth(0.32, 0.78, v.$p) : 1 - v.empty;
    liquid.visible = level > 0.005;
    liquid.scale.y = Math.max(level, 0.001);
    if (ph.pouring) faucet.pour(bottle, mouth.set(0, TOP, 0), tilt, drops, dt);
    drops.update(dt);

    // 뚜껑: 병따개로 딴 듯 튀어 올라 옆 바닥에 떨어짐
    const cp = easeInOut(v.cap);
    const onY = GROUND + TOP + 0.03;
    cap.position.set(lerp(0, 1.25, cp), lerp(onY, GROUND + 0.06, cp) + Math.sin(Math.PI * cp) * 1.0, lerp(0, 0.55, cp));
    cap.rotation.set(cp < 1 ? cp * 5 : 0, 0, cp < 1 ? cp * 3 : 0);

    // 라벨: 벗겨져 옆으로 떨어지며 사라짐
    const lp = easeInOut(v.label);
    label.visible = lp < 0.99;
    label.position.set(lp * 1.7, 0.95 + Math.sin(Math.PI * lp) * 0.6 - smooth(0.6, 1, lp) * 1.0, 0);
    label.rotation.set(0, lp * 5, -lp * 0.9);
    labelMat.opacity = 1 - smooth(0.65, 1, lp);

    const bp = v.bin;
    bin.visible = bp > 0;
    bin.scale.setScalar(Math.max(backOut(clamp01(bp / 0.35)), 0.001));
    const y = dropHeight(bp, 1.8, 0.1);
    root.position.y = y;
    cap.visible = bp < 0.3; // 수거함으로 갈 때 바닥의 뚜껑은 치움(따로 버림)

    shadow.position.x = tilt.position.x;
    const s = 1 / (1 + y * 0.5);
    shadow.scale.set(s, s, s);
    shadow.material.opacity = bp >= 0.55 && y < 0.2 ? 0 : s;
  }

  return { update: update, reset: function () { drops.clear(); faucet.clear(); } };
}

function labelTexture(THREE) {
  return canvasTexture(THREE, 1024, 256, function (g, w, h) {
    g.fillStyle = "#f6f1df";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#2c6e9e";
    g.fillRect(0, 0, w, 40);
    g.fillRect(0, h - 40, w, 40);
    g.fillStyle = "#d9a441";
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.arc(w * (i / 3 + 1 / 6), h / 2, 46, 0, TAU);
      g.fill();
    }
  });
}

function glassSticker(THREE) {
  return stickerTexture(THREE, 512, 312, "#24733f", function (g, w, h) {
    // 병 아이콘 두 개
    [[110, 1], [210, 0.85]].forEach(function (b) {
      const x = b[0], s = b[1];
      g.beginPath();
      g.roundRect(x - 34 * s, 270 - 150 * s, 68 * s, 150 * s, 14 * s);
      g.moveTo(x - 20 * s, 272 - 150 * s);
      g.lineTo(x - 12 * s, 270 - 210 * s);
      g.lineTo(x + 12 * s, 270 - 210 * s);
      g.lineTo(x + 20 * s, 272 - 150 * s);
      g.fill();
    });
    g.font = "900 76px system-ui, sans-serif";
    g.textBaseline = "middle";
    g.fillText("GLASS", 262, h / 2 + 8);
  });
}
