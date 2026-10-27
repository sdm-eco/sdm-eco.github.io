// 일반 쓰레기 장면
// 서대문구청 안내: 재활용품은 품목별로 따로 배출, 일반(가연성) 쓰레기는 종량제 봉투에 담아
// 18시~23시에 내 집 앞·내 점포 앞에 배출 (규격봉투 미사용 시 과태료)
import { GROUND, TAU, clamp01, smooth, easeInOut, backOut, lerp, densePoints, canvasTexture, addShadow, stickerTexture, binGroup, seeded, houseFront } from "./eco3d-util.js";

const R_BIN = [1.6, 0.35];     // 재활용품 수거함 위치 (x, z)
const BAG = [-1.45, 0.15];      // 종량제 봉투가 나타나는 곳
const BAG_OUT = [0.3, -0.95];  // 집 앞에 내놓는 곳
const HOUSE_Z = -1.55;

export default {
  // sort 1 = 재활용품을 골라냄, bag 1 = 종량제 봉투에 담아 묶음, out 1 = 저녁에 집 앞에 내놓음
  states: [
    { sort: 0, bag: 0, out: 0 },
    { sort: 1, bag: 0, out: 0 },
    { sort: 1, bag: 1, out: 0 },
    { sort: 1, bag: 1, out: 1 }
  ],
  moves: [null, [["sort", 2.8]], [["bag", 3.8]], [["out", 3.2]]],
  spin: 0.3,
  camera: [1.6, -0.2],
  build: build
};

