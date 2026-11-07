// 폐건전지·폐형광등 장면
// 서대문구 폐금속자원 배출 안내: 공동주택은 단지 내 수거함, 단독주택은 인근 주민센터·주택 골목 수거함
// (LED·전등 케이스·일반 전구는 넣으면 안 됨 → 재활용품 안내: 백열·LED 전구는 종량제 봉투)
import { GROUND, TAU, clamp01, easeInOut, backOut, lerp, canvasTexture, addShadow, stickerTexture } from "./eco3d-util.js?v=20261107s";

const BOX = [0, -0.85];                // 수거함 위치 (x, z)
const HOLE = [-0.38, GROUND + 1.25, -0.39]; // 건전지 넣는 구멍 (앞면)
const TOP = GROUND + 1.9;              // 수거함 윗면 높이 (형광등 넣는 긴 틈)
const TUBE_L = 1.6;                    // 형광등 길이

export default {
  // cells 1 = 건전지를 빼서 모음, tube 1 = 형광등을 조심히 내려놓음, box 1 = 수거함에 넣음
  states: [
    { cells: 0, tube: 0, box: 0 },
    { cells: 1, tube: 0, box: 0 },
    { cells: 1, tube: 1, box: 0 },
    { cells: 1, tube: 1, box: 1 }
  ],
  moves: [null, [["cells", 2.2]], [["tube", 2.2]], [["box", 3.6]]],
  spin: 0.3,
  camera: [1.3, -0.25],
  build: build
};

