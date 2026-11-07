// 캔 장면 (클레이 스타일 시범)
// 서대문구청 안내(재활용품 분리배출·올바른 쓰레기 배출방법): 내용물을 비우고 이물질 제거 → 압착 →
// 캔류로 배출 (단독주택은 투명 비닐봉투에 담아 배출요일에)
import { GROUND, TAU, clamp01, smooth, easeInOut, backOut, lerp, canvasTexture, stickerTexture, createDrops, createFaucet, CLAY, clayMat, clayBin, tiltCurve, wobble } from "./eco3d-util.js?v=20261108r";
import { sfx, hit } from "./eco3d-sound.js?v=20261108r";

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
  moves: [null, [["empty", 2.4]], [["rinse", 3.8]], [["crush", 2.2]], [["bin", 2.0]]],
  spin: 0.4,
  camera: [0.3, -0.35],
  clay: true, // 클레이 스타일 조명·그림자 (eco3d.js)
  endOrbit: true, // 마지막 단계가 끝나면 드래그로 수거함까지 장면 전체가 돎 (앞 단계는 물건만)
  build: build
};

function build(THREE, scene, spin, ext) {
  // root(들어 올리기) → tilt(쏟을 때 기울이기) → spin(드래그 회전) → can(본체, 움츠림은 can 크기로)
  const root = new THREE.Group();
  const tilt = new THREE.Group();
  tilt.position.y = PIV;
  const can = new THREE.Group();
  can.position.y = GROUND - PIV;
  root.add(tilt);
  tilt.add(spin);
  spin.add(can);
  scene.add(root);

  // 몸통 (잘게 나눈 원통: 찌그러뜨릴 때 주름이 생기도록) — 민트색 점토 느낌, 금속광은 약하게
  const bodyGeo = new THREE.CylinderGeometry(R, R, H, 72, 48, true);
  bodyGeo.translate(0, H / 2, 0);
  const orig = bodyGeo.attributes.position.array.slice();
  const body = new THREE.Mesh(bodyGeo, clayMat(THREE, 0xffffff, { map: canTexture(THREE), roughness: 0.42, metalness: 0.15, clearcoat: 0.4, side: THREE.DoubleSide }));
  can.add(body);

  // 위·아래 둥근 테두리와 뚜껑(은색, 은은한 금속)
  const silver = new THREE.MeshPhysicalMaterial({ color: CLAY.silver, metalness: 0.55, roughness: 0.32, clearcoat: 0.4, side: THREE.DoubleSide });
  const lid = new THREE.Group();
  const lidShell = new THREE.Mesh(new THREE.LatheGeometry([[R + 0.005, -0.02], [R + 0.02, 0.04], [R * 0.95, 0.11], [R * 0.86, 0.07], [0, 0.06]].map(function (p) { return new THREE.Vector2(p[0], p[1]); }), 56), silver);
  const rimTop = new THREE.Mesh(new THREE.TorusGeometry(R * 0.96, 0.035, 10, 56), silver);
  rimTop.rotation.x = Math.PI / 2;
  rimTop.position.y = 0.1;
  const tab = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.2, 4, 10), silver);
  tab.rotation.z = Math.PI / 2;
  tab.scale.z = 0.35;
  tab.position.set(0.12, 0.095, 0);
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.11, 24), new THREE.MeshBasicMaterial({ color: 0x31413a }));
  hole.rotation.x = -Math.PI / 2;
  hole.scale.set(1.4, 1, 1);
  hole.position.set(0.3, 0.075, 0);
  lid.add(lidShell, rimTop, tab, hole);
  can.add(lid);
  const base = new THREE.Mesh(new THREE.LatheGeometry([[0, 0.1], [R * 0.82, 0.02], [R * 0.95, 0.0], [R + 0.01, 0.08]].map(function (p) { return new THREE.Vector2(p[0], p[1]); }), 56), silver);
  can.add(base);

  // 누르는 판: 둥근 모서리의 나무 판
  const plateGeo = ext && ext.RoundedBoxGeometry ? new ext.RoundedBoxGeometry(1.8, 0.2, 1.8, 4, 0.08) : new THREE.BoxGeometry(1.8, 0.2, 1.8);
  const plate = new THREE.Mesh(plateGeo, clayMat(THREE, CLAY.wood, { roughness: 0.7 }));
  plate.visible = false;
  scene.add(plate);

  // 캔류 수거함: 파스텔 노랑 + 진한 테두리
  const bin = clayBin(THREE, 1.08, 0.9, 1.5, CLAY.yellow, CLAY.yellowDeep, canSticker(THREE));
  bin.position.y = GROUND;
  scene.add(bin);

  const faucet = createFaucet(THREE, scene, 0.05, GROUND + H + 0.95, true);
  const cola = new THREE.MeshPhysicalMaterial({ color: 0x8a5a36, roughness: 0.15, transparent: true, opacity: 0.85, clearcoat: 0.5 });
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
    // 누르는 판: 위에서 천천히 내려와 → 점점 빠르게 꾹 누르고(캔이 출렁) → 살짝 튀어 올랐다가 위로 사라짐
    const c = v.crush;
    const press = clamp01((c - 0.28) / 0.32);
    const d = c >= 1 ? 1 : Math.pow(press, 1.7);
    deform(d);
    const top = H * lerp(1, SQUASH, d);
    lid.position.y = top;
    const plateY = GROUND + top + 0.2;
    plate.visible = c > 0 && c < 1;
    let py;
    if (c < 0.28) py = plateY + (1 - easeInOut(c / 0.28)) * 1.6;
    else if (c < 0.66) py = plateY;
    else { const q = clamp01((c - 0.66) / 0.34); py = plateY + Math.sin(Math.PI * Math.min(q / 0.3, 1)) * 0.15 * (q < 0.3 ? 1 : 0) + smooth(0.25, 1, q) * 2.0; }
    plate.position.set(0, py, 0);
    plate.scale.setScalar(Math.max(1 - smooth(0.85, 1, c), 0.001));
    const jiggle = c < 1 ? wobble(clamp01((c - 0.6) / 0.4), 2) * 0.06 : 0;

    // 비우기·헹군 물 쏟기: 살짝 젖혔다(준비) 기울여 머문 뒤 살짝 지나쳐 세움
    const pour = v.$key === "empty" ? v.$p : 0;
    const r = v.$key === "rinse" ? v.$p : 0;
    const rq = clamp01((r - 0.55) / 0.45);
    const tp = pour > 0 ? tiltCurve(pour) : rq > 0 ? tiltCurve(rq) : 0;
    tilt.rotation.z = tp * 2.3;
    tilt.position.x = tp * -0.4;
    faucet.update(smooth(0, 0.12, r) * (1 - smooth(0.45, 0.55, r)), r > 0.12 && r < 0.42, dt);
    if (pour > 0.36 && pour < 0.72) faucet.pour(can, mouth.set(0.3, top, 0), tilt, drops, dt);
    if (rq > 0.36 && rq < 0.72) faucet.pour(can, mouth.set(0.3, top, 0), tilt, faucet.drops, dt);
    drops.update(dt);

    // 수거함: 통통 튀며 나타나고 → 캔이 움츠렸다(준비) 뛰어올라 쏙 들어감 → 수거함이 출렁
    const bp = v.bin;
    bin.visible = bp > 0;
    bin.scale.setScalar(Math.max(backOut(clamp01(bp / 0.3)), 0.001));
    const crouch = bp > 0.15 && bp < 0.3 ? Math.sin(Math.PI * (bp - 0.15) / 0.15) : 0;
    const jump = clamp01((bp - 0.28) / 0.5);
    const LIFT = 1.8;
    const y = jump <= 0 ? 0 : jump < 0.45 ? easeInOut(jump / 0.45) * LIFT : lerp(LIFT, 0.12, Math.pow((jump - 0.45) / 0.55, 2));
    root.position.y = y;
    root.rotation.z = Math.sin(Math.PI * jump) * 0.2;
    const land = clamp01((bp - 0.78) / 0.22);
    bin.rotation.z = wobble(land, 2) * 0.08;
    bin.scale.y *= 1 - wobble(land, 2) * 0.06;

    const sy = 1 - crouch * 0.12 + jiggle;
    can.scale.set(1 / Math.sqrt(sy), sy, 1 / Math.sqrt(sy));

    // 효과음 (체험 창에서 효과음을 켰을 때만): 진행률이 그 순간을 지날 때 한 번
    if (hit(v, "empty", 0.36)) sfx.play("pour", 0.86);        // 쪼르륵 비우기
    if (hit(v, "rinse", 0.12)) sfx.play("water", 1.14);       // 수도꼭지 물줄기
    if (hit(v, "rinse", 0.71)) sfx.play("pour", 0.6);         // 헹군 물 쏟기
    if (hit(v, "crush", 0.28)) sfx.play("crunch", 0.7, true); // 판이 누를 때 금속 찌그럭
    if (hit(v, "bin", 0.78)) sfx.play("thud");                 // 수거함에 통
    if (hit(v, "bin", 0.95)) sfx.play("chime");                // 끝 띵동
  }

  return { update: update, reset: function () { drops.clear(); faucet.clear(); } };
}

