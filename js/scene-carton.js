// 종이팩 장면 (클레이 스타일)
// 종이팩 따로 배출 안내(기후에너지환경부 등): 비우고 → 헹구고 → 납작하게 → 종이팩끼리 따로 배출
import { GROUND, clamp01, smooth, easeInOut, backOut, lerp, canvasTexture, stickerTexture, createDrops, createFaucet, CLAY, clayMat, clayBin, tiltCurve, wobble } from "./eco3d-util.js?v=20261108h";
import { sfx, hit } from "./eco3d-sound.js?v=20261108h";

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
  clay: true, // 클레이 스타일 조명·그림자 (eco3d.js)
  build: build
};

function build(THREE, scene, spin, ext) {
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

  // 몸통: 모서리가 둥근 상자 (네 옆면에 그림, 위아래는 크림색)
  const side = clayMat(THREE, 0xffffff, { map: packTexture(THREE), roughness: 0.6 });
  const white = clayMat(THREE, CLAY.cream, { side: THREE.DoubleSide });
  const bodyGeo = ext && ext.RoundedBoxGeometry ? new ext.RoundedBoxGeometry(W, HB, D, 4, 0.06) : new THREE.BoxGeometry(W, HB, D);
  const body = new THREE.Mesh(bodyGeo, [side, side, white, white, side, side]);
  body.position.y = HB / 2;

  // 박공지붕(앞뒤로 기운 두 면)과 맨 위 접합부 — 모서리를 둥글게 깎은 파스텔 파랑
  const BV = 0.03, BT = 0.04;
  const tri = new THREE.Shape([new THREE.Vector2(-W / 2 + BV, BV), new THREE.Vector2(W / 2 - BV, BV), new THREE.Vector2(0, ROOF - BV)]);
  const roofGeo = new THREE.ExtrudeGeometry(tri, { depth: D - BT * 2, bevelEnabled: true, bevelThickness: BT, bevelSize: BV, bevelSegments: 3 });
  roofGeo.translate(0, 0, -(D - BT * 2) / 2);
  const roof = new THREE.Mesh(roofGeo, clayMat(THREE, CLAY.blue));
  roof.position.y = HB;
  const finGeo = ext && ext.RoundedBoxGeometry ? new ext.RoundedBoxGeometry(0.09, 0.2, D, 3, 0.035) : new THREE.BoxGeometry(0.08, 0.2, D);
  const fin = new THREE.Mesh(finGeo, white);
  fin.position.y = HB + ROOF + 0.08;
  pack.add(body, roof, fin);

  // 종이팩 수거함: 파스텔 하늘색 + 진한 테두리 (납작한 종이팩이 거의 다 들어가도록 조금 높게)
  const bin = clayBin(THREE, 1.08, 0.9, 1.85, CLAY.blue, CLAY.blueDeep, packSticker(THREE));
  bin.position.y = GROUND;
  scene.add(bin);

  const faucet = createFaucet(THREE, scene, 0.05, GROUND + HB + ROOF + 1.0);
  const milk = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, transparent: true, opacity: 0.95 });
  const drops = createDrops(THREE, scene, milk, 60, 0.05);
  const mouth = new THREE.Vector3();

  function update(v, dt) {
    // 펼쳐서 납작하게: 살짝 부풀었다가(준비) 앞뒤로 꾹 눌려 얇아지고 옆으로 퍼지며 지붕이 펴짐 → 몸이 한 번 출렁임
    const fl = v.flat;
    const swell = fl > 0 && fl < 0.15 ? Math.sin(Math.PI * fl / 0.15) : 0;
    const f = fl >= 1 ? 1 : easeInOut(clamp01((fl - 0.12) / 0.55));
    const jig = fl < 1 ? wobble(clamp01((fl - 0.67) / 0.33), 2) : 0;
    roof.scale.y = lerp(1, 0.12, f);
    fin.position.y = HB + lerp(ROOF, ROOF * 0.12, f) + 0.08;

    // 비우기·헹군 물 쏟기: 살짝 젖혔다(준비) 기울여 머문 뒤 살짝 지나쳐 세움
    const pour = v.$key === "empty" ? v.$p : 0;
    const r = v.$key === "rinse" ? v.$p : 0;
    const rq = clamp01((r - 0.55) / 0.45);
    const tp = pour > 0 ? tiltCurve(pour) : rq > 0 ? tiltCurve(rq) : 0;
    tilt.rotation.z = tp * 2.3;
    tilt.position.x = tp * -0.4;
    faucet.update(smooth(0, 0.12, r) * (1 - smooth(0.45, 0.55, r)), r > 0.12 && r < 0.42, dt);
    if (pour > 0.36 && pour < 0.72) faucet.pour(pack, mouth.set(0, HB + ROOF, 0.35), tilt, drops, dt);
    if (rq > 0.36 && rq < 0.72) faucet.pour(pack, mouth.set(0, HB + ROOF, 0.35), tilt, faucet.drops, dt);
    drops.update(dt);

    // 수거함: 통통 튀며 나타나고 → 종이팩이 움츠렸다(준비) 뛰어올라 쏙 들어감 → 수거함이 출렁
    const bp = v.bin;
    bin.visible = bp > 0;
    bin.scale.setScalar(Math.max(backOut(clamp01(bp / 0.3)), 0.001));
    const crouch = bp > 0.15 && bp < 0.3 ? Math.sin(Math.PI * (bp - 0.15) / 0.15) : 0;
    const jump = clamp01((bp - 0.28) / 0.5);
    const LIFT = 2.3;
    const y = jump <= 0 ? 0 : jump < 0.45 ? easeInOut(jump / 0.45) * LIFT : lerp(LIFT, 0.05, Math.pow((jump - 0.45) / 0.55, 2));
    root.position.y = y;
    root.rotation.z = Math.sin(Math.PI * jump) * 0.2;
    const land = clamp01((bp - 0.78) / 0.22);
    // 들어가면서 수거함 벽에 비스듬히 기대어 멈춤 (뚜껑처럼 보이지 않게)
    tilt.rotation.z += smooth(0.5, 1, jump) * 0.16 + wobble(land, 2) * 0.05;
    bin.rotation.z = wobble(land, 2) * 0.08;
    bin.scale.y *= 1 - wobble(land, 2) * 0.06;

    // 크기: 납작해짐(가로 넓게·앞뒤 얇게) + 부풂·출렁임·움츠림 (부피는 그대로인 느낌으로 가로를 반대로)
    const sy = 1 + swell * 0.04 - jig * 0.05 - crouch * 0.12;
    pack.scale.set(lerp(1, 1.3, f) * (1 + swell * 0.05) / Math.sqrt(sy), sy, lerp(1, 0.1, f) * (1 + swell * 0.08) / Math.sqrt(sy));

    // 효과음 (체험 창에서 효과음을 켰을 때만): 진행률이 그 순간을 지날 때 한 번
    if (hit(v, "empty", 0.36)) sfx.play("pour", 0.79);  // 쪼르륵 비우기
    if (hit(v, "rinse", 0.12)) sfx.play("water", 1.08); // 수도꼭지 물줄기
    if (hit(v, "rinse", 0.71)) sfx.play("pour", 0.58);  // 헹군 물 쏟기
    if (hit(v, "flat", 0.14)) sfx.play("paper", 0.99);  // 꾹 눌러 펴는 사각사각
    if (hit(v, "bin", 0.78)) sfx.play("thud");          // 수거함에 통
    if (hit(v, "bin", 0.95)) sfx.play("chime");         // 끝 띵동
  }

  return { update: update, reset: function () { drops.clear(); faucet.clear(); } };
}