function build(THREE, scene, spin) {
  scene.add(spin);

  // 리모컨 (세워 둠)
  const remote = new THREE.Group();
  const rBody = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.5, 0.16), new THREE.MeshStandardMaterial({ color: 0x2d3436, roughness: 0.45 }));
  remote.add(rBody);
  const keyMat = new THREE.MeshStandardMaterial({ color: 0x8a9499, roughness: 0.5 });
  for (let i = 0; i < 9; i++) {
    const k = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.04, 14), keyMat);
    k.rotation.x = Math.PI / 2;
    k.position.set(((i % 3) - 1) * 0.14, 0.05 - Math.floor(i / 3) * 0.17, 0.09);
    remote.add(k);
  }
  const power = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.04, 16), new THREE.MeshStandardMaterial({ color: 0xd8433b, roughness: 0.4 }));
  power.rotation.x = Math.PI / 2;
  power.position.set(0, 0.5, 0.09);
  remote.add(power);
  remote.position.set(-1.6, GROUND + 0.75, 0.35);
  remote.rotation.set(-0.12, 0.35, 0);
  spin.add(remote);

  // 건전지: 리모컨 속 2개 + 미리 모아 둔 2개 (눕혀 놓음)
  const cellGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.5, 24);
  const cellMat = new THREE.MeshStandardMaterial({ map: cellTexture(THREE), roughness: 0.4, metalness: 0.3 });
  const nubGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.05, 12);
  const nubMat = new THREE.MeshStandardMaterial({ color: 0xd0d6da, metalness: 0.9, roughness: 0.25 });
  function cell() {
    const g = new THREE.Group();
    const b = new THREE.Mesh(cellGeo, cellMat);
    const n = new THREE.Mesh(nubGeo, nubMat);
    n.position.y = 0.27;
    g.add(b, n);
    spin.add(g);
    return g;
  }
  // [처음 자리, 모은 자리]
  const PILE = [[-0.95, GROUND + 0.1, 0.75], [-0.72, GROUND + 0.1, 0.75], [-0.835, GROUND + 0.27, 0.75], [-0.6, GROUND + 0.1, 0.62]];
  const cells = [
    { obj: cell(), from: [-1.68, GROUND + 1.2, 0.3], to: PILE[2] },
    { obj: cell(), from: [-1.52, GROUND + 1.2, 0.3], to: PILE[3] },
    { obj: cell(), from: PILE[0], to: PILE[0] },
    { obj: cell(), from: PILE[1], to: PILE[1] }
  ];

  // 형광등: 하얀 유리관 + 양 끝 금속 마개와 핀
  const tube = new THREE.Group();
  const glassMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25, emissive: 0xeaf6ff, emissiveIntensity: 0.15 });
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, TUBE_L - 0.16, 24), glassMat);
  tube.add(glass);
  [-1, 1].forEach(function (sd) {
    const endCap = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.08, 24), nubMat);
    endCap.position.y = sd * (TUBE_L / 2 - 0.04);
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.08, 6), nubMat);
    pin.position.set(0.03, sd * (TUBE_L / 2 + 0.03), 0);
    const pin2 = pin.clone();
    pin2.position.x = -0.03;
    tube.add(endCap, pin, pin2);
  });
  tube.visible = false;
  spin.add(tube);
  const TUBE_HOME = [0.75, GROUND + 0.09, 0.7];

  const shadow = addShadow(THREE, scene, 2.2);
  spin.add(shadow);
  shadow.position.set(-1.1, GROUND + 0.005, 0.5);
  const tubeShadow = addShadow(THREE, scene, 1.6);
  spin.add(tubeShadow);
  tubeShadow.position.set(TUBE_HOME[0], GROUND + 0.004, TUBE_HOME[2]);
  tubeShadow.scale.set(1.3, 1, 0.35);

  // 수거함: 노란 상자, 앞면 둥근 구멍(건전지)과 윗면 긴 틈(형광등)
  const box = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.9, 0.9), new THREE.MeshStandardMaterial({ color: 0xf0b030, roughness: 0.5 }));
  shell.position.y = 0.95;
  const dark = new THREE.MeshBasicMaterial({ color: 0x2b2310 });
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.16, 24), dark);
  hole.position.set(HOLE[0] - BOX[0], HOLE[1] - GROUND, 0.452);
  const slit = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.7), dark);
  slit.rotation.x = -Math.PI / 2;
  slit.position.set(0.42, 1.902, 0);
  const sticker = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.62), new THREE.MeshStandardMaterial({ map: boxSticker(THREE), roughness: 0.5, transparent: true }));
  sticker.position.set(0, 0.6, 0.452);
  box.add(shell, hole, slit, sticker);
  box.position.set(BOX[0], GROUND, BOX[1]);
  box.visible = false;
  spin.add(box);
  const boxShadow = addShadow(THREE, scene, 2.6);
  spin.add(boxShadow);
  boxShadow.position.set(BOX[0], GROUND + 0.003, BOX[1]);

  function update(v) {
    // 1단계: 리모컨에서 건전지 2개가 빠져나와 모아 둔 건전지 옆으로
    const cp = v.cells;
    const bp = v.box;
    box.visible = bp > 0;
    box.scale.setScalar(Math.max(backOut(clamp01(bp / 0.22)), 0.001));
    boxShadow.material.opacity = clamp01(bp / 0.22);

    cells.forEach(function (c, i) {
      let x, y, z, rz;
      if (i < 2) {
        const t = easeInOut(clamp01((cp - i * 0.25) / 0.6));
        const up = clamp01(t / 0.3); // 위로 쏙 빠짐 → 포물선으로 내려앉음
        const q = clamp01((t - 0.3) / 0.7);
        x = lerp(c.from[0], c.to[0], q);
        z = lerp(c.from[2], c.to[2], q);
        y = lerp(c.from[1] + up * 0.45, c.to[1], q) + Math.sin(Math.PI * q) * 0.4;
        rz = lerp(0, Math.PI / 2, q);
        c.obj.visible = t > 0; // 리모컨 속에 있을 때는 숨김
      } else {
        x = c.from[0]; y = c.from[1]; z = c.from[2]; rz = Math.PI / 2;
        c.obj.visible = true;
      }
      // 3단계: 하나씩 앞면 구멍으로 들어감
      const q = easeInOut(clamp01((bp - 0.22 - i * 0.1) / 0.22));
      let s = 1;
      if (q > 0) {
        x = lerp(x, HOLE[0], q);
        y = lerp(y, HOLE[1], q) + Math.sin(Math.PI * q) * 0.6;
        z = lerp(z, HOLE[2] + 0.1, q);
        rz = lerp(rz, 0, q); // 앞으로 눕혀(구멍 쪽을 향해) 들어감
        s = q > 0.8 ? lerp(1, 0.2, (q - 0.8) / 0.2) : 1;
        c.obj.visible = q < 1;
      }
      c.obj.position.set(x, y, z);
      c.obj.rotation.set(Math.PI / 2 * (q > 0 ? q : 0), 0, rz);
      c.obj.scale.setScalar(s);
    });

    // 2단계: 형광등이 위에서 천천히 내려와 살며시 놓임(놓인 뒤 은은하게 빛남)
    const tp = v.tube;
    tube.visible = tp > 0;
    const down = easeInOut(clamp01(tp / 0.8));
    let tx = TUBE_HOME[0], ty = lerp(GROUND + 2.4, TUBE_HOME[1], down), tz = TUBE_HOME[2];
    let trz = Math.PI / 2;
    glassMat.emissiveIntensity = 0.15 + Math.sin(Math.PI * clamp01((tp - 0.6) / 0.4)) * 0.6;
    tubeShadow.material.opacity = down * 0.8;
    // 3단계: 세워서 윗면 긴 틈으로 쏙 들어감
    const q = easeInOut(clamp01((bp - 0.62) / 0.38));
    if (q > 0) {
      const rise = clamp01(q / 0.55), sink = clamp01((q - 0.55) / 0.45);
      tx = lerp(TUBE_HOME[0], BOX[0] + 0.42, rise);
      tz = lerp(TUBE_HOME[2], BOX[1], rise);
      trz = lerp(Math.PI / 2, 0, rise);
      ty = lerp(TUBE_HOME[1], TOP + TUBE_L / 2 + 0.15, rise) - sink * (TUBE_L + 0.25);
      tubeShadow.material.opacity = (1 - rise) * 0.8;
      tube.visible = sink < 1;
    }
    tube.position.set(tx, ty, tz);
    tube.rotation.set(0, 0, trz);
  }

  return { update: update };
}

function cellTexture(THREE) {
  return canvasTexture(THREE, 256, 256, function (g, w, h) {
    g.fillStyle = "#2f8f5b";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#1f2a24";
    g.fillRect(0, 0, w, h * 0.3);
    g.fillStyle = "#d4f29a";
    g.fillRect(0, h * 0.3, w, 10);
  });
}

function boxSticker(THREE) {
  return stickerTexture(THREE, 512, 244, "#b07a10", function (g, w, h) {
    // 건전지 아이콘 + 형광등 아이콘
    g.beginPath();
    g.roundRect(60, 90, 150, 64, 10);
    g.fill();
    g.fillRect(210, 108, 16, 28);
    g.beginPath();
    g.roundRect(270, 104, 190, 36, 18);
    g.fill();
    g.fillStyle = "#ffffff";
    g.fillRect(84, 112, 40, 20);
    g.fillRect(290, 116, 150, 12);
  });
}
