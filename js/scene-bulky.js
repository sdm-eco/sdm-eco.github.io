// 대형 폐기물 장면
// 서대문구청 안내: 구 홈페이지 인터넷 접수 또는 동별 대행업체 전화로 배출 신고 → 수수료 납부
// → "신고필증"을 출력해 배출 품목에 붙임 → 약속한 날 내놓으면 수거
import { GROUND, TAU, clamp01, easeInOut, backOut, lerp, canvasTexture, addShadow, houseFront } from "./eco3d-util.js";

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
  build: build
};

function build(THREE, scene, spin) {
  scene.add(spin);

  const chair = armchair(THREE);
  spin.add(chair);
  const shadow = addShadow(THREE, scene, 2.8);
  spin.add(shadow);

  // 신고하는 휴대폰: 신청 화면 → 납부 완료 화면
  const formMap = phoneForm(THREE), doneMap = phoneDone(THREE);
  const phone = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.BoxGeometry(0.66, 1.24, 0.07), new THREE.MeshStandardMaterial({ color: 0x23302a, roughness: 0.35, metalness: 0.3 }));
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 1.12), new THREE.MeshBasicMaterial({ map: formMap }));
  screen.position.z = 0.037;
  phone.add(shell, screen);
  phone.position.set(PHONE[0], PHONE[1], PHONE[2]);
  phone.rotation.y = -0.35;
  spin.add(phone);

  // 신고필증 스티커 (의자에 붙어서 같이 움직임)
  const sticker = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.5), new THREE.MeshStandardMaterial({ map: permitTexture(THREE), roughness: 0.5, side: THREE.DoubleSide }));
  chair.add(sticker);
  // 의자는 180도 돌아 있으므로 의자 기준 좌표는 x·z 부호가 반대
  const stickHome = new THREE.Vector3(0, 1.14, 0.28);  // 등받이 앞면
  const stickFrom = new THREE.Vector3(CHAIR[0] - PHONE[0], PHONE[1] - GROUND + 0.1, CHAIR[1] - PHONE[2] - 0.1);

  // 집 앞 (약속한 날 달력)
  const house = houseFront(THREE, calendarSign(THREE));
  house.position.set(0, GROUND, HOUSE_Z);
  spin.add(house);

  function update(v) {
    // 1단계: 휴대폰으로 신고하고 수수료를 내면 완료 표시
    const rp = v.report;
    const leave = easeInOut(clamp01((v.sticker - 0.75) / 0.25));
    phone.visible = rp > 0 && leave < 1;
    phone.scale.setScalar(Math.max(backOut(clamp01(rp / 0.25)) * (1 - leave), 0.001));
    phone.position.y = PHONE[1] + Math.sin(rp * Math.PI) * 0.12;
    const done = rp > 0.6;
    if ((screen.material.map === doneMap) !== done) {
      screen.material.map = done ? doneMap : formMap;
      screen.material.needsUpdate = true;
    }
    screen.scale.setScalar(done ? 1 + 0.08 * Math.sin(clamp01((rp - 0.6) / 0.2) * Math.PI) : 1);

    // 2단계: 휴대폰에서 나온 신고필증이 날아가 등받이에 붙음
    const sp = v.sticker;
    const fly = easeInOut(clamp01((sp - 0.1) / 0.55));
    const slap = clamp01((sp - 0.65) / 0.15);
    sticker.visible = sp > 0.05;
    sticker.position.lerpVectors(stickFrom, stickHome, fly);
    sticker.position.y += Math.sin(Math.PI * fly) * 0.6;
    sticker.rotation.set(0, lerp(-0.35, Math.PI, fly), lerp(0.6, 0.05, fly) + (1 - fly) * Math.sin(fly * 14) * 0.3);
    sticker.scale.setScalar(Math.max(lerp(0.4, 1, fly) * (1 + 0.18 * Math.sin(slap * Math.PI)), 0.001));

    // 3단계: 집 앞이 나타나고 의자를 들어 집 앞에 내놓음
    const op = v.out;
    house.visible = op > 0;
    house.scale.set(1, Math.max(backOut(clamp01(op / 0.3)), 0.001), 1);
    house.userData.sign.scale.setScalar(Math.max(backOut(clamp01((op - 0.78) / 0.22)), 0.001));
    const carry = easeInOut(clamp01((op - 0.3) / 0.45));
    const hop = Math.sin(Math.PI * carry) * 0.45;
    chair.position.set(lerp(CHAIR[0], CHAIR_OUT[0], carry), GROUND + hop, lerp(CHAIR[1], CHAIR_OUT[1], carry));
    chair.rotation.y = Math.PI + Math.sin(Math.PI * carry) * 0.25;
    chair.scale.setScalar(lerp(1, 0.88, carry));

    shadow.position.set(chair.position.x, GROUND + 0.005, chair.position.z);
    const s = 1 / (1 + hop * 0.8);
    shadow.scale.setScalar(s * chair.scale.x);
    shadow.material.opacity = s;
  }

  return { update: update };
}

