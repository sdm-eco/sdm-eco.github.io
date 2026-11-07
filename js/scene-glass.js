// 유리병 장면 (클레이 스타일)
// 서대문구청 재활용품 분리배출 안내(병류): 라벨·병뚜껑을 제거하고 내용물을 비운 뒤 배출, 담배꽁초 등 이물질 넣지 않기
// (깨진 유리·거울·도자기·화분·강화유리는 재활용 불가)
import { GROUND, TAU, clamp01, smooth, easeInOut, backOut, lerp, densePoints, canvasTexture, addShadow, stickerTexture, createDrops, createFaucet, CLAY, clayMat, clayBin, tiltCurve, bounceDrop, wobble } from "./eco3d-util.js?v=20261108g";

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
  clay: true, // 클레이 스타일 조명·그림자 (eco3d.js)
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

  // 부드러운 연초록 유리 (안쪽 면 → 바깥 면 순서로 그려 얼룩지지 않게)
  const geo = new THREE.LatheGeometry(densePoints(THREE, PROFILE, 4), 56);
  const glassMat = { color: 0x8fd4a8, roughness: 0.1, transparent: true, depthWrite: false, clearcoat: 1, clearcoatRoughness: 0.1, envMapIntensity: 1.2 };
  const back = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial(Object.assign({ side: THREE.BackSide, opacity: 0.32 }, glassMat)));
  const front = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial(Object.assign({ side: THREE.FrontSide, opacity: 0.46 }, glassMat)));
  back.renderOrder = 2;
  front.renderOrder = 3;
  bottle.add(back, front);

  // 내용물: 연한 호박색 (윗면 기준으로 줄어듦)
  const LT = 1.55;
  const liquidGeo = new THREE.LatheGeometry(densePoints(THREE, [[0, 0.05], [0.44, 0.05], [0.455, 0.15], [0.455, LT], [0, LT]], 2), 40);
  liquidGeo.translate(0, -LT, 0);
  const liquidMat = new THREE.MeshPhysicalMaterial({ color: 0xf2c86e, roughness: 0.15, transparent: true, opacity: 0.85, clearcoat: 0.5 });
  const liquid = new THREE.Mesh(liquidGeo, liquidMat);
  liquid.position.y = LT;
  liquid.renderOrder = 1;
  bottle.add(liquid);

  // 종이 라벨: 크림 바탕 점토 느낌
  const labelMat = clayMat(THREE, 0xffffff, { map: labelTexture(THREE), transparent: true, side: THREE.DoubleSide, sheen: 0.2 });
  const label = new THREE.Mesh(new THREE.CylinderGeometry(0.495, 0.495, 0.7, 56, 1, true), labelMat);
  bottle.add(label);

  // 병뚜껑: 납작한 윗면 + 두툼하게 말린 테두리 (파스텔 노랑, 은은한 금속광)
  const cap = new THREE.Group();
  const capMat = clayMat(THREE, CLAY.yellow, { metalness: 0.2, roughness: 0.4, clearcoat: 0.4 });
  const capTop = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.18, 0.1, 32), capMat);
  capTop.position.y = 0.01;
  const capRim = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.035, 10, 32), capMat);
  capRim.rotation.x = Math.PI / 2;
  capRim.position.y = -0.03;
  cap.add(capTop, capRim);
  root.add(cap);
  // 병에 꽂혀 있을 때는 그림자가 떠 보이므로 빼고, 바닥에 떨어진 뒤에만 그림자를 드리움
  cap.traverse(function (o) { o.userData.noShadow = true; });

  // 투명한 병은 그림자를 드리우지 않으므로 바닥의 흐린 그림자를 함께 씀
  const shadow = addShadow(THREE, scene, 2.2);

  // 유리병 수거함: 파스텔 초록 + 진한 테두리 (키 큰 병이 뛰어올라도 화면 위로 잘리지 않게 낮고 넓게)
  const bin = clayBin(THREE, 1.12, 0.94, 1.35, CLAY.green, CLAY.greenDeep, glassSticker(THREE));
  bin.position.y = GROUND;
  scene.add(bin);

  const faucet = createFaucet(THREE, scene, 0, 10); // 비우기 방울만 씀 (수도꼭지는 안 보임)
  const drops = createDrops(THREE, scene, liquidMat, 60, 0.05);
  const mouth = new THREE.Vector3();

  function update(v, dt) {
    // 비우기: 살짝 젖혔다(준비) 기울여 머무는 동안 쏟고 → 살짝 지나쳐 세움
    const pour = v.$key === "empty" ? v.$p : 0;
    const tp = pour > 0 ? tiltCurve(pour) : 0;
    tilt.rotation.z = tp * 2.3;
    tilt.position.x = tp * -0.4;
    const level = v.$key === "empty" ? 1 - smooth(0.36, 0.72, v.$p) : 1 - v.empty;
    liquid.visible = level > 0.005;
    liquid.scale.y = Math.max(level, 0.001);
    if (pour > 0.36 && pour < 0.72) faucet.pour(bottle, mouth.set(0, TOP, 0), tilt, drops, dt);
    drops.update(dt);

    // 뚜껑: 달그락 흔들리다(준비) 병따개로 딴 듯 톡 튀어 올라 → 한 바퀴 돌며 옆 바닥에 떨어져 통통 튀고 흔들리다 멈춤
    const cp = v.cap;
    const onY = GROUND + TOP + 0.03;
    const peakY = onY + 0.9;
    const restX = 1.25, restZ = 0.55, restY = GROUND + 0.065;
    const rattle = cp > 0 && cp < 0.2 ? Math.sin(cp * 90) * 0.12 * Math.sin(Math.PI * cp / 0.2) : 0;
    const q = clamp01((cp - 0.2) / 0.8);
    const arc = easeInOut(Math.min(q / 0.7, 1));
    let capY;
    if (q < 0.25) capY = lerp(onY, peakY, 1 - Math.pow(1 - q / 0.25, 2));
    else capY = restY + (peakY - restY) * bounceDrop((q - 0.25) / 0.75);
    cap.position.set(lerp(0, restX, arc), capY, lerp(0, restZ, arc));
    const land = clamp01((q - 0.7) / 0.3);
    cap.rotation.set(arc * TAU, 0, rattle + (cp < 1 ? wobble(land, 3) * 0.25 : 0));
    const capShadow = q > 0.4;
    capTop.castShadow = capShadow;
    capRim.castShadow = capShadow;

    // 라벨: 병을 따라 돌며 풀려 나와 → 뚜껑 반대쪽으로 살랑 흔들리며 떨어지고 사라짐
    const lp = v.label;
    const lo = easeInOut(clamp01(lp / 0.45));
    const fall = easeInOut(clamp01((lp - 0.35) / 0.65));
    label.visible = lp < 0.99;
    label.position.set(-lo * 0.8 - fall * 0.8, 0.95 + lo * 0.4 - fall * 1.25 + Math.sin(fall * Math.PI * 2) * 0.1, lo * 0.3);
    label.rotation.set(fall * 0.5, -lo * 3.2 - fall * 1.2, lo * 0.5 + Math.sin(fall * Math.PI * 3) * 0.25);
    label.scale.setScalar(Math.max(1 - fall * 0.3, 0.001));
    labelMat.opacity = 1 - smooth(0.7, 1, lp);

    // 수거함: 통통 튀며 나타나고(바닥의 뚜껑은 쏙 작아져 치움) → 병이 움츠렸다(준비) 뛰어올라 쏙 들어감 → 수거함이 출렁
    const bp = v.bin;
    bin.visible = bp > 0;
    bin.scale.setScalar(Math.max(backOut(clamp01(bp / 0.3)), 0.001));
    const gone = smooth(0, 0.22, bp);
    cap.visible = gone < 1;
    const swell = 1 + Math.sin(Math.PI * Math.min(gone / 0.4, 1)) * 0.25; // 톡 부풀었다가
    cap.scale.setScalar(Math.max(swell * (1 - smooth(0.3, 1, gone)), 0.001)); // 쏙 작아짐
    const crouch = bp > 0.15 && bp < 0.3 ? Math.sin(Math.PI * (bp - 0.15) / 0.15) : 0;
    const jump = clamp01((bp - 0.28) / 0.5);
    const LIFT = 1.45;
    const y = jump <= 0 ? 0 : jump < 0.45 ? easeInOut(jump / 0.45) * LIFT : lerp(LIFT, 0.08, Math.pow((jump - 0.45) / 0.55, 2));
    root.position.y = y;
    root.rotation.z = Math.sin(Math.PI * jump) * 0.15;
    const binLand = clamp01((bp - 0.78) / 0.22);
    // 들어가면서 수거함 벽에 살짝 기대어 멈춤
    if (bp > 0) tilt.rotation.z = smooth(0.5, 1, jump) * 0.12 + wobble(binLand, 2) * 0.05;
    bin.rotation.z = wobble(binLand, 2) * 0.08;
    bin.scale.y *= 1 - wobble(binLand, 2) * 0.06;

    // 병뚜껑을 딸 때 살짝 움츠림 + 수거함으로 뛰기 전 움츠림 (부피는 그대로인 느낌으로 가로를 반대로)
    const sy = 1 - Math.abs(rattle) * 0.15 - crouch * 0.1;
    bottle.scale.set(1 / Math.sqrt(sy), sy, 1 / Math.sqrt(sy));

    shadow.position.x = tilt.position.x;
    const s = 1 / (1 + y * 0.5);
    shadow.scale.set(s, s, s);
    shadow.material.opacity = (bp >= 0.6 && y < 0.3 ? 0 : s) * 0.75;
  }

  return { update: update, reset: function () { drops.clear(); faucet.clear(); } };
}

// 라벨: 크림 바탕에 초록 띠와 노란 동그라미, 작은 잎 (상표 없음)
function labelTexture(THREE) {
  return canvasTexture(THREE, 1024, 256, function (g, w, h) {
    g.fillStyle = "#fff6e6";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#6cc596";
    g.fillRect(0, 0, w, 40);
    g.fillRect(0, h - 40, w, 40);
    g.fillStyle = "#f7d36e";
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.arc(w * (i / 3 + 1 / 6), h / 2, 46, 0, TAU);
      g.fill();
    }
    g.fillStyle = "#2f8f5b";
    for (let i = 0; i < 3; i++) {
      g.save();
      g.translate(w * (i / 3 + 1 / 6) + 24, h / 2 - 30);
      g.rotate(-0.7);
      g.beginPath();
      g.ellipse(0, 0, 20, 9, 0, 0, TAU);
      g.fill();
      g.restore();
    }
  });
}

function glassSticker(THREE) {
  return stickerTexture(THREE, 512, 312, "#2f8f5b", function (g, w, h) {
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