// 캔 겉면: 민트 바탕에 크림 물결띠와 작은 거품·잎 (상표 없음)
function canTexture(THREE) {
  return canvasTexture(THREE, 1024, 512, function (g, w, h) {
    g.fillStyle = "#79c99d";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#fff6e6";
    g.beginPath();
    g.moveTo(0, h * 0.5);
    for (let x = 0; x <= w; x += 8) g.lineTo(x, h * 0.5 + Math.sin((x / w) * TAU * 2) * 34);
    g.lineTo(w, h * 0.64);
    for (let x = w; x >= 0; x -= 8) g.lineTo(x, h * 0.64 + Math.sin((x / w) * TAU * 2) * 34);
    g.fill();
    g.fillStyle = "rgba(255,255,255,0.6)";
    for (let i = 0; i < 26; i++) {
      g.beginPath();
      g.arc((i * 97) % w, h * 0.16 + ((i * 53) % 120), 6 + (i % 4) * 4, 0, TAU);
      g.fill();
    }
    g.fillStyle = "#2f8f5b";
    g.fillRect(0, 0, w, 22);
    g.fillRect(0, h - 22, w, 22);
  });
}

function canSticker(THREE) {
  return stickerTexture(THREE, 512, 312, "#c98d1f", function (g, w, h) {
    // 캔 아이콘
    g.beginPath();
    g.roundRect(70, 80, 100, 160, 18);
    g.fill();
    g.fillStyle = "#ffffff";
    g.fillRect(70, 140, 100, 22);
    g.fillStyle = "#c98d1f";
    g.font = "900 120px system-ui, sans-serif";
    g.textBaseline = "middle";
    g.fillText("CAN", 196, h / 2 + 8);
  });
}
