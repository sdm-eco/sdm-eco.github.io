// 종이류 장면 (클레이 스타일)
// 서대문구청 안내: 종이류는 이물질(부착물 등)을 제거하고 차곡차곡 쌓은 후 묶어서 배출
// (택배 운송장 스티커·테이프는 종량제 봉투 / 코팅된 종이·사진·벽지·물티슈는 재활용 불가)
import { GROUND, TAU, clamp01, easeInOut, backOut, lerp, canvasTexture, CLAY, clayMat, wobble } from "./eco3d-util.js?v=20261108r";
import { sfx, hit } from "./eco3d-sound.js?v=20261108r";

const BOX = [-0.95, 0.2];   // 택배 상자 처음 자리 (x, z)
const STACK = [0.85, 0.0];  // 신문 더미 자리 (x, z)
const SW = 1.5, SD = 1.05;  // 신문 더미 가로·세로
const FLAT_H = 0.95 * 0.07; // 펴진 상자 두께

export default {
  // peel 1 = 테이프·운송장을 뗌, flat 1 = 상자를 펴서 더미 위에 얹음, tie 1 = 끈으로 묶음
  states: [
    { peel: 0, flat: 0, tie: 0 },
    { peel: 1, flat: 0, tie: 0 },
    { peel: 1, flat: 1, tie: 0 },
    { peel: 1, flat: 1, tie: 1 }
  ],
  moves: [null, [["peel", 1.8]], [["flat", 2.2]], [["tie", 1.8]]],
  spin: 0.35,
  camera: [1.5, -0.45],
  clay: true, // 클레이 스타일 조명·그림자 (eco3d.js)
  endOrbit: true, // 마지막 단계가 끝나면 드래그로 수거함까지 장면 전체가 돎 (앞 단계는 물건만)
  build: build
};

