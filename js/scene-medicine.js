// 폐의약품 장면 (클레이 스타일)
// 서울시 폐의약품 안내: 가루약·알약은 포장된 그대로, 물약·시럽·연고는 마개를 닫아 용기째
// → 주민센터·보건소·구청 등 폐의약품 수거함 (알약은 봉투에 표시·밀봉하면 우체통도 가능, 물약 제외)
import { GROUND, TAU, clamp01, smooth, easeInOut, backOut, lerp, canvasTexture, stickerTexture, CLAY, clayMat, bounceDrop, wobble } from "./eco3d-util.js?v=20261108i";
import { sfx, hit } from "./eco3d-sound.js?v=20261108i";

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
  clay: true, // 클레이 스타일 조명·그림자 (eco3d.js)
  build: build
};

function build(THREE, scene, spin, ext) {
  scene.add(spin);

  // 알약 포장(PTP): 둥근 은박 판 + 투명한 볼록 칸 안의 크림·산호색 알약
  const blister = new THREE.Group();
  const foil = new THREE.Mesh(rbox(THREE, ext, 0.78, 1.12, 0.05, 0.022), clayMat(THREE, CLAY.silver, { metalness: 0.3, roughness: 0.4, clearcoat: 0.4 }));
  blister.add(foil);
  const domeGeo = new THREE.SphereGeometry(0.11, 20, 12, 0, TAU, 0, Math.PI / 2);
  const domeMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.1, transparent: true, opacity: 0.45, clearcoat: 1 });
  const pillGeo = new THREE.CapsuleGeometry(0.06, 0.1, 6, 12);
  const pillMat = clayMat(THREE, CLAY.cream);
  const pillMat2 = clayMat(THREE, CLAY.coral);
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 2; c++) {
      const x = c ? 0.17 : -0.17, y = 0.39 - r * 0.26;
      const dome = new THREE.Mesh(domeGeo, domeMat);
      dome.rotation.x = Math.PI / 2;
      dome.position.set(x, y, 0.025);
      const pill = new THREE.Mesh(pillGeo, (r + c) % 2 ? pillMat : pillMat2);
      pill.rotation.z = Math.PI / 2;
      pill.position.set(x, y, 0.065);
      blister.add(dome, pill);
    }
  }
  // 조제약 봉투 (약국 약 봉지): 둥근 크림 봉투 + 앞면 그림
  const packet = new THREE.Group();
  const bag = new THREE.Mesh(rbox(THREE, ext, 0.82, 1.05, 0.07, 0.03), clayMat(THREE, CLAY.cream));
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.76, 0.99), new THREE.MeshStandardMaterial({ map: packetTexture(THREE), roughness: 0.7 }));
  face.position.z = 0.036;
  face.userData.noShadow = true;
  packet.add(bag, face);

  // 시럽병(호박색 점토) + 마개, 연고
  const syrup = new THREE.Group();
  const glass = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [0.28, 0], [0.33, 0.06], [0.33, 0.7], [0.22, 0.86], [0.14, 0.9], [0.14, 1.0], [0, 1.0]].map(function (p) { return new THREE.Vector2(p[0], p[1]); }), 40),
    clayMat(THREE, 0xe0a466, { roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.2 }));
  const label = new THREE.Mesh(new THREE.CylinderGeometry(0.335, 0.335, 0.36, 40, 1, true), clayMat(THREE, 0xffffff, { map: syrupLabel(THREE), sheen: 0.2 }));
  label.position.y = 0.36;
  syrup.add(glass, label);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.2, 24), clayMat(THREE, CLAY.white));
  const tube = new THREE.Group();
  const tubeMat = clayMat(THREE, 0xffffff, { map: tubeTexture(THREE), roughness: 0.45, clearcoat: 0.4 });
  const tubeBody = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.13, 0.85, 24), tubeMat);
  const crimp = new THREE.Mesh(rbox(THREE, ext, 0.34, 0.08, 0.05, 0.02), tubeMat);
  crimp.position.y = 0.45;
  const tubeCap = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.16, 16), clayMat(THREE, CLAY.blueDeep));
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

  // 폐의약품 수거함: 둥근 초록 상자, 진초록 뚜껑, 위쪽 앞면에 투입구, 앞면 스티커
  const box = new THREE.Group();
  const shell = new THREE.Mesh(rbox(THREE, ext, 1.5, 1.8, 1.0, 0.14), clayMat(THREE, CLAY.green));
  shell.position.y = 0.9;
  const lid = new THREE.Mesh(rbox(THREE, ext, 1.62, 0.16, 1.1, 0.07), clayMat(THREE, CLAY.greenDeep));
  lid.position.y = 1.86;
  const slot = new THREE.Mesh(rbox(THREE, ext, 1.0, 0.13, 0.03, 0.012), new THREE.MeshBasicMaterial({ color: 0x3d6b54 }));
  slot.position.set(0, 1.5, 0.5);
  const sticker = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.7), new THREE.MeshStandardMaterial({ map: medSticker(THREE), roughness: 0.6, transparent: true }));
  sticker.position.set(0, 0.78, 0.505);
  box.add(shell, lid, slot, sticker);
  box.position.set(BOX[0], GROUND, BOX[1]);
  box.visible = false;
  spin.add(box);

  const p = new THREE.Vector3();
  const ENTER = 0.24, GAP = 0.15, FLY = 0.2; // 수거함 단계: 첫 물건 출발, 물건 사이 간격, 날아가는 시간

  function update(v) {
    // 1단계: 알약 포장·약 봉지가 뜯지 않은 그대로 움츠렸다(준비) 폴짝 뛰고 → 통통 내려앉아 흔들림
    const pp = v.pills;
    // 2단계: 시럽병 마개가 날아와 돌며 닫히고, 연고가 벌떡 일어섬
    const lq = v.liquid;
    // 3단계: 수거함이 위에서 떨어져 통통 → 물건이 하나씩 포물선으로 투입구에 쏙 → 들어갈 때마다 수거함이 출렁
    const bp = v.box;
    box.visible = bp > 0;
    const bt = clamp01(bp / 0.25);
    box.position.y = GROUND + bounceDrop(bt) * 2.2;
    let kick = bt > 0.58 && bt < 0.82 ? Math.sin(Math.PI * (bt - 0.58) / 0.24) * 1.4 : 0;
    for (let i = 0; i < items.length; i++) kick += wobble(clamp01((bp - ENTER - i * GAP - FLY * 0.9) / 0.1), 1);
    const sy = 1 - kick * 0.06;
    box.scale.set(1 / Math.sqrt(sy), sy, 1 / Math.sqrt(sy));
    box.rotation.z = wobble(clamp01((bt - 0.6) / 0.4), 2) * 0.04;

    items.forEach(function (it, i) {
      const h = it.home;
      let x = h[0], y = h[1], z = h[2];
      let rx = it.rot[0], ry = it.rot[1], rz = it.rot[2];
      let s = 1, squash = 0;
      if (i < 2) {
        const t = clamp01((pp - i * 0.25) / 0.6);
        squash += t > 0 && t < 0.15 ? Math.sin(Math.PI * t / 0.15) * 0.12 : 0;
        y += t < 0.15 ? 0 : t < 0.4 ? Math.sin(Math.PI * 0.5 * (t - 0.15) / 0.25) * 0.45 : bounceDrop((t - 0.4) / 0.6) * 0.45;
        squash += t > 0.74 && t < 0.86 ? Math.sin(Math.PI * (t - 0.74) / 0.12) * 0.1 : 0;
        rz += wobble(clamp01((t - 0.76) / 0.24), 2) * 0.08 + (t > 0.15 && t < 0.76 ? Math.sin(Math.PI * (t - 0.15) / 0.61) * 0.12 : 0);
      }
      if (i === 3) {
        // 연고: 잠깐 뒤로 젖혔다가 살짝 지나치며 벌떡 서고 제자리에서 흔들림
        const tq = clamp01((lq - 0.15) / 0.55);
        const prep = lq > 0.05 && lq < 0.15 ? Math.sin(Math.PI * (lq - 0.05) / 0.1) : 0;
        rz = lerp(rz, 0, backOut(tq)) + prep * 0.12 + wobble(clamp01((lq - 0.7) / 0.3), 2) * 0.08;
        y = lerp(h[1], GROUND + 0.58, easeInOut(tq)) + Math.sin(Math.PI * tq) * 0.2;
      }
      // 준비(살짝 움츠림) → 포물선 비행(돌며) → 투입구 앞에서 작아지며 쏙
      const start = ENTER + i * GAP;
      const pre = clamp01((bp - start + 0.06) / 0.06);
      squash += bp > start - 0.06 && bp < start ? Math.sin(Math.PI * pre) * 0.12 : 0;
      const raw = clamp01((bp - start) / FLY);
      const q = easeInOut(raw);
      if (raw > 0) {
        p.set(lerp(x, SLOT[0], q), lerp(y, SLOT[1], q) + Math.sin(Math.PI * q) * 1.0, lerp(z, SLOT[2], q));
        x = p.x; y = p.y; z = p.z;
        rx = lerp(rx, 0, q); ry = lerp(ry, 0, q) + Math.sin(Math.PI * q) * 0.8; rz = lerp(rz, 0, q);
        s = q > 0.75 ? lerp(1, 0.12, smooth(0.75, 1, q)) : 1 + Math.sin(Math.PI * q / 0.75) * 0.06;
      }
      it.obj.position.set(x, y, z);
      it.obj.rotation.set(rx, ry, rz);
      const k = 1 - squash;
      it.obj.scale.set(s / Math.sqrt(k), s * k, s / Math.sqrt(k));
      it.obj.visible = raw < 1;
    });

    // 시럽 마개: 바닥에 누워 있다가 → 움찔한 뒤 포물선으로 떠올라 돌며 병 입구에 내려앉아 돌려 닫힘 → 이후 병과 함께 움직임
    const sp = items[2].obj;
    const capOn = [sp.position.x, sp.position.y + 1.02 * sp.scale.y, sp.position.z];
    const capOff = [0.15, GROUND + 0.17, 1.0]; // 시럽병 왼쪽 앞 바닥 (연고와 겹치지 않게)
    if (lq < 1) {
      const fly = easeInOut(clamp01(lq / 0.7));
      const screw = easeInOut(clamp01((lq - 0.7) / 0.3));
      const jiggle = lq < 0.08 ? Math.sin(Math.PI * lq / 0.08) * 0.05 : 0;
      cap.position.set(lerp(capOff[0], capOn[0], fly), lerp(capOff[1], capOn[1] + 0.25, fly) + Math.sin(Math.PI * fly) * 0.9 - screw * 0.25 + jiggle, lerp(capOff[2], capOn[2], fly));
      cap.rotation.set(lerp(Math.PI / 2, 0, fly), fly * 3 * Math.PI + screw * 2 * Math.PI, 0);
    } else {
      cap.position.set(capOn[0], capOn[1], capOn[2]);
      cap.rotation.set(0, 0, 0);
    }
    // 마개가 닫힐 때 병이 꾹 눌렸다 돌아옴
    const press = lq > 0.82 && lq < 1 ? Math.sin(Math.PI * (lq - 0.82) / 0.18) * 0.06 : 0;
    if (press > 0) {
      sp.scale.set(sp.scale.x * (1 + press / 2), sp.scale.y * (1 - press), sp.scale.z * (1 + press / 2));
      cap.position.y -= press * 1.02;
    }
    cap.scale.setScalar(sp.scale.x);
    cap.visible = sp.visible;

    // 효과음 (체험 창에서 효과음을 켰을 때만): 진행률이 그 순간을 지날 때 한 번
    if (hit(v, "pills", 0.46) || hit(v, "pills", 0.71)) sfx.play("tap");   // 알약 포장·약 봉지 톡톡
    if (hit(v, "liquid", 0.78) || hit(v, "liquid", 0.88)) sfx.play("tick"); // 마개 돌려 닫는 틱틱
    if (hit(v, "liquid", 0.98)) sfx.play("click");                         // 다 잠기면 딸깍
    if (hit(v, "box", 0.15)) sfx.play("thud");                             // 수거함 쿵
    for (let i = 0; i < items.length; i++) if (hit(v, "box", ENTER + i * GAP + FLY * 0.9)) sfx.play("slide"); // 투입구에 쏙
    if (hit(v, "box", 0.95)) sfx.play("chime");                            // 끝 띵동
  }

  return { update: update };
}

