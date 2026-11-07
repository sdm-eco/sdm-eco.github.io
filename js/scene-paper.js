// 종이류 장면
// 서대문구청 안내: 종이류는 이물질(부착물 등)을 제거하고 차곡차곡 쌓은 후 묶어서 배출
// (택배 운송장 스티커·테이프는 종량제 봉투 / 코팅된 종이·사진·벽지·물티슈는 재활용 불가)
import { GROUND, TAU, clamp01, easeInOut, backOut, lerp, canvasTexture, addShadow } from "./eco3d-util.js?v=20261107s";

const BOX = [-0.95, 0.2];   // 택배 상자 처음 자리 (x, z)
const STACK = [0.85, 0.0];  // 신문 더미 자리 (x, z)
const SW = 1.5, SD = 1.05;  // 신문 더미 가로·세로

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
  build: build
};

function build(THREE, scene, spin) {
  scene.add(spin);
  // 상자·신문이 작아서 장면 전체를 1.2배로 (바닥 높이는 그대로 두도록 위로 보정)
  spin.scale.setScalar(1.2);
  spin.position.y = GROUND * (1 - 1.2);
  const kraft = new THREE.MeshStandardMaterial({ map: kraftTexture(THREE), roughness: 0.85 });

  // 택배 상자 + 가운데 테이프 + 운송장 스티커
  const box = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.95, 1.05), kraft);
  body.position.y = 0.475;
  box.add(body);
  const tapeMat = new THREE.MeshStandardMaterial({ color: 0xd9c08a, roughness: 0.35, transparent: true, opacity: 0.9 });
  const tape = new THREE.Group();
  const tTop = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.012, 1.07), tapeMat);
  tTop.position.y = 0.956;
  const tFront = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.3, 0.012), tapeMat);
  tFront.position.set(0, 0.8, 0.53);
  const tBack = tFront.clone();
  tBack.position.z = -0.53;
  tape.add(tTop, tFront, tBack);
  box.add(tape);
  const labelMat = new THREE.MeshStandardMaterial({ map: waybillTexture(THREE), roughness: 0.6, transparent: true, side: THREE.DoubleSide });
  const waybill = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.36), labelMat);
  waybill.rotation.x = -Math.PI / 2;
  waybill.position.set(0.38, 0.963, 0.12);
  box.add(waybill);
  box.position.set(BOX[0], GROUND, BOX[1]);
  spin.add(box);

  // 신문·책 더미 (차곡차곡)
  const stack = new THREE.Group();
  const paperMat = new THREE.MeshStandardMaterial({ map: newsTexture(THREE), roughness: 0.9 });
  const edgeMat = new THREE.MeshStandardMaterial({ color: 0xeceae2, roughness: 0.9 });
  const SH = [0.1, 0.12, 0.09, 0.11];
  let y = 0;
  SH.forEach(function (h, i) {
    const sheet = new THREE.Mesh(new THREE.BoxGeometry(SW - (i % 2) * 0.06, h, SD - (i % 2) * 0.04), [edgeMat, edgeMat, paperMat, edgeMat, edgeMat, edgeMat]);
    sheet.position.set((i % 2 ? 0.03 : -0.02), y + h / 2, (i % 2 ? -0.02 : 0.02));
    sheet.rotation.y = (i % 2 ? 0.03 : -0.02);
    stack.add(sheet);
    y += h;
  });
  const STACK_H = y;
  stack.position.set(STACK[0], GROUND, STACK[1]);
  spin.add(stack);

  // 묶는 끈 두 줄: 앞뒤로 감아 앞면에 세로줄로 보이게 (고리를 세워 y·z 평면에 둠)
  const cords = [];
  const cordMat = new THREE.MeshStandardMaterial({ color: 0xf7f7f2, roughness: 0.6 });
  [-0.38, 0.38].forEach(function (x) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.03, 8, 64), cordMat);
    ring.rotation.y = Math.PI / 2;
    ring.position.set(STACK[0] + x, GROUND + (STACK_H + 0.09) / 2, STACK[1]);
    spin.add(ring);
    cords.push(ring);
  });
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), cordMat);
  knot.position.set(STACK[0] + 0.38, GROUND + STACK_H + 0.11, STACK[1]);
  spin.add(knot);

  const shadowBox = addShadow(THREE, scene, 2.2);
  spin.add(shadowBox);
  const shadowStack = addShadow(THREE, scene, 2.4);
  spin.add(shadowStack);
  shadowStack.position.set(STACK[0], GROUND + 0.004, STACK[1]);

  function update(v) {
    // 1단계: 테이프가 벗겨져 날아가고, 운송장 스티커도 떨어져 나감
    const pp = v.peel;
    const t1 = easeInOut(clamp01(pp / 0.6)), t2 = easeInOut(clamp01((pp - 0.35) / 0.65));
    tape.visible = t1 < 1;
    tape.position.set(t1 * -0.6, t1 * 1.2, 0);
    tape.rotation.set(t1 * 1.5, 0, t1 * 0.8);
    tape.scale.setScalar(Math.max(1 - t1 * 0.6, 0.001));
    tapeMat.opacity = 0.9 * (1 - clamp01((t1 - 0.6) / 0.4));
    waybill.visible = t2 < 1;
    waybill.position.set(0.38 + t2 * 0.9, 0.963 + Math.sin(Math.PI * t2) * 0.9, 0.12 + t2 * 0.4);
    waybill.rotation.set(-Math.PI / 2 + t2 * 3, 0, t2 * 2);
    labelMat.opacity = 1 - clamp01((t2 - 0.6) / 0.4);

    // 2단계: 상자가 펴져 납작해지고 신문 더미 위로 얹힘
    const f = easeInOut(clamp01(v.flat / 0.55));
    const move = easeInOut(clamp01((v.flat - 0.45) / 0.55));
    body.scale.set(lerp(1, 1.05, f), lerp(1, 0.07, f), lerp(1, 0.98, f));
    body.position.y = 0.475 * body.scale.y;
    const hop = Math.sin(Math.PI * move) * 0.8;
    box.position.set(lerp(BOX[0], STACK[0], move), GROUND + lerp(0, STACK_H, move) + hop, lerp(BOX[1], STACK[1], move));
    box.rotation.y = lerp(0, 0.02, move);
    shadowBox.position.set(box.position.x, GROUND + 0.005, box.position.z);
    shadowBox.material.opacity = move > 0.6 ? 0 : 1 / (1 + hop);

    // 3단계: 끈 두 줄이 더미를 감아 묶이고 매듭이 생김
    const tp = v.tie;
    const top = STACK_H + (v.flat > 0.99 ? 0.07 : 0);
    cords.forEach(function (ring, i) {
      const q = easeInOut(clamp01((tp - i * 0.25) / 0.6));
      ring.visible = q > 0;
      ring.position.y = GROUND + (top + 0.02) / 2;
      // 조금 느슨하게 둘렀다가 더미에 꼭 맞게 조여짐 (고리를 세웠으므로 x 크기 = 깊이 절반, y 크기 = 높이 절반)
      const tight = 1 + (1 - q) * 0.25;
      ring.scale.set((SD / 2 + 0.03) * tight, (top + 0.05) / 2 * tight, 1);
    });
    const k = backOut(clamp01((tp - 0.8) / 0.2));
    knot.visible = k > 0.001;
    knot.scale.setScalar(Math.max(k, 0.001));
    knot.position.y = GROUND + top + 0.04;
    stack.position.y = GROUND + Math.sin(Math.PI * clamp01((tp - 0.85) / 0.15)) * 0.08;
  }

  return { update: update };
}

