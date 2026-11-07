// 대형 폐기물 장면 (클레이 스타일)
// 서대문구청 안내: 구 홈페이지 인터넷 접수 또는 동별 대행업체 전화로 배출 신고 → 수수료 납부
// → "신고필증"을 출력해 배출 품목에 붙임 → 약속한 날 내놓으면 수거
import { GROUND, TAU, clamp01, smooth, easeInOut, backOut, lerp, canvasTexture, houseFront, CLAY, clayMat, bounceDrop, wobble } from "./eco3d-util.js?v=20261108j";
import { sfx, hit } from "./eco3d-sound.js?v=20261108j";

const CHAIR = [-0.35, 0.2];        // 의자 처음 위치 (x, z)
const CHAIR_OUT = [0.3, -0.95];    // 집 앞에 내놓는 곳
const PHONE = [1.55, -0.35, 0.3];  // 휴대폰 위치 (x, y, z)
const HOUSE_Z = -1.55;

export default {
  // report 1 = 배출 신고·수수료 납부, sticker 1 = 신고필증 붙임, out 1 = 약속한 날 집 앞에 내놓음
  states: [
    { report: 0, sticker: 0, out: 0 },
    { report: 1, sticker: 0, out: 0 },
    { report: 1, sticker: 1, out: 0 },
    { report: 1, sticker: 1, out: 1 }
  ],
  moves: [null, [["report", 2.8]], [["sticker", 2.8]], [["out", 3.4]]],
  spin: 0.35,
  camera: [1.6, -0.2],
  clay: true, // 클레이 스타일 조명·그림자 (eco3d.js)
  build: build
};

