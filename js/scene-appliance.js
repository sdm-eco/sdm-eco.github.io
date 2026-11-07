// 폐가전 장면
// 서대문구 폐금속자원 배출 안내: 냉장고·에어컨·세탁기·TV 등 대형폐가전(또는 소형 5개 이상)은 폐가전 무상방문수거 예약(☎1599-0903),
// 소형폐가전 5개 미만은 구청 홈페이지 "대형폐기물 신고"에서 무상 신고 → 접수증 부착 후 건물 밖 배출
import { GROUND, TAU, clamp01, easeInOut, backOut, lerp, canvasTexture, addShadow, screenBase, phoneDone, permitTexture } from "./eco3d-util.js?v=20261107s";

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
  build: build
};

function build(THREE, scene, spin) {
  scene.add(spin);

  // 냉장고 (두 칸 문 + 손잡이)
  const fridge = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xeef1f3, roughness: 0.35, metalness: 0.2 });
  const seam = new THREE.MeshStandardMaterial({ color: 0xb9c1c6, roughness: 0.5 });
  const handleMat = new THREE.MeshStandardMaterial({ color: 0x9aa4aa, metalness: 0.8, roughness: 0.3 });
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.3, 0.95), white);
  cab.position.y = 1.15;
  const line = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.03, 0.02), seam);
  line.position.set(0, 1.55, 0.48);
  fridge.add(cab, line);
  [[1.95, 0.5], [0.8, 0.9]].forEach(function (h) {
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.06, h[1], 0.06), handleMat);
    handle.position.set(0.42, h[0], 0.52);
    fridge.add(handle);
  });
  fridge.position.set(FRIDGE[0], GROUND, FRIDGE[1]);
  spin.add(fridge);
  const shadow = addShadow(THREE, scene, 2.4);
  spin.add(shadow);

  // 운반용 손수레: 냉장고 아래로 들어가 기울여 싣고 나감
  const dolly = new THREE.Group();
  const dark = new THREE.MeshStandardMaterial({ color: 0x2f3b40, roughness: 0.5, metalness: 0.4 });
  const plate = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.05, 0.5), dark);
  plate.position.set(0, 0.03, 0.25);
  dolly.add(plate);
  // 냉장고 뒤에 있어도 보이게: 손잡이는 냉장고보다 높이, 바퀴는 냉장고 폭 바깥에
  [-0.6, 0.6].forEach(function (x) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.07, 2.75, 0.07), dark);
    rail.position.set(x, 1.375, -0.05);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.1, 20), new THREE.MeshStandardMaterial({ color: 0x1b1f22, roughness: 0.8 }));
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x + Math.sign(x) * 0.08, 0.2, -0.12);
    dolly.add(rail, wheel);
  });
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.3, 12), new THREE.MeshStandardMaterial({ color: 0xe0634f, roughness: 0.5 }));
  grip.rotation.z = Math.PI / 2;
  grip.position.set(0, 2.72, -0.05);
  dolly.add(grip);
  dolly.visible = false;
  spin.add(dolly);

  // 예약하는 휴대폰: 전화 화면 → 예약 완료
  const callMap = phoneCall(THREE), doneMap = phoneDone(THREE);
  const phone = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.BoxGeometry(0.66, 1.24, 0.07), new THREE.MeshStandardMaterial({ color: 0x23302a, roughness: 0.35, metalness: 0.3 }));
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 1.12), new THREE.MeshBasicMaterial({ map: callMap }));
  screen.position.z = 0.037;
  phone.add(shell, screen);
  phone.position.set(PHONE[0], PHONE[1], PHONE[2]);
  phone.rotation.y = -0.35;
  phone.visible = false;
  spin.add(phone);

  // 작은 가전: 전기 주전자 + 토스터, 주전자에 접수증
  const small = new THREE.Group();
  const kettle = new THREE.Group();
  const kBody = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.62, 28), new THREE.MeshStandardMaterial({ color: 0xf3f5f6, metalness: 0.1, roughness: 0.3 }));
  kBody.position.y = 0.39;
  const kBase = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.08, 28), dark);
  kBase.position.y = 0.04;
  const kHandle = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.04, 8, 20, Math.PI), dark);
  kHandle.rotation.z = -Math.PI / 2;
  kHandle.position.set(0.32, 0.42, 0);
  const kLid = new THREE.Mesh(new THREE.SphereGeometry(0.28, 20, 10, 0, TAU, 0, Math.PI / 2), dark);
  kLid.scale.y = 0.35;
  kLid.position.y = 0.7;
  kettle.add(kBody, kBase, kHandle, kLid);
  const toaster = new THREE.Group();
  const tBody = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.5, 0.45), new THREE.MeshStandardMaterial({ color: 0xe0634f, roughness: 0.4 }));
  tBody.position.y = 0.25;
  toaster.add(tBody);
  [-0.15, 0.15].forEach(function (x) {
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.01, 0.06), dark);
    slot.position.set(0, 0.505, x);
    toaster.add(slot);
  });
  kettle.position.set(-0.3, 0, 0);
  toaster.position.set(0.45, 0, 0.1);
  small.add(kettle, toaster);
  small.position.set(SMALL[0], GROUND, SMALL[1]);
  small.visible = false;
  spin.add(small);
  const smallShadow = addShadow(THREE, scene, 2.0);
  spin.add(smallShadow);
  smallShadow.position.set(SMALL[0], GROUND + 0.004, SMALL[1]);
  const permit = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.27), new THREE.MeshStandardMaterial({ map: permitTexture(THREE), roughness: 0.5, side: THREE.DoubleSide }));
  permit.visible = false;
  spin.add(permit);
  const permitHome = new THREE.Vector3(SMALL[0] - 0.3, GROUND + 0.42, SMALL[1] + 0.36);

  function update(v) {
    // 1단계: 휴대폰이 나타나 1599-0903 예약 → 완료 체크
    const bp = v.book;
    const leave = easeInOut(clamp01((v.small - 0.55) / 0.3));
    phone.visible = bp > 0 && leave < 1;
    phone.scale.setScalar(Math.max(backOut(clamp01(bp / 0.25)) * (1 - leave), 0.001));
    phone.position.y = PHONE[1] + Math.sin(bp * Math.PI) * 0.12;
    const done = bp > 0.6;
    if ((screen.material.map === doneMap) !== done) {
      screen.material.map = done ? doneMap : callMap;
      screen.material.needsUpdate = true;
    }

    // 2단계: 손수레가 들어와 냉장고를 뒤로 기울여 싣고 왼쪽으로 나감
    const pp = v.pickup;
    const inT = easeInOut(clamp01(pp / 0.25));
    const tiltT = easeInOut(clamp01((pp - 0.25) / 0.2));
    const outT = easeInOut(clamp01((pp - 0.5) / 0.5));
    dolly.visible = pp > 0 && outT < 1;
    const x = FRIDGE[0] - outT * 3.2;
    // 손수레는 냉장고 뒤에 대고(받침판만 밑으로 들어감) 함께 뒤로 기울임
    dolly.position.set(lerp(FRIDGE[0] - 1.6, x, inT), GROUND, FRIDGE[1] - 0.6);
    dolly.rotation.x = -tiltT * 0.35;
    fridge.position.set(x, GROUND + tiltT * 0.05, FRIDGE[1]);
    fridge.rotation.x = -tiltT * 0.35;
    fridge.visible = outT < 1;
    const fade = 1 - outT;
    fridge.scale.setScalar(Math.max(lerp(1, 0.7, outT), 0.001));
    dolly.scale.setScalar(Math.max(lerp(1, 0.7, outT), 0.001));
    shadow.position.set(x, GROUND + 0.005, FRIDGE[1]);
    shadow.material.opacity = fade;

    // 3단계: 작은 가전이 나타나고, 휴대폰에서 나온 접수증이 주전자에 붙음
    const sp = v.small;
    small.visible = sp > 0;
    small.scale.setScalar(Math.max(backOut(clamp01(sp / 0.3)), 0.001));
    smallShadow.material.opacity = clamp01(sp / 0.3);
    const fly = easeInOut(clamp01((sp - 0.35) / 0.5));
    permit.visible = sp > 0.35;
    permit.position.set(lerp(PHONE[0], permitHome.x, fly), lerp(PHONE[1], permitHome.y, fly) + Math.sin(Math.PI * fly) * 0.7, lerp(PHONE[2], permitHome.z, fly));
    permit.rotation.set(0, lerp(-0.35, 0, fly), (1 - fly) * 0.6);
    permit.scale.setScalar(Math.max(lerp(0.5, 1, fly) * (1 + 0.15 * Math.sin(clamp01((sp - 0.85) / 0.15) * Math.PI)), 0.001));
  }

  return { update: update };
}

// 전화 화면: 수화기 아이콘 + 1599-0903
function phoneCall(THREE) {
  return canvasTexture(THREE, 256, 496, function (g, w, h) {
    screenBase(g, w, h);
    g.fillStyle = "#2f8f5b";
    g.beginPath();
    g.arc(w / 2, 200, 70, 0, TAU);
    g.fill();
    g.save();
    g.translate(w / 2, 200);
    g.rotate(-0.6);
    g.fillStyle = "#ffffff";
    g.beginPath();
    g.roundRect(-38, -14, 76, 28, 14);
    g.fill();
    g.fillRect(-38, -14, 18, 40);
    g.fillRect(20, -14, 18, 40);
    g.restore();
    g.fillStyle = "#1b2b22";
    g.font = "bold 40px system-ui, sans-serif";
    g.textAlign = "center";
    g.fillText("1599-0903", w / 2, 330);
    g.fillStyle = "#dfe6e2";
    g.fillRect(48, 380, w - 96, 22);
  });
}