function build(THREE, scene, spin) {
  scene.add(spin);
  const rand = seeded(11);

  // 일반쓰레기: 휴지 뭉치, 스펀지, 낙엽
  const trash = [tissue(THREE, rand, 0.2), tissue(THREE, rand, 0.16), sponge(THREE), leaf(THREE, 0x8fbf4a), leaf(THREE, 0xd98b3a)];
  // 작은 카드에서도 보이도록 1.35배로 키움
  [[-0.45, 0.17, 0.25], [0.15, 0.13, 0.5], [-0.05, 0.08, -0.05], [0.5, 0.02, 0.15], [-0.75, 0.02, -0.15]].forEach(function (p, i) {
    trash[i].scale.multiplyScalar(1.35);
    trash[i].position.set(p[0] * 1.3, GROUND + p[1] * 1.35, p[2] * 1.3);
    trash[i].userData.home = trash[i].position.clone();
    trash[i].userData.rot = trash[i].rotation.clone();
    spin.add(trash[i]);
  });

  // 섞여 있던 재활용품: 캔, 유리병
  const recyc = [can(THREE), glassBottle(THREE)];
  [[0.42, 0, -0.3], [-0.3, 0, -0.45]].forEach(function (p, i) {
    recyc[i].scale.multiplyScalar(1.35);
    recyc[i].position.set(p[0] * 1.3, GROUND + p[1], p[2] * 1.3);
    recyc[i].userData.home = recyc[i].position.clone();
    spin.add(recyc[i]);
  });

  // 재활용품 수거함 (파랑)
  const rBin = binGroup(THREE, 0.46, 0.4, 0.72, 0x3b8fd0, 0x1f5f9a, recycleSticker(THREE));
  rBin.position.set(R_BIN[0], GROUND, R_BIN[1]);
  spin.add(rBin);

  // 종량제 봉투
  const bag = bagGroup(THREE);
  spin.add(bag.group);
  const bagShadow = addShadow(THREE, scene, 2);
  spin.add(bagShadow);
  bagShadow.material.opacity = 0;

  // 집 앞 (배출 시간 안내판)과 달
  const house = houseFront(THREE, timeSign(THREE));
  house.position.set(0, GROUND, HOUSE_Z);
  spin.add(house);
  const moon = new THREE.Mesh(new THREE.SphereGeometry(0.26, 24, 16), new THREE.MeshStandardMaterial({ color: 0xfff4c2, emissive: 0xffe58a, emissiveIntensity: 0.9 }));
  moon.position.set(-1.9, 1.75, HOUSE_Z - 0.4);
  spin.add(moon);

  const tmp = new THREE.Vector3();
  const to = new THREE.Vector3();

  // home에서 target으로 포물선을 그리며 날아감 (q 0~1)
  function fly(obj, target, q, arc) {
    const e = easeInOut(q);
    obj.position.lerpVectors(obj.userData.home, target, e);
    obj.position.y += Math.sin(Math.PI * e) * arc;
  }

  function update(v) {
    // 1단계: 재활용품 수거함이 나오고, 캔·병이 그쪽으로 감
    const sp = v.sort;
    rBin.visible = sp > 0;
    rBin.scale.setScalar(Math.max(backOut(clamp01(sp / 0.2)), 0.001));
    recyc.forEach(function (r, i) {
      const q = clamp01((sp - 0.2 - i * 0.3) / 0.45);
      r.visible = q < 1;
      to.set(R_BIN[0], GROUND + 0.45, R_BIN[1]);
      fly(r, to, q, 1.1);
      r.rotation.set(0, 0, -q * 2.2);
    });

    // 2단계: 봉투가 나오고, 일반쓰레기를 하나씩 담은 뒤 입구를 묶음
    const bp = v.bag;
    const appear = backOut(clamp01(bp / 0.16));
    const tie = easeInOut(clamp01((bp - 0.78) / 0.2));
    trash.forEach(function (t, i) {
      const q = clamp01((bp - 0.14 - i * 0.11) / 0.3);
      t.visible = q < 1;
      to.set(BAG[0], GROUND + 1.0, BAG[1]);
      fly(t, to, q, 0.7);
      t.rotation.set(t.userData.rot.x + q * 3, t.userData.rot.y, t.userData.rot.z + q * 2);
    });
    bag.setTie(tie, smooth(0.2, 0.75, bp));

    // 3단계: 집 앞이 나타나고, 묶은 봉투를 집 앞에 내놓음
    const op = v.out;
    const rise = backOut(clamp01(op / 0.3));
    house.visible = op > 0;
    house.scale.set(1, Math.max(rise, 0.001), 1);
    moon.visible = op > 0.15;
    moon.scale.setScalar(Math.max(backOut(clamp01((op - 0.15) / 0.25)), 0.001));
    const carry = easeInOut(clamp01((op - 0.3) / 0.45));
    house.userData.sign.scale.setScalar(Math.max(backOut(clamp01((op - 0.75) / 0.22)), 0.001));

    const g = bag.group;
    g.visible = bp > 0;
    g.scale.setScalar(Math.max(appear, 0.001) * 0.82);
    g.position.set(lerp(BAG[0], BAG_OUT[0], carry), GROUND + Math.sin(Math.PI * carry) * 0.8, lerp(BAG[1], BAG_OUT[1], carry));
    g.rotation.z = Math.sin(Math.PI * carry) * -0.15;
    bagShadow.position.set(g.position.x, GROUND + 0.005, g.position.z);
    const s = 1 / (1 + (g.position.y - GROUND) * 0.6);
    bagShadow.scale.setScalar(s * appear * 0.7);
    bagShadow.material.opacity = bp > 0 ? s : 0;
  }

  // 되돌릴 때 따로 정리할 것은 없음 (모두 상태값으로 그림)
  return { update: update };
}