function build(THREE, scene, spin, ext) {
  scene.add(spin);

  const chair = armchair(THREE, ext);
  spin.add(chair);

  // 신고하는 휴대폰: 둥근 부드러운 회색 몸체, 신청 화면 → 납부 완료 화면
  const formMap = phoneForm(THREE), doneMap = phoneDone(THREE);
  const phone = new THREE.Group();
  const shell = new THREE.Mesh(rbox(THREE, ext, 0.66, 1.24, 0.09, 0.04), clayMat(THREE, 0x6f7f79, { roughness: 0.5 }));
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 1.1), new THREE.MeshBasicMaterial({ map: formMap }));
  screen.position.z = 0.047;
  phone.add(shell, screen);
  phone.position.set(PHONE[0], PHONE[1], PHONE[2]);
  phone.rotation.y = -0.35;
  spin.add(phone);

  // 신고필증 스티커 (의자에 붙어서 같이 움직임)
  const sticker = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.5), new THREE.MeshStandardMaterial({ map: permitTexture(THREE), roughness: 0.6, side: THREE.DoubleSide }));
  chair.add(sticker);
  // 의자는 180도 돌아 있으므로 의자 기준 좌표는 x·z 부호가 반대
  const stickHome = new THREE.Vector3(0, 1.14, 0.27);  // 등받이 앞면
  const stickFrom = new THREE.Vector3(CHAIR[0] - PHONE[0], PHONE[1] - GROUND + 0.1, CHAIR[1] - PHONE[2] - 0.1);

  // 집 앞 (약속한 날 달력) — 공용 집을 둥근 모서리·파스텔 점토로 바꿔 씀
  const house = houseFront(THREE, calendarSign(THREE));
  clayHouse(THREE, ext, house);
  // 달력은 내놓은 의자 등받이에 가리지 않게 조금 위로
  house.userData.sign.position.y = 2.02;
  house.position.set(0, GROUND, HOUSE_Z);
  spin.add(house);

  function update(v) {
    // 1단계: 휴대폰이 통통 튀며 나타나 → 화면을 톡 누르듯 살짝 숙였다가 → 완료 화면이 뜨며 한 번 출렁
    const rp = v.report;
    const leave = clamp01((v.sticker - 0.75) / 0.25);
    const away = leave * leave;
    phone.visible = rp > 0 && away < 1;
    const pop = backOut(clamp01(rp / 0.3));
    phone.scale.setScalar(Math.max(pop * (1 - away), 0.001));
    const tap = rp > 0.45 && rp < 0.62 ? Math.sin(Math.PI * (rp - 0.45) / 0.17) : 0;
    const settle = wobble(clamp01((rp - 0.6) / 0.4), 2);
    phone.position.y = PHONE[1] + (1 - smooth(0, 0.3, rp)) * 0.5 + Math.sin(rp * Math.PI) * 0.08 + away * 0.4;
    phone.rotation.set(-tap * 0.18, -0.35 + settle * 0.12, settle * 0.06);
    const done = rp > 0.6;
    if ((screen.material.map === doneMap) !== done) {
      screen.material.map = done ? doneMap : formMap;
      screen.material.needsUpdate = true;
    }
    screen.scale.setScalar(done ? 1 + 0.06 * Math.sin(clamp01((rp - 0.6) / 0.2) * Math.PI) : 1);

    // 2단계: 휴대폰에서 쏙 나온 신고필증이 돌며 포물선으로 날아가 등받이에 철썩 붙음 → 의자가 출렁
    const sp = v.sticker;
    const fly = easeInOut(clamp01((sp - 0.12) / 0.5));
    const slap = clamp01((sp - 0.62) / 0.18);
    sticker.visible = sp > 0.05;
    sticker.position.lerpVectors(stickFrom, stickHome, fly);
    sticker.position.y += Math.sin(Math.PI * fly) * 0.7 + (sp < 0.12 ? smooth(0.05, 0.12, sp) * 0.15 : 0);
    sticker.rotation.set(0, lerp(-0.35, Math.PI, fly), (1 - fly) * (0.6 + Math.sin(fly * 10) * 0.3) + wobble(slap, 2) * 0.12);
    const grow = lerp(0.4, 1, backOut(clamp01((sp - 0.12) / 0.5)));
    sticker.scale.set(Math.max(grow * (1 + 0.16 * Math.sin(slap * Math.PI)), 0.001), Math.max(grow * (1 - 0.1 * Math.sin(slap * Math.PI)), 0.001), 1);
    const jolt = wobble(clamp01((sp - 0.66) / 0.34), 2);

    // 3단계: 집 앞이 솟아오르고 → 의자가 움츠렸다(준비) 폴짝 들려 옮겨져 → 통통 튀며 내려앉아 흔들림이 잦아듦
    const op = v.out;
    house.visible = op > 0;
    house.scale.set(1, Math.max(backOut(clamp01(op / 0.3)), 0.001), 1);
    house.userData.sign.scale.setScalar(Math.max(backOut(clamp01((op - 0.8) / 0.2)) * 0.9, 0.001));
    const crouch = op > 0.22 && op < 0.34 ? Math.sin(Math.PI * (op - 0.22) / 0.12) : 0;
    const carry = easeInOut(clamp01((op - 0.3) / 0.42));
    // 들어 올릴 때는 쭉, 내려앉을 때는 bounceDrop으로 통통 (옮기기가 끝나는 0.72에 바닥에 닿음)
    const hop = op < 0.48 ? Math.sin(Math.PI * 0.5 * clamp01((op - 0.3) / 0.18)) * 0.55 : bounceDrop((op - 0.48) / 0.4) * 0.55;
    chair.position.set(lerp(CHAIR[0], CHAIR_OUT[0], carry), GROUND + hop, lerp(CHAIR[1], CHAIR_OUT[1], carry));
    const sway = wobble(clamp01((op - 0.8) / 0.2), 2);
    chair.rotation.set(Math.sin(Math.PI * carry) * 0.12, Math.PI + Math.sin(Math.PI * carry) * 0.25, jolt * 0.05 + sway * 0.06);
    const base = lerp(1, 0.88, carry);
    const land = op > 0.71 && op < 0.83 ? Math.sin(Math.PI * (op - 0.71) / 0.12) : 0;
    const sy = 1 - crouch * 0.1 - land * 0.08 + jolt * 0.04;
    chair.scale.set(base / Math.sqrt(sy), base * sy, base / Math.sqrt(sy));

    // 효과음 (체험 창에서 효과음을 켰을 때만): 진행률이 그 순간을 지날 때 한 번
    if (hit(v, "report", 0.05)) sfx.play("pop");     // 휴대폰 퐁 등장
    if (hit(v, "report", 0.53)) sfx.play("tap");     // 화면 톡
    if (hit(v, "report", 0.6)) sfx.play("beep");     // 납부 완료 띠링
    if (hit(v, "sticker", 0.06)) sfx.play("slide");  // 필증이 쏙 나옴
    if (hit(v, "sticker", 0.63)) sfx.play("stick");  // 등받이에 착
    if (hit(v, "out", 0.72)) sfx.play("thud");       // 집 앞에 쿵
    if (hit(v, "out", 0.82)) sfx.play("tap");        // 한 번 더 통
    if (hit(v, "out", 0.95)) sfx.play("chime");      // 끝 띵동
  }

  return { update: update };
}

