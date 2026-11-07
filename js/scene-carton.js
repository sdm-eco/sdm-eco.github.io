// 종이팩 장면
// 종이팩 따로 배출 안내(기후에너지환경부 등): 비우고 → 헹구고 → 납작하게 → 종이팩끼리 따로 배출
import { GROUND, clamp01, easeInOut, backOut, lerp, canvasTexture, addShadow, stickerTexture, createDrops, createFaucet, binGroup, pourPhase, dropHeight } from "./eco3d-util.js?v=20261107s";

const W = 1.0, HB = 1.6, D = 1.0, ROOF = 0.45; // 몸통 폭·높이·깊이, 지붕 높이
const PIV = GROUND + 1.0;

export default {
  // empty 1 = 우유를 비움, rinse 1 = 물로 헹굼, flat 1 = 펼쳐 납작하게, bin 1 = 종이팩 수거함에 넣음
  states: [
    { empty: 0, rinse: 0, flat: 0, bin: 0 },
    { empty: 1, rinse: 0, flat: 0, bin: 0 },
    { empty: 1, rinse: 1, flat: 0, bin: 0 },
    { empty: 1, rinse: 1, flat: 1, bin: 0 },
    { empty: 1, rinse: 1, flat: 1, bin: 1 }
  ],
  moves: [null, [["empty", 2.2]], [["rinse", 3.6]], [["flat", 1.8]], [["bin", 1.8]]],
  spin: 0.6,
  camera: [0.3, -0.3],
  build: build
};

function build(THREE, scene, spin) {
  const root = new THREE.Group();
  const tilt = new THREE.Group();
  tilt.position.y = PIV;
  const pack = new THREE.Group();
  pack.position.y = GROUND - PIV;
  // 비스듬히 세워 옆면(두께)이 보이게: 납작해지는 모습이 정면에서도 보임
  pack.rotation.y = 0.75;
  root.add(tilt);
  tilt.add(spin);
  spin.add(pack);
  scene.add(root);

  // 몸통 (네 옆면에 그림, 위아래는 흰색)
  const side = new THREE.MeshStandardMaterial({ map: packTexture(THREE), roughness: 0.55 });
  const white = new THREE.MeshStandardMaterial({ color: 0xf4f6f8, roughness: 0.6, side: THREE.DoubleSide });
  const body = new THREE.Mesh(new THREE.BoxGeometry(W, HB, D), [side, side, white, white, side, side]);
  body.position.y = HB / 2;

  // 박공지붕(앞뒤로 기운 두 면)과 맨 위 접합부
  const tri = new THREE.Shape([new THREE.Vector2(-W / 2, 0), new THREE.Vector2(W / 2, 0), new THREE.Vector2(0, ROOF)]);
  const roofGeo = new THREE.ExtrudeGeometry(tri, { depth: D, bevelEnabled: false });
  roofGeo.translate(0, 0, -D / 2);
  const roof = new THREE.Mesh(roofGeo, new THREE.MeshStandardMaterial({ color: 0x3f8fd6, roughness: 0.55 }));
  roof.position.y = HB;
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.2, D), white);
  fin.position.y = HB + ROOF + 0.08;
  pack.add(body, roof, fin);

  const shadow = addShadow(THREE, scene, 2.4);

  // 종이팩 수거함
  const bin = binGroup(THREE, 1.05, 0.88, 1.5, 0x2f7fc4, 0x1d5a92, packSticker(THREE));
  bin.position.y = GROUND;
  scene.add(bin);

  const faucet = createFaucet(THREE, scene, 0.05, GROUND + HB + ROOF + 1.0);
  const milk = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, transparent: true, opacity: 0.95 });
  const drops = createDrops(THREE, scene, milk, 60, 0.05);
  const mouth = new THREE.Vector3();

  function update(v, dt) {
    // 펼쳐서 납작하게: 앞뒤로 눌려 얇아지고 옆으로 조금 퍼지며 지붕이 펴짐
    const f = easeInOut(v.flat);
    pack.scale.set(lerp(1, 1.3, f), 1, lerp(1, 0.1, f));
    roof.scale.y = lerp(1, 0.12, f);
    fin.position.y = HB + lerp(ROOF, ROOF * 0.12, f) + 0.08;

    const ph = pourPhase(v);
    tilt.rotation.z = ph.tilt * 2.3;
    tilt.position.x = ph.tilt * -0.4;
    faucet.update(ph.faucet, ph.flowing, dt);
    if (ph.pouring) faucet.pour(pack, mouth.set(0, HB + ROOF, 0.35), tilt, drops, dt);
    if (ph.rinsing) faucet.pour(pack, mouth.set(0, HB + ROOF, 0.35), tilt, faucet.drops, dt);
    drops.update(dt);

    const bp = v.bin;
    bin.visible = bp > 0;
    bin.scale.setScalar(Math.max(backOut(clamp01(bp / 0.35)), 0.001));
    const y = dropHeight(bp, 2.0, 0.12);
    root.position.y = y;

    shadow.position.x = tilt.position.x;
    const s = 1 / (1 + y * 0.5);
    shadow.scale.set(s * lerp(1, 1.2, f), s, s);
    shadow.material.opacity = bp >= 0.55 && y < 0.2 ? 0 : s;
  }

  return { update: update, reset: function () { drops.clear(); faucet.clear(); } };
}

// 종이팩 옆면: 흰 바탕에 파란 띠와 우유 잔 (상표 없음)
function packTexture(THREE) {
  return canvasTexture(THREE, 512, 820, function (g, w, h) {
    g.fillStyle = "#f7f9fb";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#3f8fd6";
    g.fillRect(0, 0, w, h * 0.16);
    g.beginPath();
    g.moveTo(0, h * 0.72);
    g.bezierCurveTo(w * 0.3, h * 0.66, w * 0.6, h * 0.8, w, h * 0.7);
    g.lineTo(w, h);
    g.lineTo(0, h);
    g.fill();
    // 우유 잔
    g.fillStyle = "#cfe5f7";
    g.beginPath();
    g.moveTo(w * 0.36, h * 0.3);
    g.lineTo(w * 0.64, h * 0.3);
    g.lineTo(w * 0.6, h * 0.58);
    g.lineTo(w * 0.4, h * 0.58);
    g.fill();
    g.fillStyle = "#ffffff";
    g.fillRect(w * 0.375, h * 0.36, w * 0.25, h * 0.2);
  });
}

function packSticker(THREE) {
  return stickerTexture(THREE, 512, 312, "#1d5a92", function (g, w, h) {
    // 종이팩 아이콘 두 개 (펼친 것·세운 것)
    g.beginPath();
    g.moveTo(120, 250);
    g.lineTo(120, 120);
    g.lineTo(165, 70);
    g.lineTo(210, 120);
    g.lineTo(210, 250);
    g.fill();
    g.fillRect(260, 190, 180, 60);
    g.fillStyle = "#ffffff";
    g.fillRect(120, 150, 90, 24);
    g.fillRect(260, 208, 180, 14);
  });
}