function build(THREE, scene, spin, ext) {
  scene.add(spin);
  // 상자·신문이 작아서 장면 전체를 1.2배로 (바닥 높이는 그대로 두도록 위로 보정)
  spin.scale.setScalar(1.2);
  spin.position.y = GROUND * (1 - 1.2);
  // 모서리가 둥근 상자 (없으면 보통 상자)
  function rbox(w, h, d, r) {
    return ext && ext.RoundedBoxGeometry ? new ext.RoundedBoxGeometry(w, h, d, 3, r) : new THREE.BoxGeometry(w, h, d);
  }
  const kraft = clayMat(THREE, 0xffffff, { map: kraftTexture(THREE), roughness: 0.75 });

  // 택배 상자 + 가운데 테이프 + 운송장 스티커
  const box = new THREE.Group();
  const body = new THREE.Mesh(rbox(1.4, 0.95, 1.05, 0.06), kraft);
  body.position.y = 0.475;
  box.add(body);
  const tapeMat = clayMat(THREE, 0xf2cf86, { roughness: 0.3, clearcoat: 0.6, transparent: true, opacity: 0.92 });
  const tape = new THREE.Group();
  const tTop = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.012, 1.07), tapeMat);
  tTop.position.y = 0.956;
  const tFront = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.3, 0.012), tapeMat);
  tFront.position.set(0, 0.8, 0.53);
  const tBack = tFront.clone();
  tBack.position.z = -0.53;
  tape.add(tTop, tFront, tBack);
  box.add(tape);
  const labelMat = clayMat(THREE, 0xffffff, { map: waybillTexture(THREE), roughness: 0.6, transparent: true, side: THREE.DoubleSide, sheen: 0.2 });
  const waybill = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.36), labelMat);
  waybill.rotation.x = -Math.PI / 2;
  waybill.position.set(0.38, 0.963, 0.12);
  box.add(waybill);
  box.position.set(BOX[0], GROUND, BOX[1]);
  spin.add(box);

  // 신문·책 더미 (차곡차곡, 모서리가 둥근 크림색 종이)
  const stack = new THREE.Group();
  const paperMat = clayMat(THREE, 0xffffff, { map: newsTexture(THREE), roughness: 0.8 });
  const edgeMat = clayMat(THREE, CLAY.cream, { roughness: 0.8 });
  const SH = [0.1, 0.12, 0.09, 0.11];
  let y = 0;
  SH.forEach(function (h, i) {
    const sheet = new THREE.Mesh(rbox(SW - (i % 2) * 0.06, h, SD - (i % 2) * 0.04, 0.035), [edgeMat, edgeMat, paperMat, edgeMat, edgeMat, edgeMat]);
    sheet.position.set((i % 2 ? 0.03 : -0.02), y + h / 2, (i % 2 ? -0.02 : 0.02));
    sheet.rotation.y = (i % 2 ? 0.03 : -0.02);
    stack.add(sheet);
    y += h;
  });
  const STACK_H = y;
  const TOP = STACK_H + FLAT_H; // 펴진 상자까지 얹은 높이 (끈은 이 높이에 맞춰 감음)
  stack.position.set(STACK[0], GROUND, STACK[1]);
  spin.add(stack);

  // 묶는 끈 두 줄: 더미 앞뒤·위아래를 감는 둥근 사각 고리 (y·z 평면, 가운데가 원점) — 두툼한 초록 끈
  const cordMat = clayMat(THREE, CLAY.green, { roughness: 0.5 });
  const ha = SD / 2 + 0.035, hb = TOP / 2 + 0.035, cr = 0.07;
  const loop = new THREE.Shape();
  loop.moveTo(-ha + cr, -hb);
  loop.lineTo(ha - cr, -hb);
  loop.absarc(ha - cr, -hb + cr, cr, -Math.PI / 2, 0, false);
  loop.lineTo(ha, hb - cr);
  loop.absarc(ha - cr, hb - cr, cr, 0, Math.PI / 2, false);
  loop.lineTo(-ha + cr, hb);
  loop.absarc(-ha + cr, hb - cr, cr, Math.PI / 2, Math.PI, false);
  loop.lineTo(-ha, -hb + cr);
  loop.absarc(-ha + cr, -hb + cr, cr, Math.PI, Math.PI * 1.5, false);
  const loopPts = loop.getSpacedPoints(96).slice(0, -1).map(function (p) { return new THREE.Vector3(0, p.y, p.x); });
  const cordGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(loopPts, true), 160, 0.035, 10, true);
  const cords = [];
  [-0.38, 0.38].forEach(function (x) {
    const ring = new THREE.Mesh(cordGeo, cordMat);
    ring.position.set(STACK[0] + x, GROUND + TOP / 2, STACK[1]);
    spin.add(ring);
    cords.push(ring);
  });
  // 매듭: 동그란 매듭 + 양옆 고리 (리본 모양)
  const knot = new THREE.Group();
  knot.add(new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 10), cordMat));
  [-1, 1].forEach(function (sd) {
    const bow = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.028, 8, 20), cordMat);
    bow.position.set(0, 0.03, sd * 0.1);
    bow.rotation.set(0, Math.PI / 2, sd * 0.5);
    knot.add(bow);
  });
  knot.position.set(STACK[0] + 0.38, GROUND + TOP + 0.05, STACK[1]);
  spin.add(knot);

  function update(v) {
    // 1단계: 테이프 끝이 살짝 들렸다가(준비) 쭉 벗겨져 날아가고 → 상자가 살짝 흔들림, 운송장 스티커도 말리며 떨어져 나감
    const pp = v.peel;
    const lift = pp > 0 && pp < 0.15 ? Math.sin(Math.PI * pp / 0.15) : 0;
    const t1 = easeInOut(clamp01((pp - 0.12) / 0.5)), t2 = easeInOut(clamp01((pp - 0.4) / 0.6));
    tape.visible = t1 < 1;
    tape.position.set(t1 * -0.6, t1 * 1.2 + Math.sin(Math.PI * t1) * 0.3 + lift * 0.04, 0);
    tape.rotation.set(t1 * 1.5, 0, t1 * 0.8 - lift * 0.12);
    tape.scale.setScalar(Math.max(1 - t1 * 0.6, 0.001));
    tapeMat.opacity = 0.92 * (1 - clamp01((t1 - 0.6) / 0.4));
    waybill.visible = t2 < 1;
    waybill.position.set(0.38 + t2 * 0.9, 0.963 + Math.sin(Math.PI * t2) * 0.9, 0.12 + t2 * 0.4);
    waybill.rotation.set(-Math.PI / 2 + t2 * 3, 0, t2 * 2);
    labelMat.opacity = 1 - clamp01((t2 - 0.6) / 0.4);
    const rip = pp < 1 ? wobble(clamp01((pp - 0.12) / 0.45), 2) * 0.04 : 0;

    // 2단계: 상자가 쭉 늘었다가(준비) 꾹 눌려 납작해지고 → 움츠렸다 뛰어 돌며 신문 더미 위로 톡 얹힘 → 더미가 출렁
    const fl = v.flat;
    const stretch = fl > 0 && fl < 0.12 ? Math.sin(Math.PI * fl / 0.12) : 0;
    const f = easeInOut(clamp01((fl - 0.1) / 0.38));
    const spread = backOut(clamp01((fl - 0.1) / 0.45));
    body.scale.set(lerp(1, 1.05, spread), lerp(1, 0.07, f) * (1 + stretch * 0.08), lerp(1, 0.98, spread));
    body.position.y = 0.475 * body.scale.y;
    const move = clamp01((fl - 0.5) / 0.5);
    const hx = easeInOut(Math.min(move / 0.8, 1));
    const air = Math.sin(Math.PI * Math.min(move / 0.8, 1));
    const hop = move < 0.8 ? air * 0.8 : 0.05 * Math.sin(Math.PI * (move - 0.8) / 0.2);
    const land = clamp01((move - 0.8) / 0.2);

    // 3단계: 끈 두 줄이 느슨하게 감겼다가 꽉 조여지고(살짝 지나쳤다 돌아옴) 매듭이 톡 생김 → 묶음이 통 튐
    const tp = v.tie;
    cords.forEach(function (ring, i) {
      const q = clamp01((tp - i * 0.2) / 0.55);
      ring.visible = q > 0;
      const tight = 1 + (1 - backOut(q)) * 0.25;
      ring.scale.set(1, tight, tight);
    });
    const k = backOut(clamp01((tp - 0.75) / 0.2));
    knot.visible = k > 0.001;
    knot.scale.setScalar(Math.max(k, 0.001));
    const bundle = Math.sin(Math.PI * clamp01((tp - 0.82) / 0.18)) * 0.07;

    box.position.set(lerp(BOX[0], STACK[0], hx), GROUND + lerp(0, STACK_H, hx) + hop + bundle, lerp(BOX[1], STACK[1], hx));
    box.rotation.set(0, lerp(0, 0.02, hx) + air * 0.35, air * 0.12 + rip);
    stack.position.y = GROUND + bundle;
    stack.scale.y = 1 - (fl < 1 ? wobble(land, 2) * 0.06 : 0);
    cords.forEach(function (ring) { ring.position.y = GROUND + TOP / 2 + bundle; });
    knot.position.y = GROUND + TOP + 0.05 + bundle;

    // 효과음 (체험 창에서 효과음을 켰을 때만): 진행률이 그 순간을 지날 때 한 번
    if (hit(v, "peel", 0.12)) sfx.play("rip");          // 테이프 찌익
    if (hit(v, "peel", 0.4)) sfx.play("peel");          // 운송장 떼는 슥
    if (hit(v, "flat", 0.1)) sfx.play("paper", 0.84);   // 상자를 눌러 펴는 사각사각
    if (hit(v, "flat", 0.9)) sfx.play("tap");           // 신문 더미 위에 톡
    if (hit(v, "tie", 0.35)) sfx.play("tie");           // 끈 조이기 슥슥
    if (hit(v, "tie", 0.75)) sfx.play("tie");           // 매듭
    if (hit(v, "tie", 0.95)) sfx.play("chime");         // 끝 띵동
  }

  return { update: update };
}