// 종이팩 옆면: 크림 바탕에 파스텔 파랑 띠와 우유 잔, 작은 잎 (상표 없음)
function packTexture(THREE) {
  return canvasTexture(THREE, 512, 820, function (g, w, h) {
    g.fillStyle = "#fff6e6";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#7db7ee";
    g.fillRect(0, 0, w, h * 0.16);
    g.beginPath();
    g.moveTo(0, h * 0.72);
    g.bezierCurveTo(w * 0.3, h * 0.66, w * 0.6, h * 0.8, w, h * 0.7);
    g.lineTo(w, h);
    g.lineTo(0, h);
    g.fill();
    // 우유 잔
    g.fillStyle = "#bcdaf5";
    g.beginPath();
    g.moveTo(w * 0.36, h * 0.3);
    g.lineTo(w * 0.64, h * 0.3);
    g.lineTo(w * 0.6, h * 0.58);
    g.lineTo(w * 0.4, h * 0.58);
    g.fill();
    g.fillStyle = "#ffffff";
    g.beginPath();
    g.roundRect(w * 0.375, h * 0.36, w * 0.25, h * 0.2, 12);
    g.fill();
    // 잎
    g.fillStyle = "#6cc596";
    g.save();
    g.translate(w * 0.7, h * 0.27);
    g.rotate(-0.7);
    g.beginPath();
    g.ellipse(0, 0, 34, 15, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  });
}

function packSticker(THREE) {
  return stickerTexture(THREE, 512, 312, "#4a8fe0", function (g, w, h) {
    // 종이팩 아이콘 두 개 (펼친 것·세운 것)
    g.beginPath();
    g.moveTo(120, 250);
    g.lineTo(120, 120);
    g.lineTo(165, 70);
    g.lineTo(210, 120);
    g.lineTo(210, 250);
    g.fill();
    g.beginPath();
    g.roundRect(260, 190, 180, 60, 10);
    g.fill();
    g.fillStyle = "#ffffff";
    g.fillRect(120, 150, 90, 24);
    g.fillRect(260, 208, 180, 14);
  });
}
