// 헷갈리는 쓰레기 장면 ("재활용품인 척하는 쓰레기")
// 서대문구·서울시 안내: 칫솔·영수증·나무젓가락·고무장갑·테이프 등은 재활용이 안 되므로 종량제 봉투에,
// 컵라면 용기·유색 스티로폼은 깨끗이 씻어 재질별로 모으면 재활용, 아니면 종량제 봉투
import { GROUND, TAU, clamp01, easeInOut, backOut, lerp, canvasTexture, addShadow, binGroup, createFaucet } from "./eco3d-util.js?v=20261107s";
import { bagGroup, recycleSticker } from "./scene-general.js?v=20261107s";

const R_BIN = [-1.8, -0.6]; // 재활용품 수거함 (x, z)
const BAG = [1.45, -0.5];     // 종량제 봉투
const CUP = [0.0, 0.75];      // 컵라면 용기
const BIN_TOP = GROUND + 1.1;

export default {
  // show 1 = 헷갈리는 쓰레기가 나오고 재활용함에 ✕, bag 1 = 종량제 봉투에 담아 묶음, cup 1 = 컵라면 용기를 씻어 재활용함에
  states: [
    { show: 0, bag: 0, cup: 0 },
    { show: 1, bag: 0, cup: 0 },
    { show: 1, bag: 1, cup: 0 },
    { show: 1, bag: 1, cup: 1 }
  ],
  moves: [null, [["show", 2.4]], [["bag", 3.0]], [["cup", 3.6]]],
  spin: 0.2,
  camera: [1.4, -0.3],
  build: build
};