// 둥근 모서리 상자 (부가 도구가 없으면 보통 상자)
function rbox(THREE, ext, w, h, d, r) {
  return ext && ext.RoundedBoxGeometry ? new ext.RoundedBoxGeometry(w, h, d, 4, r) : new THREE.BoxGeometry(w, h, d);
}

// 낡은 1인용 소파 (앞이 -z, 그래서 180도 돌려 둠) — 민트·초록 점토 + 나무 다리
function armchair(THREE, ext) {
  const g = new THREE.Group();
  const fabric = clayMat(THREE, CLAY.green, { roughness: 0.7, sheen: 0.3 });
  const soft = clayMat(THREE, CLAY.cream, { roughness: 0.7 });
  const wood = clayMat(THREE, CLAY.wood);
  function box(w, h, d, r, mat, x, y, z) {
    const m = new THREE.Mesh(rbox(THREE, ext, w, h, d, r), mat);
    m.position.set(x, y, z);
    g.add(m);
  }
  box(1.3, 0.32, 1.1, 0.1, fabric, 0, 0.42, 0);        // 받침
  box(1.0, 0.18, 0.9, 0.08, soft, 0, 0.66, -0.06);     // 방석
  box(1.3, 1.0, 0.26, 0.1, fabric, 0, 1.08, 0.42);     // 등받이
  [-1, 1].forEach(function (side) {
    box(0.24, 0.42, 1.1, 0.1, fabric, side * 0.6, 0.78, 0); // 팔걸이
    [-1, 1].forEach(function (fz) {
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.18, 4, 10), wood);
      leg.position.set(side * 0.5, 0.145, fz * 0.42);
      g.add(leg);
    });
  });
  g.position.set(CHAIR[0], GROUND, CHAIR[1]);
  g.rotation.y = Math.PI;
  return g;
}

// 공용 집 앞(보통 상자·짙은 색)을 둥근 모서리 + 파스텔 점토로 바꿈 (반투명 달력 판은 그대로)
function clayHouse(THREE, ext, house) {
  const COLORS = {
    0xefe6d6: CLAY.cream, 0xa58f74: CLAY.wood, 0xbdb19c: 0xeadfca,
    0x7a5236: 0xd7a77c, 0x5c3d28: 0xc08d63, 0xffd98a: CLAY.yellow, 0xd8b25a: CLAY.yellowDeep
  };
  house.traverse(function (o) {
    if (!o.isMesh || o.material.transparent) return;
    const old = o.material;
    const hex = old.color.getHex();
    const extra = old.emissiveIntensity > 0 ? { emissive: old.emissive.getHex(), emissiveIntensity: old.emissiveIntensity * 0.7 } : {};
    o.material = clayMat(THREE, COLORS[hex] !== undefined ? COLORS[hex] : hex, extra);
    old.dispose();
    const p = o.geometry.parameters;
    if (o.geometry.type === "BoxGeometry" && ext && ext.RoundedBoxGeometry) {
      const r = Math.min(0.06, Math.min(p.width, p.height, p.depth) / 2 - 0.005);
      o.geometry.dispose();
      o.geometry = rbox(THREE, ext, p.width, p.height, p.depth, r);
    }
  });
}