// 둥근 모서리 상자 (부가 도구가 없으면 보통 상자)
function rbox(THREE, ext, w, h, d, r) {
  return ext && ext.RoundedBoxGeometry ? new ext.RoundedBoxGeometry(w, h, d, 4, r) : new THREE.BoxGeometry(w, h, d);
}

// 약 봉지 앞면: 크림 바탕, 민트 머리띠에 흰 십자, 글줄, 산호색 알약
function packetTexture(THREE) {
  return canvasTexture(THREE, 256, 330, function (g, w, h) {
    g.fillStyle = "#fffaf0";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#6cc596";
    g.fillRect(0, 0, w, 50);
    g.fillStyle = "#ffffff";
    g.beginPath();
    g.roundRect(w / 2 - 8, 9, 16, 32, 5);
    g.roundRect(w / 2 - 16, 17, 32, 16, 5);
    g.fill();
    g.fillStyle = "#e3dccd";
    for (let i = 0; i < 5; i++) { g.beginPath(); g.roundRect(28, 90 + i * 34, w - 56 - (i % 2) * 40, 12, 6); g.fill(); }
    g.fillStyle = "#f29a86";
    g.beginPath();
    g.ellipse(w * 0.7, h * 0.86, 26, 14, 0.4, 0, TAU);
    g.fill();
  });
}