function build(THREE, scene, spin) {
  scene.add(spin);

  const rBin = binGroup(THREE, 0.72, 0.6, 1.1, 0x3b8fd0, 0x1f5f9a, recycleSticker(THREE));
  rBin.position.set(R_BIN[0], GROUND, R_BIN[1]);
  rBin.visible = true;
  spin.add(rBin);

  // 재활용함 위의 표지: ✕(재활용 안 됨) → ✓(씻은 용기는 재활용)
  const noMap = signTexture(THREE, false), okMap = signTexture(THREE, true);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.62), new THREE.MeshBasicMaterial({ map: noMap, transparent: true }));
  sign.position.set(R_BIN[0], BIN_TOP + 0.55, R_BIN[1] + 0.2);
  sign.visible = false;
  spin.add(sign);

  const bag = bagGroup(THREE);
  bag.group.position.set(BAG[0], GROUND, BAG[1]);
  bag.group.visible = false;
  spin.add(bag.group);

  // 헷갈리는 쓰레기 5가지
  const items = [toothbrush(THREE), receipt(THREE), chopsticks(THREE), glove(THREE), tape(THREE)];
  const HOME = [[-0.5, 0.6], [-0.05, 0.75], [0.4, 0.55], [0.85, 0.7], [1.3, 0.5]]; // 재활용함과 겹치지 않게 오른쪽으로
  items.forEach(function (it, i) {
    it.scale.multiplyScalar(1.2);
    it.userData.size = it.scale.x;
    it.position.set(HOME[i][0], GROUND, HOME[i][1]);
    it.visible = false;
    spin.add(it);
  });

  // 컵라면 용기
  const cup = cupNoodle(THREE);
  cup.position.set(CUP[0], GROUND, CUP[1]);
  cup.visible = false;
  spin.add(cup);
  const faucet = createFaucet(THREE, scene, CUP[0], GROUND + 1.75);

  const shadow = addShadow(THREE, scene, 4.2);
  spin.add(shadow);
  shadow.scale.set(1, 1, 0.45);
  shadow.position.set(0, GROUND + 0.004, 0.5);

  const p = new THREE.Vector3();

  function update(v, dt) {
    // 1단계: 쓰레기가 하나씩 나타나고, 재활용함 위에 ✕
    const sp = v.show;
    items.forEach(function (it, i) {
      const k = clamp01((sp - i * 0.1) / 0.35);
      it.userData.k = k;
    });
    const xk = backOut(clamp01((sp - 0.65) / 0.35));
    const cp = v.cup;
    const ok = cp > 0.75;
    if ((sign.material.map === okMap) !== ok) { sign.material.map = ok ? okMap : noMap; sign.material.needsUpdate = true; }
    sign.visible = xk > 0.001;
    sign.scale.setScalar(Math.max(xk * (ok ? 1 + 0.15 * Math.sin(clamp01((cp - 0.75) / 0.25) * Math.PI) : 1), 0.001));

    // 2단계: 종량제 봉투가 나오고, 쓰레기가 하나씩 들어간 뒤 입구를 묶음
    const bp = v.bag;
    bag.group.visible = bp > 0;
    bag.group.scale.setScalar(Math.max(backOut(clamp01(bp / 0.2)), 0.001));
    items.forEach(function (it, i) {
      const q = easeInOut(clamp01((bp - 0.15 - i * 0.1) / 0.3));
      const k = it.userData.k;
      it.visible = k > 0 && q < 1;
      p.set(lerp(HOME[i][0], BAG[0], q), lerp(GROUND, GROUND + 1.25, q) + Math.sin(Math.PI * q) * 0.9, lerp(HOME[i][1], BAG[1], q));
      it.position.copy(p);
      it.position.y += Math.sin(Math.PI * k) * 0.25 * (q > 0 ? 0 : 1);
      const s = it.userData.size * Math.max(backOut(k) * (q > 0.8 ? lerp(1, 0.3, (q - 0.8) / 0.2) : 1), 0.001);
      it.scale.setScalar(s);
    });
    bag.setTie(easeInOut(clamp01((bp - 0.8) / 0.2)), clamp01((bp - 0.15) / 0.6));

    // 3단계: 컵라면 용기가 나오고 → 물로 헹군 뒤 → ✓가 된 재활용함으로
    cup.visible = cp > 0 && cp < 1;
    const ck = backOut(clamp01(cp / 0.15));
    faucet.update(clamp01((cp - 0.12) / 0.08) * (1 - clamp01((cp - 0.5) / 0.08)), cp > 0.2 && cp < 0.48, dt);
    const q = easeInOut(clamp01((cp - 0.6) / 0.35));
    cup.position.set(lerp(CUP[0], R_BIN[0], q), lerp(GROUND, BIN_TOP + 0.1, q) + Math.sin(Math.PI * q) * 1.2, lerp(CUP[1], R_BIN[1], q));
    cup.rotation.z = q * 0.8;
    cup.scale.setScalar(Math.max(ck * (q > 0.8 ? lerp(1, 0.3, (q - 0.8) / 0.2) : 1), 0.001));
    shadow.material.opacity = sp > 0 && bp < 0.9 ? 0.7 : 0.25;
  }

  return { update: update, reset: function () { faucet.clear(); } };
}

// ✕ 빨간 동그라미 / ✓ 초록 동그라미
function signTexture(THREE, ok) {
  return canvasTexture(THREE, 256, 256, function (g, w, h) {
    g.fillStyle = ok ? "#2f8f5b" : "#d8433b";
    g.beginPath();
    g.arc(w / 2, h / 2, 118, 0, TAU);
    g.fill();
    g.strokeStyle = "#ffffff";
    g.lineWidth = 30;
    g.lineCap = "round";
    g.lineJoin = "round";
    g.beginPath();
    if (ok) { g.moveTo(72, 132); g.lineTo(112, 172); g.lineTo(186, 92); }
    else { g.moveTo(84, 84); g.lineTo(172, 172); g.moveTo(172, 84); g.lineTo(84, 172); }
    g.stroke();
  });
}

function mat(THREE, color, extra) { return new THREE.MeshStandardMaterial(Object.assign({ color: color, roughness: 0.5 }, extra || {})); }