// 종량제 봉투: 몸통 + 입구(묶으면 오므라듦) + 묶은 매듭
function bagGroup(THREE) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ map: bagTexture(THREE), roughness: 0.55, side: THREE.DoubleSide });
  const bodyGeo = new THREE.LatheGeometry(densePoints(THREE, [[0, 0], [0.42, 0.02], [0.62, 0.14], [0.7, 0.45], [0.68, 0.82], [0.56, 1.04], [0.4, 1.15]], 4), 56);
  const bp = bodyGeo.attributes.position;
  for (let i = 0; i < bp.count; i++) {
    const x = bp.getX(i), y = bp.getY(i), z = bp.getZ(i);
    const k = 1 + 0.045 * Math.sin(Math.atan2(z, x) * 7 + y * 5) * Math.sin(y * 9) * (1 - smooth(0.85, 1.1, y));
    bp.setXYZ(i, x * k, y, z * k);
  }
  bodyGeo.computeVertexNormals();
  const body = new THREE.Mesh(bodyGeo, mat);
  group.add(body);

  // 입구: 위쪽 반지름을 묶는 정도에 따라 줄임
  const NECK_H = 0.42, R = 0.4;
  const neckGeo = new THREE.CylinderGeometry(R, R, NECK_H, 40, 6, true);
  const neck = new THREE.Mesh(neckGeo, new THREE.MeshStandardMaterial({ color: 0xf6f6f2, roughness: 0.6, side: THREE.DoubleSide }));
  neck.position.y = 1.15 + NECK_H / 2;
  group.add(neck);
  const pos = neckGeo.attributes.position;
  const orig = pos.array.slice();

  const knotMat = new THREE.MeshStandardMaterial({ color: 0xf6f6f2, roughness: 0.6 });
  const knot = new THREE.Group();
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 10), knotMat);
  knot.add(ball);
  [-1, 1].forEach(function (side) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 10), knotMat);
    ear.scale.set(1, 0.45, 0.35);
    ear.position.set(side * 0.16, 0.08, 0);
    ear.rotation.z = side * 0.6;
    knot.add(ear);
  });
  knot.position.y = 1.15 + NECK_H;
  group.add(knot);

  let lastTie = -1, lastFull = -1;
  function setTie(tie, full) {
    if (tie === lastTie && full === lastFull) return;
    lastTie = tie;
    lastFull = full;
    // 쓰레기가 찰수록 몸통이 조금 불룩해짐
    const wide = 0.92 + full * 0.1, tall = 0.94 + full * 0.06;
    body.scale.set(wide, tall, wide);
    neck.scale.set(wide, 1, wide);
    neck.position.y = 1.15 * tall + NECK_H * lerp(1, 0.75, tie) / 2;
    const top = lerp(R, 0.05, tie);
    for (let i = 0; i < pos.count; i++) {
      const x = orig[i * 3], y = orig[i * 3 + 1], z = orig[i * 3 + 2];
      const t = (y + NECK_H / 2) / NECK_H;
      const r = lerp(R, top, smooth(0, 1, t)) / R;
      pos.setXYZ(i, x * r, y * lerp(1, 0.75, tie), z * r);
    }
    pos.needsUpdate = true;
    neckGeo.computeVertexNormals();
    knot.visible = tie > 0.5;
    knot.scale.setScalar(Math.max(backOut(clamp01((tie - 0.5) / 0.5)), 0.001));
    knot.position.y = 1.15 * tall + NECK_H * lerp(1, 0.75, tie) - 0.02;
  }
  return { group: group, setTie: setTie };
}

function bagTexture(THREE) {
  return canvasTexture(THREE, 1024, 256, function (g, w, h) {
    g.fillStyle = "#f6f6f2";
    g.fillRect(0, 0, w, h);
    // 옆면 가운데 초록 띠 두 줄
    g.fillStyle = "#2f8f5b";
    g.fillRect(0, h * 0.3, w, h * 0.13);
    g.fillRect(0, h * 0.47, w, h * 0.04);
  });
}

function tissue(THREE, rand, size) {
  const geo = new THREE.IcosahedronGeometry(size, 1);
  const pos = geo.attributes.position;
  // 위치로 구김 정도를 정해서 이음매가 벌어지지 않게 함
  const a = rand() * 10;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const k = 1 + 0.18 * Math.sin(x * 31 + a) * Math.sin(y * 27 + a) * Math.sin(z * 29 + a);
    pos.setXYZ(i, x * k, y * k, z * k);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.95, flatShading: true }));
  m.rotation.set(rand() * 3, rand() * 3, 0);
  return m;
}