// 낡은 1인용 소파 (앞이 -z, 그래서 180도 돌려 둠)
function armchair(THREE) {
  const g = new THREE.Group();
  const fabric = new THREE.MeshStandardMaterial({ color: 0x3d7f79, roughness: 0.9 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2f6762, roughness: 0.9 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x6b4a32, roughness: 0.6 });
  function box(w, h, d, mat, x, y, z) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    g.add(m);
  }
  box(1.3, 0.32, 1.1, fabric, 0, 0.42, 0);          // 받침
  box(1.0, 0.16, 0.9, dark, 0, 0.66, -0.06);        // 방석
  box(1.3, 1.0, 0.26, fabric, 0, 1.08, 0.42);       // 등받이
  [-1, 1].forEach(function (side) {
    box(0.22, 0.4, 1.1, fabric, side * 0.6, 0.78, 0);  // 팔걸이
    [-1, 1].forEach(function (fz) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.26, 10), wood);
      leg.position.set(side * 0.5, 0.13, fz * 0.42);
      g.add(leg);
    });
  });
  g.position.set(CHAIR[0], GROUND, CHAIR[1]);
  g.rotation.y = Math.PI;
  return g;
}

function screenBase(g, w, h) {
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, w, h);
  g.fillStyle = "#2f8f5b";
  g.fillRect(0, 0, w, 70);
  g.fillStyle = "#ffffff";
  g.fillRect(24, 28, 70, 14);
}

// 신청 화면: 소파 그림, 입력 칸, ₩ 결제 버튼
function phoneForm(THREE) {
  return canvasTexture(THREE, 256, 496, function (g, w, h) {
    screenBase(g, w, h);
    g.fillStyle = "#4f8f8a";
    g.fillRect(68, 120, 120, 34);
    g.fillRect(68, 96, 120, 30);
    g.fillRect(56, 104, 22, 54);
    g.fillRect(178, 104, 22, 54);
    g.fillStyle = "#dfe6e2";
    [196, 236, 276].forEach(function (y) { g.fillRect(28, y, w - 56, 24); });
    g.fillStyle = "#2f8f5b";
    g.beginPath();
    g.roundRect(28, 360, w - 56, 70, 18);
    g.fill();
    g.fillStyle = "#ffffff";
    g.font = "bold 48px system-ui, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("₩", w / 2, 397);
  });
}

// 완료 화면: 초록 체크
function phoneDone(THREE) {
  return canvasTexture(THREE, 256, 496, function (g, w, h) {
    screenBase(g, w, h);
    g.fillStyle = "#2f8f5b";
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
    g.fillStyle = "#dfe6e2";
    g.fillRect(48, 370, w - 96, 22);
  });
}

// 신고필증: 노란 바탕, 번호, 바코드
function permitTexture(THREE) {
  return canvasTexture(THREE, 384, 248, function (g, w, h) {
    g.fillStyle = "#ffd84d";
    g.beginPath();
    g.roundRect(4, 4, w - 8, h - 8, 22);
    g.fill();
    g.strokeStyle = "#c79a12";
    g.lineWidth = 8;
    g.stroke();
    g.fillStyle = "#3a2f0b";
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

// 달력: 약속한 날에 초록 동그라미
function calendarSign(THREE) {
  return canvasTexture(THREE, 512, 336, function (g, w, h) {
    g.fillStyle = "#ffffff";
    g.beginPath();
    g.roundRect(6, 6, w - 12, h - 12, 30);
    g.fill();
    g.fillStyle = "#d8432f";
    g.fillRect(6, 6, w - 12, 70);
    g.fillStyle = "#c5cdc8";
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 7; c++) {
        g.beginPath();
        g.arc(70 + c * 62, 132 + r * 70, 16, 0, TAU);
        g.fill();
      }
    }
    g.strokeStyle = "#2f8f5b";
    g.lineWidth = 18;
    g.beginPath();
    g.arc(70 + 4 * 62, 132 + 70, 40, 0, TAU);
    g.stroke();
  });
}
