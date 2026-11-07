// 폐건전지·폐형광등 장면 (클레이 스타일)
// 서대문구 폐금속자원 배출 안내: 공동주택은 단지 내 수거함, 단독주택은 인근 주민센터·주택 골목 수거함
// (LED·전등 케이스·일반 전구는 넣으면 안 됨 → 재활용품 안내: 백열·LED 전구는 종량제 봉투)
import { GROUND, clamp01, smooth, easeInOut, backOut, lerp, canvasTexture, stickerTexture, CLAY, clayMat, bounceDrop, wobble } from "./eco3d-util.js?v=20261108h";
import { sfx, hit } from "./eco3d-sound.js?v=20261108h";

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
  clay: true, // 클레이 스타일 조명·그림자 (eco3d.js)
  build: build
};

function build(THREE, scene, spin, ext) {
  scene.add(spin);

  // 리모컨 (세워 둠): 둥근 파스텔 파랑 몸통 + 크림 버튼 + 산호색 전원
  const remote = new THREE.Group();
  const rBody = new THREE.Mesh(rbox(THREE, ext, 0.5, 1.5, 0.18, 0.08), clayMat(THREE, CLAY.blue));
  remote.add(rBody);
  const keyMat = clayMat(THREE, CLAY.white);
  const keyGeo = new THREE.SphereGeometry(0.055, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  for (let i = 0; i < 9; i++) {
    const k = new THREE.Mesh(keyGeo, keyMat);
    k.rotation.x = Math.PI / 2;
    k.scale.y = 0.5;
    k.position.set(((i % 3) - 1) * 0.14, 0.05 - Math.floor(i / 3) * 0.17, 0.09);
    remote.add(k);
  }
  const power = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), clayMat(THREE, CLAY.coral));
  power.rotation.x = Math.PI / 2;
  power.scale.y = 0.5;
  power.position.set(0, 0.5, 0.09);
  remote.add(power);
  const REMOTE_Y = GROUND + 0.75;
  remote.position.set(-1.6, REMOTE_Y, 0.35);
  remote.rotation.set(-0.12, 0.35, 0);
  spin.add(remote);

  // 건전지: 리모컨 속 2개 + 미리 모아 둔 2개 (눕혀 놓음)
  const cellGeo = new THREE.CapsuleGeometry(0.1, 0.32, 4, 20);
  const cellMat = clayMat(THREE, 0xffffff, { map: cellTexture(THREE), roughness: 0.45, clearcoat: 0.4 });
  const nubGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.06, 12);
  const nubMat = clayMat(THREE, CLAY.silver, { metalness: 0.4, roughness: 0.35 });
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

  // 형광등: 하얀 유리관 + 양 끝 은색 마개와 핀
  const tube = new THREE.Group();
  const glassMat = clayMat(THREE, 0xffffff, { roughness: 0.3, clearcoat: 0.6, emissive: 0xeaf6ff, emissiveIntensity: 0.15 });
  const glass = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, TUBE_L - 0.24, 4, 24), glassMat);
  tube.add(glass);
  [-1, 1].forEach(function (sd) {
    const endCap = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.1, 24), nubMat);
    endCap.position.y = sd * (TUBE_L / 2 - 0.05);
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.08, 6), nubMat);
    pin.position.set(0.03, sd * (TUBE_L / 2 + 0.03), 0);
    const pin2 = pin.clone();
    pin2.position.x = -0.03;
    tube.add(endCap, pin, pin2);
  });
  tube.visible = false;
  spin.add(tube);
  const TUBE_HOME = [0.75, GROUND + 0.1, 0.7];

  // 수거함: 둥근 파스텔 노랑 상자, 앞면 둥근 구멍(건전지)과 윗면 긴 틈(형광등)
  const box = new THREE.Group();
  const shell = new THREE.Mesh(rbox(THREE, ext, 1.7, 1.9, 0.9, 0.14), clayMat(THREE, CLAY.yellow));
  shell.position.y = 0.95;
  const dark = new THREE.MeshBasicMaterial({ color: 0x8a6a33 });
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.16, 32), dark);
  hole.position.set(HOLE[0] - BOX[0], HOLE[1] - GROUND, 0.452);
  const holeRim = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.03, 10, 32), clayMat(THREE, CLAY.yellowDeep));
  holeRim.position.copy(hole.position);
  const slit = new THREE.Mesh(rbox(THREE, ext, 0.22, 0.02, 0.7, 0.009), dark);
  slit.position.set(0.42, 1.9, 0);
  const sticker = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.62), new THREE.MeshStandardMaterial({ map: boxSticker(THREE), roughness: 0.6, transparent: true }));
  sticker.position.set(0, 0.6, 0.452);
  box.add(shell, hole, holeRim, slit, sticker);
  box.position.set(BOX[0], GROUND, BOX[1]);
  box.visible = false;
  spin.add(box);

  const CELL_IN = 0.22, CELL_GAP = 0.1, CELL_FLY = 0.22; // 수거함 단계: 건전지 출발, 간격, 날아가는 시간

  function update(v) {
    const cp = v.cells;
    const bp = v.box;

    // 3단계 시작: 수거함이 위에서 떨어져 통통 → 물건이 들어갈 때마다 출렁
    box.visible = bp > 0;
    const bt = clamp01(bp / 0.2);
    box.position.y = GROUND + bounceDrop(bt) * 2.2;
    let kick = bt > 0.58 && bt < 0.82 ? Math.sin(Math.PI * (bt - 0.58) / 0.24) * 1.4 : 0;
    for (let i = 0; i < cells.length; i++) kick += wobble(clamp01((bp - CELL_IN - i * CELL_GAP - CELL_FLY * 0.9) / 0.1), 1) * 0.7;
    kick += wobble(clamp01((bp - 0.88) / 0.12), 2);
    const bsy = 1 - kick * 0.06;
    box.scale.set(1 / Math.sqrt(bsy), bsy, 1 / Math.sqrt(bsy));
    box.rotation.z = wobble(clamp01((bt - 0.6) / 0.4), 2) * 0.04;

    // 1단계: 리모컨이 꾹 움츠렸다가 건전지 2개가 쏙 튀어나와 → 포물선으로 날아가 모아 둔 건전지 옆에 통통 내려앉음
    let pinch = 0;
    cells.forEach(function (c, i) {
      let x, y, z, rz, rx = 0;
      let s = 1;
      if (i < 2) {
        const t = clamp01((cp - i * 0.25) / 0.6);
        pinch += t > 0 && t < 0.2 ? Math.sin(Math.PI * t / 0.2) : 0;
        const up = backOut(clamp01(t / 0.25));  // 위로 쏙 빠짐
        const q = clamp01((t - 0.25) / 0.75);
        const go = easeInOut(Math.min(q / 0.6, 1)); // 바닥에 닿을 때(0.6) 옮기기 끝
        const topY = c.from[1] + 0.45;
        x = lerp(c.from[0], c.to[0], go);
        z = lerp(c.from[2], c.to[2], go);
        y = q > 0 ? c.to[1] + bounceDrop(q) * (topY - c.to[1]) + Math.sin(Math.PI * Math.min(q / 0.6, 1)) * 0.3 : c.from[1] + up * 0.45;
        rz = go * Math.PI / 2 + wobble(clamp01((q - 0.6) / 0.4), 2) * 0.15;
        c.obj.visible = t > 0; // 리모컨 속에 있을 때는 숨김
      } else {
        x = c.from[0]; y = c.from[1]; z = c.from[2]; rz = Math.PI / 2;
        c.obj.visible = true;
      }
      // 3단계: 움찔한 뒤 하나씩 포물선으로 날아 앞면 구멍으로 쏙
      const start = CELL_IN + i * CELL_GAP;
      const hop = bp > start - 0.05 && bp < start ? Math.sin(Math.PI * (bp - start + 0.05) / 0.05) * 0.06 : 0;
      y += hop;
      const raw = clamp01((bp - start) / CELL_FLY);
      const q = easeInOut(raw);
      if (raw > 0) {
        x = lerp(x, HOLE[0], q);
        y = lerp(y, HOLE[1], q) + Math.sin(Math.PI * q) * 0.6;
        z = lerp(z, HOLE[2] + 0.1, q);
        rz = lerp(rz, 0, q);
        rx = Math.PI / 2 * q; // 앞으로 눕혀(구멍 쪽을 향해) 들어감
        s = q > 0.75 ? lerp(1, 0.15, smooth(0.75, 1, q)) : 1;
        c.obj.visible = raw < 1;
      }
      c.obj.position.set(x, y, z);
      c.obj.rotation.set(rx, 0, rz);
      c.obj.scale.setScalar(s);
    });
    const rsy = 1 - pinch * 0.06;
    remote.scale.set(1 / Math.sqrt(rsy), rsy, 1 / Math.sqrt(rsy));
    remote.position.y = REMOTE_Y - (1 - rsy) * 0.75;

    // 2단계: 형광등이 위에서 점점 느려지며 내려와 살며시 놓이고(작게 흔들림) 은은하게 빛남
    const tp = v.tube;
    tube.visible = tp > 0;
    const dq = clamp01(tp / 0.75);
    const down = 1 - Math.pow(1 - dq, 3);
    let tx = TUBE_HOME[0], ty = lerp(GROUND + 2.4, TUBE_HOME[1], down), tz = TUBE_HOME[2];
    let trz = Math.PI / 2, trx = wobble(clamp01((tp - 0.72) / 0.28), 2) * 0.05, ts = 1;
    glassMat.emissiveIntensity = 0.15 + Math.sin(Math.PI * clamp01((tp - 0.6) / 0.4)) * 0.6;
    // 3단계: 살짝 가라앉았다(준비) 앞에서 일어서며 떠오름 → 수거함 위로 옮겨감 → 윗면 긴 틈으로 점점 빠르게 쏙
    // (일어선 뒤에 뒤로 옮겨야 아랫부분이 수거함을 뚫고 지나가지 않음)
    const q = clamp01((bp - 0.6) / 0.4);
    if (q > 0) {
      const prep = q < 0.12 ? Math.sin(Math.PI * q / 0.12) : 0;
      const rise = easeInOut(clamp01((q - 0.1) / 0.3)), slide = easeInOut(clamp01((q - 0.36) / 0.24));
      const sk = clamp01((q - 0.6) / 0.35), sink = sk * sk;
      tx = lerp(TUBE_HOME[0], BOX[0] + 0.42, rise);
      tz = lerp(TUBE_HOME[2], BOX[1], slide);
      trz = Math.PI / 2 * (1 - backOut(clamp01((q - 0.1) / 0.3)));
      // 화면 위로 잘리지 않게 일어서며 조금 작아짐
      ts = lerp(1, 0.8, rise);
      ty = lerp(TUBE_HOME[1], TOP + TUBE_L * 0.4 + 0.1, rise) - sink * (TUBE_L * 0.8 + 0.25) - prep * 0.03;
      trx = 0;
      tube.visible = sk < 1;
    }
    tube.position.set(tx, ty, tz);
    tube.rotation.set(trx, 0, trz);
    tube.scale.setScalar(ts);

    // 효과음 (체험 창에서 효과음을 켰을 때만): 진행률이 그 순간을 지날 때 한 번
    if (hit(v, "cells", 0.06)) sfx.play("pop");                          // 건전지 쏙 빠짐
    if (hit(v, "cells", 0.42) || hit(v, "cells", 0.67)) sfx.play("tap"); // 모은 자리에 톡톡
    if (hit(v, "tube", 0.74)) sfx.play("clink");                         // 형광등 살며시 놓임
    if (hit(v, "box", 0.12)) sfx.play("thud");                           // 수거함 쿵
    if (hit(v, "box", CELL_IN + CELL_FLY * 0.9) || hit(v, "box", CELL_IN + 2 * CELL_GAP + CELL_FLY * 0.9)) sfx.play("rattle"); // 구멍에 달그락 (4개 중 두 번만)
    if (hit(v, "box", 0.86)) sfx.play("slide");                          // 형광등 긴 틈으로 쏙
    if (hit(v, "box", 0.95)) sfx.play("chime");                          // 끝 띵동
  }

  return { update: update };
}