// 휴대폰 화면 윗부분: 크림 바탕 + 민트 머리띠
function screenTop(g, w, h) {
  g.fillStyle = "#fffaf0";
  g.fillRect(0, 0, w, h);
  g.fillStyle = "#6cc596";
  g.fillRect(0, 0, w, 70);
  g.fillStyle = "#ffffff";
  g.beginPath();
  g.roundRect(24, 28, 70, 14, 7);
  g.fill();
}

// 신청 화면: 소파 그림, 입력 칸, ₩ 결제 버튼 (파스텔)
function phoneForm(THREE) {
  return canvasTexture(THREE, 256, 496, function (g, w, h) {
    screenTop(g, w, h);
    g.fillStyle = "#8fd3ae";
    g.beginPath();
    g.roundRect(68, 96, 120, 58, 14);
    g.roundRect(54, 104, 26, 54, 12);
    g.roundRect(176, 104, 26, 54, 12);
    g.fill();
    g.fillStyle = "#ece6da";
    [196, 236, 276].forEach(function (y) { g.beginPath(); g.roundRect(28, y, w - 56, 24, 12); g.fill(); });
    g.fillStyle = "#6cc596";
    g.beginPath();
    g.roundRect(28, 360, w - 56, 70, 35);
    g.fill();
    g.fillStyle = "#ffffff";
    g.font = "bold 48px system-ui, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("₩", w / 2, 397);
  });
}

// 완료 화면: 민트 동그라미 + 흰 체크
function phoneDone(THREE) {
  return canvasTexture(THREE, 256, 496, function (g, w, h) {
    screenTop(g, w, h);
    g.fillStyle = "#6cc596";
    g.beginPath();
    g.arc(w / 2, 240, 80, 0, TAU);
    g.fill();
    g.strokeStyle = "#ffffff";
    g.lineWidth = 22;
    g.lineCap = "round";
    g.lineJoin = "round";
    g.beginPath();
    g.moveTo(w / 2 - 40, 242);
    g.lineTo(w / 2 - 10, 272);
    g.lineTo(w / 2 + 42, 212);
    g.stroke();
    g.fillStyle = "#ece6da";
    g.beginPath();
    g.roundRect(48, 370, w - 96, 22, 11);
    g.fill();
  });
}

// 신고필증: 파스텔 노랑 바탕, 번호, 바코드
function permitTexture(THREE) {
  return canvasTexture(THREE, 384, 248, function (g, w, h) {
    g.fillStyle = "#f9dd88";
    g.beginPath();
    g.roundRect(4, 4, w - 8, h - 8, 26);
    g.fill();
    g.strokeStyle = "#e2a93a";
    g.lineWidth = 8;
    g.stroke();
    g.fillStyle = "#7a5a1c";
    g.font = "bold 50px system-ui, sans-serif";
    g.textAlign = "center";
    g.fillText("No. 1376", w / 2, 82);
    let x = 48;
    for (let i = 0; x < w - 48; i++) {
      const bw = [6, 10, 4, 14][i % 4];
      g.fillRect(x, 120, bw, 90);
      x += bw + 7;
    }
  });
}

// 달력: 산호색 머리띠, 약속한 날에 민트 동그라미
function calendarSign(THREE) {
  return canvasTexture(THREE, 512, 336, function (g, w, h) {
    g.fillStyle = "#ffffff";
    g.beginPath();
    g.roundRect(6, 6, w - 12, h - 12, 34);
    g.fill();
    g.fillStyle = "#f29a86";
    g.beginPath();
    g.roundRect(6, 6, w - 12, 70, [34, 34, 0, 0]);
    g.fill();
    g.fillStyle = "#e6ddcd";
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 7; c++) {
        g.beginPath();
        g.arc(70 + c * 62, 132 + r * 70, 16, 0, TAU);
        g.fill();
      }
    }
    g.strokeStyle = "#6cc596";
    g.lineWidth = 18;
    g.beginPath();
    g.arc(70 + 4 * 62, 132 + 70, 40, 0, TAU);
    g.stroke();
  });
}
