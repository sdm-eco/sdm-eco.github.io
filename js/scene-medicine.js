// 폐의약품 장면
// 서울시 폐의약품 안내: 가루약·알약은 포장된 그대로, 물약·시럽·연고는 마개를 닫아 용기째
// → 주민센터·보건소·구청 등 폐의약품 수거함 (알약은 봉투에 표시·밀봉하면 우체통도 가능, 물약 제외)
import { GROUND, TAU, clamp01, easeInOut, backOut, lerp, canvasTexture, addShadow, stickerTexture } from "./eco3d-util.js?v=20261107p";

const BOX = [0, -0.95];              // 수거함 위치 (x, z)
const SLOT = [0, GROUND + 1.5, -0.42]; // 수거함 투입구

export default {
  // pills 1 = 알약 포장을 그대로 모음, liquid 1 = 물약 마개를 닫아 모음, box 1 = 수거함에 넣음
  states: [
    { pills: 0, liquid: 0, box: 0 },
    { pills: 1, liquid: 0, box: 0 },
    { pills: 1, liquid: 1, box: 0 },
    { pills: 1, liquid: 1, box: 1 }
  ],
  moves: [null, [["pills", 2.0]], [["liquid", 2.2]], [["box", 3.4]]],
  spin: 0.3,
  camera: [1.3, -0.25],
  build: build
};

