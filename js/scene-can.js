// 캔 장면
// 서대문구청 안내(재활용품 분리배출·올바른 쓰레기 배출방법): 내용물을 비우고 이물질 제거 → 압착 →
// 캔류로 배출 (단독주택은 투명 비닐봉투에 담아 배출요일에)
import { GROUND, TAU, clamp01, smooth, easeInOut, backOut, lerp, canvasTexture, addShadow, stickerTexture, createDrops, createFaucet, binGroup, pourPhase, dropHeight } from "./eco3d-util.js?v=20261107p";

const R = 0.6, H = 1.9;   // 캔 반지름·높이
const SQUASH = 0.38;      // 찌그러졌을 때 높이 비율
const PIV = GROUND + 1.0; // 기울일 때 도는 중심 높이

export default {
  // empty 1 = 음료를 비움, rinse 1 = 물로 헹굼, crush 1 = 눌러 찌그러뜨림, bin 1 = 수거함에 넣음
  states: [
    { empty: 0, rinse: 0, crush: 0, bin: 0 },
    { empty: 1, rinse: 0, crush: 0, bin: 0 },
    { empty: 1, rinse: 1, crush: 0, bin: 0 },
    { empty: 1, rinse: 1, crush: 1, bin: 0 },
    { empty: 1, rinse: 1, crush: 1, bin: 1 }
  ],
  moves: [null, [["empty", 2.2]], [["rinse", 3.6]], [["crush", 2.2]], [["bin", 1.8]]],
  spin: 0.4,
  camera: [0.3, -0.35],
  build: build
};

function build(THREE, scene, spin) {
  // root(들어 올리기) → tilt(쏟을 때 기울이기) → spin(드래그 회전) → can(본체)
  const root = new THREE.Group();
  const tilt = new THREE.Group();
  tilt.position.y = PIV;
  const can = new THREE.Group();
  can.position.y = GROUND - PIV;
  root.add(tilt);
  tilt.add(spin);
  spin.add(can);
  scene.add(root);

  // 몸통 (잘게 나눈 원통: 찌그러뜨릴 때 주름이 생기도록)
  const bodyGeo = new THREE.CylinderGeometry(R, R, H, 64, 48, true);
  bodyGeo.translate(0, H / 2, 0);
  const orig = bodyGeo.attributes.position.array.slice();
  const body = new THREE.Mesh(bodyGeo, new THREE.MeshStandardMaterial({ map: canTexture(THREE), metalness: 0.55, roughness: 0.32, side: THREE.DoubleSide }));
  can.add(body);

  const silver = new THREE.MeshStandardMaterial({ color: 0xd5dade, metalness: 0.9, roughness: 0.22, side: THREE.DoubleSide });
  const lid = new THREE.Group();
  const lidShell = new THREE.Mesh(new THREE.LatheGeometry([[R, 0], [R * 0.93, 0.1], [R * 0.86, 0.07], [0, 0.06]].map(function (p) { return new THREE.Vector2(p[0], p[1]); }), 48), silver);
  const tab = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.03, 0.16), silver);
  tab.position.set(0.12, 0.09, 0);
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.11, 20), new THREE.MeshBasicMaterial({ color: 0x1d2427 }));
  hole.rotation.x = -Math.PI / 2;
  hole.scale.set(1.4, 1, 1);
  hole.position.set(0.3, 0.075, 0);
  lid.add(lidShell, tab, hole);
  can.add(lid);
  const base = new THREE.Mesh(new THREE.LatheGeometry([[0, 0.1], [R * 0.82, 0.02], [R, 0.08]].map(function (p) { return new THREE.Vector2(p[0], p[1]); }), 48), silver);
  can.add(base);

  const shadow = addShadow(THREE, scene, 2.4);

  // 누르는 판
  const plate = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.14, 1.7), new THREE.MeshStandardMaterial({ color: 0xc8955c, roughness: 0.7, emissive: 0x6b4a26, emissiveIntensity: 0.45 }));
  plate.visible = false;
  scene.add(plate);

  // 캔류 수거함
  const bin = binGroup(THREE, 1.05, 0.88, 1.5, 0xe0a526, 0xb57f12, canSticker(THREE));
  bin.position.y = GROUND;
  scene.add(bin);

  const faucet = createFaucet(THREE, scene, 0.05, GROUND + H + 0.95);
  const cola = new THREE.MeshStandardMaterial({ color: 0x6b3a1e, roughness: 0.2, transparent: true, opacity: 0.85 });
  const drops = createDrops(THREE, scene, cola, 60, 0.05);
  const mouth = new THREE.Vector3();

  let shown = -1;
  function deform(d) {
    if (d === shown) return;
    shown = d;
    const pos = bodyGeo.attributes.position.array;
    for (let i = 0; i < pos.length; i += 3) {
      const x = orig[i], y = orig[i + 1], z = orig[i + 2];
      const a = Math.atan2(z, x), t = y / H;
      const mask = Math.sin(Math.PI * t);
      // 가운데가 불룩해지고 가로 주름·눌린 자국이 생김
      const r = 1 + d * mask * (0.16 + 0.07 * Math.sin(y * 13 + Math.sin(a * 3) * 1.5));
      pos[i] = x * r;
      pos[i + 1] = y * lerp(1, SQUASH, d);
      pos[i + 2] = z * r;
    }
    bodyGeo.attributes.position.needsUpdate = true;
    bodyGeo.computeVertexNormals();
  }

  function update(v, dt) {
    // 누르는 판: 내려옴(0~0.3) → 누름(0.3~0.75) → 올라가며 사라짐(0.75~1)
    const c = v.crush;
    const d = easeInOut(clamp01((c - 0.3) / 0.45));
    deform(d);
    const top = H * lerp(1, SQUASH, d);
    lid.position.y = top;
    const plateY = GROUND + top + 0.17;
    plate.visible = c > 0 && c < 1;
    plate.position.y = c < 0.3 ? plateY + (1 - easeInOut(c / 0.3)) * 1.4 : c < 0.75 ? plateY : plateY + easeInOut((c - 0.75) / 0.25) * 1.6;
    plate.scale.setScalar(c < 0.75 ? 1 : Math.max(1 - smooth(0.85, 1, c), 0.001));

    // 비우기·헹군 물 쏟기: 기울였다 바로 세움
    const ph = pourPhase(v);
    tilt.rotation.z = ph.tilt * 2.3;
    tilt.position.x = ph.tilt * -0.4;
    faucet.update(ph.faucet, ph.flowing, dt);
    if (ph.pouring) faucet.pour(can, mouth.set(0.3, top, 0), tilt, drops, dt);
    if (ph.rinsing) faucet.pour(can, mouth.set(0.3, top, 0), tilt, faucet.drops, dt);
    drops.update(dt);

    // 수거함: 나타난 뒤 캔을 들어 올려 떨어뜨림
    const bp = v.bin;
    bin.visible = bp > 0;
    bin.scale.setScalar(Math.max(backOut(clamp01(bp / 0.35)), 0.001));
    const y = dropHeight(bp, 1.8, 0.12);
    root.position.y = y;

    shadow.position.x = tilt.position.x;
    const s = 1 / (1 + y * 0.5);
    shadow.scale.set(s, s, s);
    shadow.material.opacity = bp >= 0.55 && y < 0.2 ? 0 : s;
  }

  return { update: update, reset: function () { drops.clear(); faucet.clear(); } };
}

