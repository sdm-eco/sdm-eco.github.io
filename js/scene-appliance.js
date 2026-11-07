// 폐가전 장면 (클레이 스타일)
// 서대문구 폐금속자원 배출 안내: 냉장고·에어컨·세탁기·TV 등 대형폐가전(또는 소형 5개 이상)은 폐가전 무상방문수거 예약(☎1599-0903),
// 소형폐가전 5개 미만은 구청 홈페이지 "대형폐기물 신고"에서 무상 신고 → 접수증 부착 후 건물 밖 배출
import { GROUND, TAU, clamp01, smooth, easeInOut, backOut, lerp, canvasTexture, CLAY, clayMat, bounceDrop, wobble } from "./eco3d-util.js?v=20261108j";
import { sfx, hit } from "./eco3d-sound.js?v=20261108j";

const FRIDGE = [-0.75, -0.1];        // 냉장고 자리 (x, z)
const PHONE = [1.35, -0.25, 0.35];    // 휴대폰 자리 (x, y, z)
const SMALL = [0.55, 0.55];          // 작은 가전 자리 (x, z)

export default {
  // book 1 = 무상방문수거 예약, pickup 1 = 냉장고를 실어 감, small 1 = 작은 가전에 접수증을 붙임
  states: [
    { book: 0, pickup: 0, small: 0 },
    { book: 1, pickup: 0, small: 0 },
    { book: 1, pickup: 1, small: 0 },
    { book: 1, pickup: 1, small: 1 }
  ],
  moves: [null, [["book", 2.4]], [["pickup", 3.0]], [["small", 2.8]]],
  spin: 0.3,
  camera: [1.4, -0.2],
  clay: true, // 클레이 스타일 조명·그림자 (eco3d.js)
  build: build
};