function kraftTexture(THREE) {
  return canvasTexture(THREE, 256, 256, function (g, w, h) {
    g.fillStyle = "#c79a64";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "rgba(120,80,40,0.12)";
    for (let i = 0; i < 40; i++) g.fillRect(0, i * 7, w, 2);
  });
}

function waybillTexture(THREE) {
  return canvasTexture(THREE, 256, 184, function (g, w, h) {
    g.fillStyle = "#ffffff";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#2b2b2b";
    let x = 20;
    for (let i = 0; x < w - 20; i++) { const bw = [4, 8, 3, 10][i % 4]; g.fillRect(x, 18, bw, 54); x += bw + 5; }
    g.fillStyle = "#b9c0bc";
    for (let i = 0; i < 4; i++) g.fillRect(20, 92 + i * 22, w - 40 - (i % 2) * 50, 10);
  });
}

function newsTexture(THREE) {
  return canvasTexture(THREE, 512, 360, function (g, w, h) {
    g.fillStyle = "#f1efe7";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#3c3c3c";
    g.fillRect(28, 24, w - 56, 40);
    g.fillStyle = "#b8b6ae";
    for (let c = 0; c < 3; c++) for (let r = 0; r < 10; r++) g.fillRect(28 + c * 158, 90 + r * 24, 138 - (r % 3) * 20, 10);
    g.fillStyle = "#9db8c9";
    g.fillRect(186, 90, 138, 96);
  });
}