// 칫솔: 손잡이 + 솔 (비스듬히 세워 잘 보이게)
function toothbrush(THREE) {
  const g = new THREE.Group();
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.95, 0.05), mat(THREE, 0x36b3a0));
  handle.position.y = 0.48;
  const bristle = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.22, 0.12), mat(THREE, 0xffffff, { roughness: 0.9 }));
  bristle.position.set(0, 0.86, 0.07);
  g.add(handle, bristle);
  g.rotation.z = 0.35;
  return g;
}

// 영수증: 살짝 말린 흰 종이
function receipt(THREE) {
  const g = new THREE.Group();
  const geo = new THREE.PlaneGeometry(0.42, 0.8, 1, 12);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.pow((pos.getY(i) + 0.4) / 0.8, 2) * 0.18);
  geo.computeVertexNormals();
  const paper = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: receiptTexture(THREE), roughness: 0.8, side: THREE.DoubleSide }));
  paper.position.y = 0.42;
  paper.rotation.x = -0.25;
  g.add(paper);
  return g;
}

// 나무젓가락 한 쌍 (기대어 세움)
function chopsticks(THREE) {
  const g = new THREE.Group();
  const wood = mat(THREE, 0xd8b384, { roughness: 0.8 });
  [-0.05, 0.05].forEach(function (x, i) {
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.032, 1.0, 8), wood);
    s.position.set(x, 0.48, 0);
    s.rotation.z = i ? -0.18 : -0.12;
    g.add(s);
  });
  return g;
}

// 고무장갑: 손바닥 + 손가락 넷 + 엄지 + 소매
function glove(THREE) {
  const g = new THREE.Group();
  const rubber = mat(THREE, 0xf2c230, { roughness: 0.35 });
  const palm = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.22, 6, 14), rubber);
  palm.scale.z = 0.45;
  palm.position.y = 0.45;
  g.add(palm);
  [-0.12, -0.04, 0.04, 0.12].forEach(function (x, i) {
    const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.2 + (i === 1 || i === 2 ? 0.05 : 0), 4, 10), rubber);
    f.position.set(x, 0.78 + (i === 1 || i === 2 ? 0.03 : 0), 0);
    g.add(f);
  });
  const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.16, 4, 10), rubber);
  thumb.position.set(0.22, 0.5, 0);
  thumb.rotation.z = -0.7;
  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.17, 0.28, 18, 1, true), new THREE.MeshStandardMaterial({ color: 0xf2c230, roughness: 0.35, side: THREE.DoubleSide }));
  cuff.scale.z = 0.5;
  cuff.position.y = 0.16;
  g.add(thumb, cuff);
  return g;
}

// 테이프 한 롤 (세워 둠)
function tape(THREE) {
  const g = new THREE.Group();
  const roll = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.09, 14, 32), mat(THREE, 0xd9c08a, { roughness: 0.3 }));
  roll.position.y = 0.29;
  roll.scale.z = 1.6;
  g.add(roll);
  return g;
}

// 컵라면 용기: 흰 컵 + 빨간 띠
function cupNoodle(THREE) {
  const g = new THREE.Group();
  const geo = new THREE.LatheGeometry([[0, 0], [0.3, 0], [0.32, 0.02], [0.42, 0.62], [0.44, 0.64]].map(function (p) { return new THREE.Vector2(p[0], p[1]); }), 40);
  const cup = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: cupTexture(THREE), roughness: 0.6, side: THREE.DoubleSide }));
  g.add(cup);
  return g;
}

function receiptTexture(THREE) {
  return canvasTexture(THREE, 128, 256, function (g, w, h) {
    g.fillStyle = "#fbfbf8";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#9aa19d";
    for (let i = 0; i < 9; i++) g.fillRect(14, 24 + i * 22, w - 28 - (i % 3) * 22, 7);
    g.fillStyle = "#3a3f3c";
    g.fillRect(14, 228, w - 28, 10);
  });
}

function cupTexture(THREE) {
  return canvasTexture(THREE, 256, 128, function (g, w, h) {
    g.fillStyle = "#ffffff";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#d8433b";
    g.fillRect(0, h * 0.45, w, h * 0.3);
    g.fillStyle = "#f2b33d";
    g.fillRect(0, h * 0.75, w, 8);
  });
}