function build(THREE, scene, spin, ext) {
  scene.add(spin);

  // 냉장고: 둥근 모서리 크림색 몸통 + 두 칸 문 이음매 + 민트 손잡이
  const fridge = new THREE.Group();
  const cab = new THREE.Mesh(rbox(THREE, ext, 1.1, 2.3, 0.95, 0.14), clayMat(THREE, CLAY.white, { roughness: 0.45, clearcoat: 0.35 }));
  cab.position.y = 1.15;
  const line = new THREE.Mesh(rbox(THREE, ext, 1.0, 0.035, 0.03, 0.012), clayMat(THREE, CLAY.silver));
  line.position.set(0, 1.55, 0.475);
  fridge.add(cab, line);
  const handleMat = clayMat(THREE, CLAY.green);
  [[1.95, 0.42], [0.8, 0.82]].forEach(function (h) {
    const handle = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, h[1], 4, 12), handleMat);
    handle.position.set(0.4, h[0], 0.51);
    fridge.add(handle);
  });
  fridge.position.set(FRIDGE[0], GROUND, FRIDGE[1]);
  spin.add(fridge);

  // 운반용 손수레: 파스텔 파랑 틀 + 부드러운 회색 바퀴 + 노랑 손잡이. 냉장고 뒤에 대고 기울여 싣고 나감
  const dolly = new THREE.Group();
  const frame = clayMat(THREE, CLAY.blueDeep);
  const plate = new THREE.Mesh(rbox(THREE, ext, 1.25, 0.06, 0.5, 0.025), frame);
  plate.position.set(0, 0.03, 0.25);
  dolly.add(plate);
  // 냉장고 뒤에 있어도 보이게: 손잡이는 냉장고보다 높이, 바퀴는 냉장고 폭 바깥에
  const wheelMat = clayMat(THREE, 0x6f7f79, { roughness: 0.7 });
  const hubMat = clayMat(THREE, CLAY.silver);
  [-0.6, 0.6].forEach(function (x) {
    const rail = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 2.67, 4, 10), frame);
    rail.position.set(x, 1.375, -0.05);
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.06, 12, 28), wheelMat);
    wheel.rotation.y = Math.PI / 2;
    wheel.position.set(x + Math.sign(x) * 0.08, 0.21, -0.12);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.08, 20), hubMat);
    hub.rotation.z = Math.PI / 2;
    hub.position.copy(wheel.position);
    dolly.add(rail, wheel, hub);
  });
  const grip = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 1.2, 4, 12), clayMat(THREE, CLAY.yellow));
  grip.rotation.z = Math.PI / 2;
  grip.position.set(0, 2.72, -0.05);
  dolly.add(grip);
  dolly.visible = false;
  spin.add(dolly);

  // 예약하는 휴대폰: 둥근 부드러운 회색 몸체, 전화 화면 → 예약 완료
  const callMap = phoneCall(THREE), doneMap = phoneDone(THREE);
  const phone = new THREE.Group();
  const shell = new THREE.Mesh(rbox(THREE, ext, 0.66, 1.24, 0.09, 0.04), clayMat(THREE, 0x6f7f79, { roughness: 0.5 }));
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 1.1), new THREE.MeshBasicMaterial({ map: callMap }));
  screen.position.z = 0.047;
  phone.add(shell, screen);
  phone.position.set(PHONE[0], PHONE[1], PHONE[2]);
  phone.rotation.y = -0.35;
  phone.visible = false;
  spin.add(phone);

  // 작은 가전: 크림색 전기 주전자(민트 받침·손잡이·뚜껑) + 산호색 토스터, 주전자에 접수증
  const small = new THREE.Group();
  const accent = clayMat(THREE, CLAY.green);
  const kettle = new THREE.Group();
  const kBody = new THREE.Mesh(new THREE.LatheGeometry([[0, 0.08], [0.32, 0.08], [0.345, 0.13], [0.3, 0.62], [0.27, 0.7], [0, 0.7]].map(function (p) { return new THREE.Vector2(p[0], p[1]); }), 40),
    clayMat(THREE, CLAY.cream));
  const kBase = new THREE.Mesh(new THREE.CylinderGeometry(0.37, 0.38, 0.09, 32), accent);
  kBase.position.y = 0.045;
  const kHandle = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.045, 10, 24, Math.PI), accent);
  kHandle.rotation.z = -Math.PI / 2;
  kHandle.position.set(0.3, 0.42, 0);
  const kLid = new THREE.Mesh(new THREE.SphereGeometry(0.27, 24, 10, 0, TAU, 0, Math.PI / 2), accent);
  kLid.scale.y = 0.35;
  kLid.position.y = 0.69;
  kettle.add(kBody, kBase, kHandle, kLid);
  const toaster = new THREE.Group();
  const tBody = new THREE.Mesh(rbox(THREE, ext, 0.75, 0.5, 0.45, 0.12), clayMat(THREE, CLAY.coral));
  tBody.position.y = 0.25;
  toaster.add(tBody);
  const slotMat = clayMat(THREE, 0x8a6f66, { roughness: 0.8 });
  [-0.1, 0.1].forEach(function (z) {
    const slot = new THREE.Mesh(rbox(THREE, ext, 0.4, 0.02, 0.06, 0.009), slotMat);
    slot.position.set(0, 0.5, z);
    toaster.add(slot);
  });
  const lever = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.08, 4, 8), clayMat(THREE, CLAY.cream));
  lever.rotation.z = Math.PI / 2;
  lever.position.set(0.39, 0.32, 0);
  toaster.add(lever);
  kettle.position.set(-0.3, 0, 0);
  toaster.position.set(0.45, 0, 0.1);
  small.add(kettle, toaster);
  small.position.set(SMALL[0], GROUND, SMALL[1]);
  small.visible = false;
  spin.add(small);
  const permit = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.27), new THREE.MeshStandardMaterial({ map: permitTexture(THREE), roughness: 0.6, side: THREE.DoubleSide }));
  permit.visible = false;
  spin.add(permit);
  const permitHome = new THREE.Vector3(SMALL[0] - 0.3, GROUND + 0.42, SMALL[1] + 0.36);

  function squash(obj, sy, base) {
    obj.scale.set(base / Math.sqrt(sy), base * sy, base / Math.sqrt(sy));
  }

  function update(v) {
    // 1단계: 휴대폰이 위에서 통통 튀며 나타나 → 화면을 톡 누르듯 숙였다가 → 예약 완료 체크와 함께 한 번 출렁
    const bp = v.book;
    const lv = clamp01((v.small - 0.55) / 0.3);
    const leave = lv * lv;
    phone.visible = bp > 0 && leave < 1;
    phone.scale.setScalar(Math.max(backOut(clamp01(bp / 0.3)) * (1 - leave), 0.001));
    const tap = bp > 0.45 && bp < 0.62 ? Math.sin(Math.PI * (bp - 0.45) / 0.17) : 0;
    const settle = wobble(clamp01((bp - 0.6) / 0.4), 2);
    phone.position.y = PHONE[1] + (1 - smooth(0, 0.3, bp)) * 0.5 + Math.sin(bp * Math.PI) * 0.08 + leave * 0.4;
    phone.rotation.set(-tap * 0.18, -0.35 + settle * 0.12, settle * 0.06);
    const done = bp > 0.6;
    if ((screen.material.map === doneMap) !== done) {
      screen.material.map = done ? doneMap : callMap;
      screen.material.needsUpdate = true;
    }
    screen.scale.setScalar(done ? 1 + 0.06 * Math.sin(clamp01((bp - 0.6) / 0.2) * Math.PI) : 1);

    // 2단계: 손수레가 미끄러져 들어와 살짝 지나쳤다 멈춤 → 냉장고가 앞으로 살짝 쏠렸다(준비) 뒤로 기울어 실림
    //        → 처음엔 천천히, 점점 빠르게 덜컹거리며 왼쪽으로 나감
    const pp = v.pickup;
    const inT = backOut(clamp01(pp / 0.25));
    const prep = pp > 0.25 && pp < 0.33 ? Math.sin(Math.PI * (pp - 0.25) / 0.08) : 0;
    const tiltT = backOut(clamp01((pp - 0.3) / 0.18));
    const oq = clamp01((pp - 0.5) / 0.5);
    const outT = oq * oq;
    dolly.visible = pp > 0 && outT < 1;
    const x = FRIDGE[0] - outT * 3.2;
    const bump = Math.abs(Math.sin(oq * Math.PI * 5)) * 0.04 * (1 - oq);
    const tiltA = -tiltT * 0.35 + prep * 0.04 + wobble(clamp01((pp - 0.42) / 0.2), 2) * 0.03;
    // 손수레는 냉장고 뒤에 대고(받침판만 밑으로 들어감) 함께 뒤로 기울임
    dolly.position.set(lerp(FRIDGE[0] - 1.6, x, inT), GROUND + bump, FRIDGE[1] - 0.6);
    dolly.rotation.x = Math.min(tiltA, 0);
    fridge.position.set(x, GROUND + clamp01(tiltT) * 0.05 + bump, FRIDGE[1]);
    fridge.rotation.x = tiltA;
    fridge.visible = outT < 1;
    const shrink = Math.max(lerp(1, 0.7, outT) * (1 - smooth(0.85, 1, oq)), 0.001);
    squash(fridge, 1 - prep * 0.03, shrink);
    dolly.scale.setScalar(shrink);

    // 3단계: 작은 가전이 하나씩 떨어져 통통 튀며 내려앉고 → 휴대폰에서 나온 접수증이 돌며 날아와
    //        주전자에 철썩 붙음 → 주전자가 출렁
    const sp = v.small;
    small.visible = sp > 0;
    const kt = clamp01(sp / 0.3), tt = clamp01((sp - 0.06) / 0.3);
    kettle.position.y = bounceDrop(kt) * 1.6;
    toaster.position.y = bounceDrop(tt) * 1.6;
    const fly = easeInOut(clamp01((sp - 0.35) / 0.5));
    const slap = clamp01((sp - 0.85) / 0.15);
    const jolt = wobble(clamp01((sp - 0.85) / 0.15), 2);
    const kLand = kt > 0.58 && kt < 0.8 ? Math.sin(Math.PI * (kt - 0.58) / 0.22) : 0;
    const tLand = tt > 0.58 && tt < 0.8 ? Math.sin(Math.PI * (tt - 0.58) / 0.22) : 0;
    squash(kettle, 1 - kLand * 0.14 - jolt * 0.05, 1);
    squash(toaster, 1 - tLand * 0.14, 1);
    kettle.rotation.z = jolt * 0.05;
    small.scale.setScalar(Math.max(Math.min(sp / 0.04, 1), 0.001));
    permit.visible = sp > 0.35;
    permit.position.set(lerp(PHONE[0], permitHome.x, fly), lerp(PHONE[1], permitHome.y, fly) + Math.sin(Math.PI * fly) * 0.7, lerp(PHONE[2], permitHome.z, fly));
    permit.rotation.set(0, lerp(-0.35, 0, fly) + (1 - fly) * Math.sin(fly * 9) * 0.4, (1 - fly) * 0.8 + jolt * 0.1);
    const grow = lerp(0.5, 1, backOut(fly));
    permit.scale.set(Math.max(grow * (1 + 0.15 * Math.sin(slap * Math.PI)), 0.001), Math.max(grow * (1 - 0.1 * Math.sin(slap * Math.PI)), 0.001), 1);

    // 효과음 (체험 창에서 효과음을 켰을 때만): 진행률이 그 순간을 지날 때 한 번
    if (hit(v, "book", 0.05)) sfx.play("pop");          // 휴대폰 퐁 등장
    if (hit(v, "book", 0.53)) sfx.play("tap");          // 화면 톡
    if (hit(v, "book", 0.6)) sfx.play("beep");          // 예약 완료 띠링
    if (hit(v, "pickup", 0.01)) sfx.play("roll", 0.75); // 손수레 들어옴
    if (hit(v, "pickup", 0.42)) sfx.play("tap");        // 냉장고가 기울어 실림
    if (hit(v, "pickup", 0.5)) sfx.play("roll", 1.5);   // 실어 나감
    if (hit(v, "small", 0.18) || hit(v, "small", 0.24)) sfx.play("tap"); // 주전자·토스터 톡톡
    if (hit(v, "small", 0.85)) sfx.play("stick");       // 접수증 착
    if (hit(v, "small", 0.95)) sfx.play("chime");       // 끝 띵동
  }

  return { update: update };
}