function syrupLabel(THREE) {
  return canvasTexture(THREE, 512, 128, function (g, w, h) {
    g.fillStyle = "#fffaf0";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#6cc596";
    g.fillRect(0, 0, w, 22);
    g.fillStyle = "#e3dccd";
    for (let i = 0; i < 6; i++) { g.beginPath(); g.roundRect(40 + i * 70, 54, 40, 10, 5); g.fill(); }
    g.beginPath();
    g.roundRect(40, 84, 300, 10, 5);
    g.fill();
  });
}

// 연고 튜브: 흰 바탕에 파스텔 파랑 띠
function tubeTexture(THREE) {
  return canvasTexture(THREE, 256, 256, function (g, w, h) {
    g.fillStyle = "#f7f8f4";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#8ec2f2";
    g.fillRect(0, h * 0.35, w, h * 0.3);
    g.fillStyle = "#ffffff";
    g.fillRect(w * 0.1, h * 0.45, w * 0.8, h * 0.08);
  });
}

function medSticker(THREE) {
  return stickerTexture(THREE, 512, 312, "#2f8f5b", function (g, w, h) {
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
    g.fillStyle = "#2f8f5b";
    g.beginPath();
    g.roundRect(320, 110, 110, 150, 22);
    g.fill();
    g.beginPath();
    g.roundRect(345, 76, 60, 36, 8);
    g.fill();
    g.fillStyle = "#ffffff";
    g.fillRect(366, 150, 18, 70);
    g.fillRect(340, 176, 70, 18);
  });
}