// 둥근 모서리 상자 (부가 도구가 없으면 보통 상자)
function rbox(THREE, ext, w, h, d, r) {
  return ext && ext.RoundedBoxGeometry ? new ext.RoundedBoxGeometry(w, h, d, 4, r) : new THREE.BoxGeometry(w, h, d);
}

// 건전지 겉면: 민트 몸통 + 진초록 띠 + 크림 줄
function cellTexture(THREE) {
  return canvasTexture(THREE, 256, 256, function (g, w, h) {
    g.fillStyle = "#6cc596";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#3f8a64";
    g.fillRect(0, 0, w, h * 0.3);
    g.fillStyle = "#fff6e6";
    g.fillRect(0, h * 0.3, w, 10);
  });
}

function boxSticker(THREE) {
  return stickerTexture(THREE, 512, 244, "#c98d1f", function (g, w, h) {
    // 건전지 아이콘 + 형광등 아이콘
    g.beginPath();
    g.roundRect(60, 90, 150, 64, 14);
    g.fill();
    g.beginPath();
    g.roundRect(208, 108, 18, 28, 5);
    g.fill();
    g.beginPath();
    g.roundRect(270, 104, 190, 36, 18);
    g.fill();
    g.fillStyle = "#ffffff";
    g.beginPath();
    g.roundRect(84, 112, 40, 20, 6);
    g.roundRect(290, 116, 150, 12, 6);
    g.fill();
  });
}