// 크라프트 상자: 연한 나무색에 은은한 결
function kraftTexture(THREE) {
  return canvasTexture(THREE, 256, 256, function (g, w, h) {
    g.fillStyle = "#dcb07a";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "rgba(150,100,55,0.1)";
    for (let i = 0; i < 40; i++) g.fillRect(0, i * 7, w, 2);
  });
}

// 운송장: 흰 바탕에 부드러운 회녹색 바코드·글줄, 초록 머리띠
function waybillTexture(THREE) {
  return canvasTexture(THREE, 256, 184, function (g, w, h) {
    g.fillStyle = "#ffffff";
    g.beginPath();
    g.roundRect(0, 0, w, h, 14);
    g.fill();
    g.fillStyle = "#6cc596";
    g.fillRect(0, 0, w, 12);
    g.fillStyle = "#5b6b63";
    let x = 20;
    for (let i = 0; x < w - 20; i++) { const bw = [4, 8, 3, 10][i % 4]; g.fillRect(x, 24, bw, 50); x += bw + 5; }
    g.fillStyle = "#cfd6d2";
    for (let i = 0; i < 4; i++) g.fillRect(20, 94 + i * 21, w - 40 - (i % 2) * 50, 10);
  });
}

// 신문: 크림 바탕에 부드러운 제목 띠·글줄, 민트색 사진 칸
function newsTexture(THREE) {
  return canvasTexture(THREE, 512, 360, function (g, w, h) {
    g.fillStyle = "#fffaf0";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#6f7d76";
    g.beginPath();
    g.roundRect(28, 24, w - 56, 40, 10);
    g.fill();
    g.fillStyle = "#d9d5c8";
    for (let c = 0; c < 3; c++) for (let r = 0; r < 10; r++) g.fillRect(28 + c * 158, 90 + r * 24, 138 - (r % 3) * 20, 10);
    g.fillStyle = "#bfe8cf";
    g.beginPath();
    g.roundRect(186, 90, 138, 96, 10);
    g.fill();
    g.fillStyle = "#6cc596";
    g.beginPath();
    g.arc(255, 150, 22, 0, TAU);
    g.fill();
  });
}