function build(THREE, scene, spin) {
  scene.add(spin);

  // 알약 포장(PTP): 은박 판 + 투명한 볼록 칸 안의 알약
  const blister = new THREE.Group();
  const foil = new THREE.Mesh(new THREE.BoxGeometry(0.78, 1.12, 0.04), new THREE.MeshStandardMaterial({ color: 0xd9dee2, metalness: 0.8, roughness: 0.3 }));
  blister.add(foil);
  const domeGeo = new THREE.SphereGeometry(0.11, 20, 12, 0, TAU, 0, Math.PI / 2);
  const domeMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.1, transparent: true, opacity: 0.45, clearcoat: 1 });
  const pillGeo = new THREE.CapsuleGeometry(0.06, 0.1, 6, 12);
  const pillMat = new THREE.MeshStandardMaterial({ color: 0xf6f0e4, roughness: 0.5 });
  const pillMat2 = new THREE.MeshStandardMaterial({ color: 0xe86a5a, roughness: 0.4 });
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 2; c++) {
      const x = c ? 0.17 : -0.17, y = 0.39 - r * 0.26;
      const dome = new THREE.Mesh(domeGeo, domeMat);
      dome.rotation.x = Math.PI / 2;
      dome.position.set(x, y, 0.02);
      const pill = new THREE.Mesh(pillGeo, (r + c) % 2 ? pillMat : pillMat2);
      pill.rotation.z = Math.PI / 2;
      pill.position.set(x, y, 0.06);
      blister.add(dome, pill);
    }
  }
  // 조제약 봉투 (약국 약 봉지)
  const packet = new THREE.Mesh(new THREE.BoxGeometry(0.82, 1.05, 0.05), new THREE.MeshStandardMaterial({ map: packetTexture(THREE), roughness: 0.8 }));

  // 시럽병 + 마개, 연고
  const syrup = new THREE.Group();
  const glass = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [0.3, 0], [0.33, 0.06], [0.33, 0.7], [0.22, 0.86], [0.14, 0.9], [0.14, 1.0]].map(function (p) { return new THREE.Vector2(p[0], p[1]); }), 40),
    new THREE.MeshPhysicalMaterial({ color: 0xb4661f, roughness: 0.15, transparent: true, opacity: 0.85, clearcoat: 1 }));
  const label = new THREE.Mesh(new THREE.CylinderGeometry(0.335, 0.335, 0.36, 40, 1, true), new THREE.MeshStandardMaterial({ map: syrupLabel(THREE), roughness: 0.6 }));
  label.position.y = 0.36;
  syrup.add(glass, label);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.2, 24), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }));
  const tube = new THREE.Group();
  const tubeBody = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.13, 0.85, 24), new THREE.MeshStandardMaterial({ map: tubeTexture(THREE), roughness: 0.4, metalness: 0.2 }));
  const crimp = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.08, 0.04), tubeBody.material);
  crimp.position.y = 0.45;
  const tubeCap = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.16, 16), new THREE.MeshStandardMaterial({ color: 0x2f6fd0, roughness: 0.4 }));
  tubeCap.position.y = -0.5;
  tube.add(tubeBody, crimp, tubeCap);

  // 처음 자리 (x, y, z, 기울기)
  const items = [
    { obj: blister, home: [-1.5, GROUND + 0.6, 0.45], rot: [-0.15, 0.25, 0] },
    { obj: packet, home: [-0.65, GROUND + 0.55, 0.55], rot: [-0.1, -0.15, 0.05] },
    { obj: syrup, home: [0.7, GROUND, 0.5], rot: [0, 0, 0] },
    { obj: tube, home: [1.5, GROUND + 0.16, 0.6], rot: [0, 0.4, Math.PI / 2] }
  ];
  items.forEach(function (it) { spin.add(it.obj); });
  spin.add(cap);

  const shadows = items.map(function (it) {
    const sh = addShadow(THREE, scene, 1.2);
    spin.add(sh);
    sh.position.set(it.home[0], GROUND + 0.005, it.home[2]);
    return sh;
  });

  // 폐의약품 수거함: 초록 상자, 위쪽 앞면에 투입구, 앞면 스티커
  const box = new THREE.Group();
  const green = new THREE.MeshStandardMaterial({ color: 0x3c9a5f, roughness: 0.55 });
  const shell = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.8, 1.0), green);
  shell.position.y = 0.9;
  const lid = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.12, 1.1), new THREE.MeshStandardMaterial({ color: 0x2a7447, roughness: 0.5 }));
  lid.position.y = 1.86;
  const slot = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.12, 0.02), new THREE.MeshBasicMaterial({ color: 0x14261b }));
  slot.position.set(0, 1.5, 0.51);
  const sticker = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.7), new THREE.MeshStandardMaterial({ map: medSticker(THREE), roughness: 0.5, transparent: true }));
  sticker.position.set(0, 0.78, 0.51);
  box.add(shell, lid, slot, sticker);
  box.position.set(BOX[0], GROUND, BOX[1]);
  box.visible = false;
  spin.add(box);
  const boxShadow = addShadow(THREE, scene, 2.4);
  spin.add(boxShadow);
  boxShadow.position.set(BOX[0], GROUND + 0.004, BOX[1]);

  const p = new THREE.Vector3();

  function update(v) {
    // 1단계: 알약 포장·약 봉지가 뜯지 않은 그대로 통통 뛰며 강조됨
    const hop = function (t) { return Math.sin(Math.PI * clamp01(t)) * 0.45; };
    const pp = v.pills;
    // 2단계: 시럽병 마개가 날아와 돌며 닫히고, 연고가 일어섬
    const lq = easeInOut(v.liquid);
    // 3단계: 수거함이 나타나고, 물건이 하나씩 투입구로 들어감
    const bp = v.box;
    box.visible = bp > 0;
    box.scale.setScalar(Math.max(backOut(clamp01(bp / 0.25)), 0.001));
    boxShadow.material.opacity = clamp01(bp / 0.25);

    items.forEach(function (it, i) {
      const h = it.home;
      let x = h[0], y = h[1], z = h[2];
      let rx = it.rot[0], ry = it.rot[1], rz = it.rot[2];
      if (i < 2) y += hop((pp - i * 0.25) / 0.6);
      if (i === 3) { rz = lerp(rz, 0, lq); y = lerp(h[1], GROUND + 0.51, lq); }
      const q = easeInOut(clamp01((bp - 0.25 - i * 0.17) / 0.24));
      let s = 1;
      if (q > 0) {
        p.set(lerp(x, SLOT[0], q), lerp(y, SLOT[1], q) + Math.sin(Math.PI * q) * 1.0, lerp(z, SLOT[2], q));
        x = p.x; y = p.y; z = p.z;
        rx = lerp(rx, 0, q); ry = lerp(ry, 0, q); rz = lerp(rz, 0, q);
        s = q > 0.8 ? lerp(1, 0.15, (q - 0.8) / 0.2) : 1;
      }
      it.obj.position.set(x, y, z);
      it.obj.rotation.set(rx, ry, rz);
      it.obj.scale.setScalar(s);
      it.obj.visible = q < 1;
      shadows[i].material.opacity = q > 0 ? 0 : 1;
    });

    // 시럽 마개: 바닥에 있다가 → 떠올라 돌며 병 입구에 닫힘 → 이후 병과 함께 움직임
    const sp = items[2].obj;
    const capOn = [sp.position.x, sp.position.y + 1.02 * sp.scale.x, sp.position.z];
    const capOff = [0.15, GROUND + 0.1, 1.0]; // 시럽병 왼쪽 앞 바닥 (연고와 겹치지 않게)
    if (lq < 1) {
      const arc = Math.sin(Math.PI * lq) * 0.9;
      cap.position.set(lerp(capOff[0], capOn[0], lq), lerp(capOff[1], capOn[1], lq) + arc, lerp(capOff[2], capOn[2], lq));
      cap.rotation.set(lerp(Math.PI / 2, 0, lq), lq * 4 * Math.PI, 0);
    } else {
      cap.position.set(capOn[0], capOn[1], capOn[2]);
      cap.rotation.set(0, 0, 0);
    }
    cap.scale.setScalar(sp.scale.x);
    cap.visible = sp.visible;
  }

  return { update: update };
}