function sponge(THREE) {
  const g = new THREE.Group();
  const soft = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.26), new THREE.MeshStandardMaterial({ color: 0xf2c94c, roughness: 0.95 }));
  const scrub = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 0.26), new THREE.MeshStandardMaterial({ color: 0x3f9b54, roughness: 0.95 }));
  scrub.position.y = 0.085;
  g.add(soft, scrub);
  g.rotation.y = 0.5;
  return g;
}

function leaf(THREE, color) {
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.2);
  shape.quadraticCurveTo(0.16, -0.05, 0, 0.2);
  shape.quadraticCurveTo(-0.16, -0.05, 0, -0.2);
  const m = new THREE.Mesh(new THREE.ShapeGeometry(shape, 8), new THREE.MeshStandardMaterial({ color: color, roughness: 0.8, side: THREE.DoubleSide }));
  m.rotation.set(-Math.PI / 2 + 0.15, 0, 0.8);
  return m;
}

function can(THREE) {
  const g = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0xd9dde2, metalness: 0.8, roughness: 0.3 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.42, 28), metal);
  body.position.y = 0.21;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.133, 0.133, 0.26, 28, 1, true), new THREE.MeshStandardMaterial({ color: 0xd8432f, metalness: 0.3, roughness: 0.4 }));
  band.position.y = 0.21;
  g.add(body, band);
  return g;
}

function glassBottle(THREE) {
  const m = new THREE.Mesh(
    new THREE.LatheGeometry(densePoints(THREE, [[0, 0], [0.15, 0], [0.16, 0.05], [0.16, 0.36], [0.12, 0.46], [0.06, 0.54], [0.06, 0.68], [0.07, 0.7], [0, 0.7]], 2), 32),
    new THREE.MeshStandardMaterial({ color: 0x3e8f4f, metalness: 0.1, roughness: 0.12, transparent: true, opacity: 0.85 })
  );
  return m;
}

function recycleSticker(THREE) {
  return stickerTexture(THREE, 512, 312, "#1f5f9a", function (g, w, h) {
    // 돌고 도는 화살표 세 개
    g.lineWidth = 22;
    g.lineCap = "round";
    g.strokeStyle = "#1f5f9a";
    for (let i = 0; i < 3; i++) {
      const a0 = i * TAU / 3 - Math.PI / 2 + 0.25, a1 = a0 + TAU / 3 - 0.6;
      g.beginPath();
      g.arc(w / 2, h / 2 + 6, 82, a0, a1);
      g.stroke();
      const ex = w / 2 + Math.cos(a1) * 82, ey = h / 2 + 6 + Math.sin(a1) * 82;
      const tx = -Math.sin(a1), ty = Math.cos(a1);
      g.beginPath();
      g.moveTo(ex + tx * 30, ey + ty * 30);
      g.lineTo(ex - ty * 26, ey + tx * 26);
      g.lineTo(ex + ty * 26, ey - tx * 26);
      g.fill();
    }
  });
}

// 벽에 붙는 배출 시간 안내판 (달 + 18:00–23:00)
function timeSign(THREE) {
  return canvasTexture(THREE, 512, 336, function (g, w, h) {
    g.fillStyle = "#1d3b5c";
    g.beginPath();
    g.roundRect(6, 6, w - 12, h - 12, 36);
    g.fill();
    g.fillStyle = "#ffe58a";
    g.beginPath();
    g.arc(w / 2, 108, 60, 0, TAU);
    g.fill();
    g.fillStyle = "#1d3b5c";
    g.beginPath();
    g.arc(w / 2 + 30, 88, 54, 0, TAU);
    g.fill();
    g.fillStyle = "#ffffff";
    g.font = "bold 78px system-ui, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("18:00–23:00", w / 2, 250);
  });
}