// 캔 겉면: 빨간 바탕에 흰 물결띠와 작은 거품 무늬 (상표 없음)
function canTexture(THREE) {
  return canvasTexture(THREE, 1024, 512, function (g, w, h) {
    g.fillStyle = "#d8433b";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#ffffff";
    g.beginPath();
    g.moveTo(0, h * 0.5);
    for (let x = 0; x <= w; x += 8) g.lineTo(x, h * 0.5 + Math.sin((x / w) * TAU * 2) * 34);
    g.lineTo(w, h * 0.62);
    for (let x = w; x >= 0; x -= 8) g.lineTo(x, h * 0.62 + Math.sin((x / w) * TAU * 2) * 34);
    g.fill();
    g.fillStyle = "rgba(255,255,255,0.55)";
    for (let i = 0; i < 26; i++) {
      g.beginPath();
      g.arc((i * 97) % w, h * 0.18 + ((i * 53) % 120), 6 + (i % 4) * 4, 0, TAU);
      g.fill();
    }
    g.fillStyle = "#b8302a";
    g.fillRect(0, 0, w, 26);
    g.fillRect(0, h - 26, w, 26);
  });
}

function canSticker(THREE) {
  return stickerTexture(THREE, 512, 312, "#b57f12", function (g, w, h) {
    // 캔 아이콘
    g.beginPath();
    g.roundRect(70, 80, 100, 160, 14);
    g.fill();
    g.fillStyle = "#ffffff";
    g.fillRect(70, 140, 100, 22);
    g.fillStyle = "#b57f12";
    g.font = "900 120px system-ui, sans-serif";
    g.textBaseline = "middle";
    g.fillText("CAN", 196, h / 2 + 8);
  });
}