function packetTexture(THREE) {
  return canvasTexture(THREE, 256, 330, function (g, w, h) {
    g.fillStyle = "#fbfbf7";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#4f9d6b";
    g.fillRect(0, 0, w, 46);
    g.fillStyle = "#ffffff";
    g.fillRect(w / 2 - 8, 8, 16, 30);
    g.fillRect(w / 2 - 15, 15, 30, 16);
    g.fillStyle = "#c9d2cc";
    for (let i = 0; i < 5; i++) g.fillRect(28, 90 + i * 34, w - 56 - (i % 2) * 40, 12);
    g.fillStyle = "#e86a5a";
    g.beginPath();
    g.ellipse(w * 0.7, h * 0.86, 26, 14, 0.4, 0, TAU);
    g.fill();
  });
}

function syrupLabel(THREE) {
  return canvasTexture(THREE, 512, 128, function (g, w, h) {
    g.fillStyle = "#ffffff";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#4f9d6b";
    g.fillRect(0, 0, w, 22);
    g.fillStyle = "#b9c4bd";
    for (let i = 0; i < 6; i++) g.fillRect(40 + i * 70, 54, 40, 10);
    g.fillRect(40, 84, 300, 10);
  });
}

function tubeTexture(THREE) {
  return canvasTexture(THREE, 256, 256, function (g, w, h) {
    g.fillStyle = "#f2f4f6";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#2f6fd0";
    g.fillRect(0, h * 0.35, w, h * 0.3);
    g.fillStyle = "#ffffff";
    g.fillRect(w * 0.1, h * 0.45, w * 0.8, h * 0.08);
  });
}

function medSticker(THREE) {
  return stickerTexture(THREE, 512, 312, "#2a7447", function (g, w, h) {
    // 캡슐 알약 + 약병 아이콘
    g.save();
    g.translate(160, h / 2);
    g.rotate(-0.6);
    g.beginPath();
    g.roundRect(-110, -42, 220, 84, 42);
    g.fill();
    g.fillStyle = "#ffffff";
    g.beginPath();
    g.roundRect(0, -32, 100, 64, [0, 32, 32, 0]);
    g.fill();
    g.restore();
    g.fillStyle = "#2a7447";
    g.beginPath();
    g.roundRect(320, 110, 110, 150, 16);
    g.fill();
    g.fillRect(345, 76, 60, 36);
    g.fillStyle = "#ffffff";
    g.fillRect(366, 150, 18, 70);
    g.fillRect(340, 176, 70, 18);
  });
}