// 둥근 모서리 상자 (부가 도구가 없으면 보통 상자)
function rbox(THREE, ext, w, h, d, r) {
  return ext && ext.RoundedBoxGeometry ? new ext.RoundedBoxGeometry(w, h, d, 4, r) : new THREE.BoxGeometry(w, h, d);
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

// 전화 화면: 수화기 아이콘 + 1599-0903
function phoneCall(THREE) {
  return canvasTexture(THREE, 256, 496, function (g, w, h) {
    screenTop(g, w, h);
    g.fillStyle = "#6cc596";
    g.beginPath();
    g.arc(w / 2, 200, 70, 0, TAU);
    g.fill();
    g.save();
    g.translate(w / 2, 200);
    g.rotate(-0.6);
    g.fillStyle = "#ffffff";
    g.beginPath();
    g.roundRect(-38, -14, 76, 28, 14);
    g.roundRect(-38, -14, 18, 40, 9);
    g.roundRect(20, -14, 18, 40, 9);
    g.fill();
    g.restore();
    g.fillStyle = "#3f5a4c";
    g.font = "bold 40px system-ui, sans-serif";
    g.textAlign = "center";
    g.fillText("1599-0903", w / 2, 330);
    g.fillStyle = "#ece6da";
    g.beginPath();
    g.roundRect(48, 380, w - 96, 22, 11);
    g.fill();
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

// 접수증(신고필증): 파스텔 노랑 바탕, 번호, 바코드
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
