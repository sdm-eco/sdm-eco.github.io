// 투명 페트병 장면 (클레이 스타일 시범)
// 배출 순서: 서울시 안내(내용물 비우기 → 라벨 제거 → 압착 → 뚜껑 닫기 → 투명 페트병 전용 수거함)
import { GROUND, TAU, clamp01, smooth, easeInOut, backOut, lerp, densePoints, canvasTexture, addShadow, stickerTexture, createDrops, CLAY, clayMat, clayBin, tiltCurve, bounceDrop, wobble } from "./eco3d-util.js?v=20261108j";
import { sfx, hit } from "./eco3d-sound.js?v=20261108j";

// 페트병 옆모습 (반지름, 높이) — 바닥에서 입구까지
const PROFILE = [[0, 0], [0.42, 0], [0.58, 0.04], [0.62, 0.16], [0.62, 0.95], [0.57, 1.08], [0.62, 1.2],
  [0.62, 1.9], [0.56, 2.2], [0.4, 2.5], [0.23, 2.72], [0.2, 2.8], [0.2, 3]];
const NECK = 2.5;       // 이 높이 위(목·입구)는 찌그러지지 않음
const SQUASH = 0.55;    // 찌그러졌을 때 몸통 높이 비율

export default {
  // 단계별 최종 모습 (cap 1 = 뚜껑 열림, liquid 1 = 음료 가득, label 1 = 라벨 떨어짐, crush 1 = 찌그러짐, bin 1 = 수거함에 넣음)
  states: [
    { cap: 0, liquid: 1, label: 0, crush: 0, bin: 0 },
    { cap: 1, liquid: 0, label: 0, crush: 0, bin: 0 },
    { cap: 1, liquid: 0, label: 1, crush: 0, bin: 0 },
    { cap: 1, liquid: 0, label: 1, crush: 1, bin: 0 },
    { cap: 0, liquid: 0, label: 1, crush: 1, bin: 0 },
    { cap: 0, liquid: 0, label: 1, crush: 1, bin: 1 }
  ],
  // 각 단계로 넘어갈 때 차례로 움직이는 값과 걸리는 시간(초)
  moves: [null, [["cap", 1.3], ["liquid", 2.4]], [["label", 1.6]], [["crush", 1.4]], [["cap", 1.1]], [["bin", 2.0]]],
  spin: 0.5, // 자동 재생 때 라벨 무늬가 보이는 각도
  clay: true, // 클레이 스타일 조명·그림자 (eco3d.js)
  build: build
};

function build(THREE, scene, spin) {
  // root(들어 올리기) → tilt(쏟을 때 기울이기) → spin(드래그 회전) → bottle(병 본체, 눌림·늘어남은 bottle 크기로)
  const root = new THREE.Group();
  const tilt = new THREE.Group();
  const bottle = new THREE.Group();
  bottle.position.y = GROUND;
  root.add(tilt);
  tilt.add(spin);
  spin.add(bottle);
  scene.add(root);

  // 병 몸통: 살짝 푸른빛이 도는 맑은 플라스틱 (안쪽 면 → 바깥 면 순서로 그려 얼룩지지 않게)
  const bodyGeo = new THREE.LatheGeometry(densePoints(THREE, PROFILE, 5), 72);
  const bodyOrig = bodyGeo.attributes.position.array.slice();
  const bodyMat = {
    color: 0xeaf7fb, roughness: 0.08, metalness: 0, transparent: true,
    clearcoat: 1, clearcoatRoughness: 0.08, depthWrite: false, envMapIntensity: 1.2
  };
  const bodyBack = new THREE.Mesh(bodyGeo, new THREE.MeshPhysicalMaterial(Object.assign({}, bodyMat, { side: THREE.BackSide, opacity: 0.22 })));
  const body = new THREE.Mesh(bodyGeo, new THREE.MeshPhysicalMaterial(Object.assign({}, bodyMat, { side: THREE.FrontSide, opacity: 0.34 })));
  bodyBack.renderOrder = 2;
  body.renderOrder = 3;
  bottle.add(bodyBack, body);

  const capMat = clayMat(THREE, CLAY.blueDeep, { roughness: 0.45, clearcoat: 0.3 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.04, 12, 40), capMat);
  ring.rotation.x = Math.PI / 2;
  bottle.add(ring);

  // 음료: 보리차 색 (윗면 기준으로 줄어들어서, 병을 뒤집으면 입구 쪽으로 빠져나가는 것처럼 보임)
  const LIQUID_TOP = 1.85;
  const liquidGeo = new THREE.LatheGeometry(densePoints(THREE,
    [[0, 0.06], [0.54, 0.06], [0.585, 0.18], [0.585, 0.95], [0.54, 1.08], [0.585, 1.2], [0.585, LIQUID_TOP], [0, LIQUID_TOP]], 2), 56);
  liquidGeo.translate(0, -LIQUID_TOP, 0);
  const liquidMat = new THREE.MeshPhysicalMaterial({ color: 0xf2b35e, roughness: 0.15, transparent: true, opacity: 0.88, clearcoat: 0.5 });
  const liquid = new THREE.Mesh(liquidGeo, liquidMat);
  liquid.position.y = LIQUID_TOP;
  liquid.renderOrder = 1;
  bottle.add(liquid);

  // 라벨: 사이트 테마의 맑은 초록 + 크림 물결 + 잎 무늬
  const labelMat = clayMat(THREE, 0xffffff, { map: labelTexture(THREE), transparent: true, side: THREE.DoubleSide, sheen: 0.2 });
  const label = new THREE.Mesh(new THREE.CylinderGeometry(0.635, 0.635, 0.62, 72, 1, true), labelMat);
  bottle.add(label);

  // 뚜껑: 둥근 윗면 + 촘촘한 홈 (병이 기울어도 따라 기울지 않도록 root에 둠)
  const cap = new THREE.Group();
  const capBody = new THREE.Mesh(new THREE.CylinderGeometry(0.245, 0.25, 0.26, 40), capMat);
  const capTop = new THREE.Mesh(new THREE.SphereGeometry(0.245, 32, 8, 0, TAU, 0, Math.PI / 2), capMat);
  capTop.scale.y = 0.18;
  capTop.position.y = 0.13;
  cap.add(capBody, capTop);
  for (let i = 0; i < 28; i++) {
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.2, 0.022), capMat);
    const a = (i / 28) * TAU;
    rib.position.set(Math.cos(a) * 0.252, -0.01, Math.sin(a) * 0.252);
    cap.add(rib);
  }
  root.add(cap);
  // 병이 투명해 그림자가 없으므로, 병에 붙은 뚜껑·고리만 그림자가 떠 보이지 않게 뺌
  cap.traverse(function (o) { o.userData.noShadow = true; });
  ring.userData.noShadow = true;

  // 투명한 병은 그림자를 드리우지 않으므로 바닥의 흐린 그림자를 함께 씀
  const shadow = addShadow(THREE, scene, 2.4);

  // 투명 페트병 전용 수거함: 파스텔 파랑 + 진한 테두리
  const bin = clayBin(THREE, 1.05, 0.86, 1.55, CLAY.blue, CLAY.blueDeep, petSticker(THREE));
  bin.position.y = GROUND;
  scene.add(bin);

  const drops = createDrops(THREE, scene, liquidMat, 70, 0.05);
  const mouth = new THREE.Vector3();
  const axis = new THREE.Vector3();
  const spread = new THREE.Vector3();
  let emitClock = 0;

  let crushed = -1;
  function deform(c) {
    if (c === crushed) return;
    crushed = c;
    const pos = bodyGeo.attributes.position.array;
    for (let i = 0; i < pos.length; i += 3) {
      const x = bodyOrig[i], y = bodyOrig[i + 1], z = bodyOrig[i + 2];
      const a = Math.atan2(z, x);
      const mask = smooth(0.1, 0.4, y) * (1 - smooth(2.1, 2.45, y));
      // 가로 방향 접힘 주름 + 군데군데 눌린 자국 (나선이 아니라서 돌려도 꼬여 보이지 않음)
      const fold = 1 - 0.1 * mask * (0.5 + 0.5 * Math.sin(y * 14));
      const dent = 1 - 0.06 * mask * Math.max(0, Math.sin(a * 3)) * Math.cos(y * 6);
      const r = fold * dent;
      const cy = y <= NECK ? y * SQUASH : NECK * SQUASH + (y - NECK);
      pos[i] = lerp(x, x * r * (1 + 0.15 * mask), c);
      pos[i + 1] = lerp(y, cy, c);
      pos[i + 2] = lerp(z, z * r * (1 - 0.3 * mask), c);
    }
    bodyGeo.attributes.position.needsUpdate = true;
    bodyGeo.computeVertexNormals();
  }

  function topY(c) { return lerp(3, NECK * SQUASH + (3 - NECK), c); }

  // v: 단계 값(0~1, 직선으로 변함), v.$key·v.$p: 지금 움직이는 값과 진행률
  function update(v, dt) {
    // 찌그러뜨리기: 살짝 늘어났다가(준비) 점점 빠르게 눌리고, 다 눌린 뒤 몸이 한 번 출렁임
    const cr = v.crush;
    const press = clamp01((cr - 0.15) / 0.6);
    const crush = cr >= 1 ? 1 : Math.pow(press, 1.8);
    deform(crush);
    const top = topY(crush);
    ring.position.y = top - 0.2;
    const stretch = (cr > 0 && cr < 0.15 ? Math.sin(Math.PI * cr / 0.15) * 0.05 : 0) + (cr < 1 ? wobble(clamp01((cr - 0.75) / 0.25), 1) * 0.05 : 0);

    // 쏟기: 준비 동작 → 기울여 머묾 → 살짝 지나쳐 세움
    const pour = v.$key === "liquid" ? v.$p : 0;
    const tp = pour > 0 ? tiltCurve(pour) : 0;
    tilt.rotation.z = tp * 2.3;
    tilt.position.x = tp * -0.5;
    const level = v.$key === "liquid" ? 1 - smooth(0.36, 0.72, v.$p) : v.liquid;
    liquid.visible = level > 0.005;
    liquid.scale.y = Math.max(level, 0.001);

    // 라벨: 병을 따라 한 바퀴 풀리듯 돌며 떨어져 나가 아래로 살랑 내려앉으며 사라짐
    const lp = v.label;
    const lo = easeInOut(clamp01(lp / 0.45));        // 풀려 나옴
    const fall = easeInOut(clamp01((lp - 0.35) / 0.65)); // 떨어짐
    label.visible = lp < 0.99;
    label.position.set(lo * 0.9 + fall * 0.9, 1.55 + lo * 0.5 - fall * 1.6 + Math.sin(fall * Math.PI * 2) * 0.12, lo * 0.3);
    label.rotation.set(fall * 0.6, lo * 3.2 + fall * 1.2, -lo * 0.5 - Math.sin(fall * Math.PI * 3) * 0.25);
    label.scale.setScalar(Math.max(1 - fall * 0.3, 0.001));
    labelMat.opacity = 1 - smooth(0.7, 1, lp);

    // 뚜껑: 돌려서 들어 올린 뒤 → 포물선으로 옆 바닥에 떨어져 통통 튐 / 닫을 때(찌그러뜨린 뒤)는 날아와 돌며 닫힘
    const onY = GROUND + top + 0.13;
    const liftY = onY + 0.55;
    const restX = 1.35, restZ = 0.55, restY = GROUND + 0.13;
    const cp = v.cap;
    if (v.crush < 0.5) {
      if (cp < 0.4) {
        const q = easeInOut(cp / 0.4);
        cap.position.set(0, lerp(onY, liftY, q), 0);
        cap.rotation.set(0, -q * 4 * Math.PI, 0);
      } else {
        const q = clamp01((cp - 0.4) / 0.6);
        const arc = easeInOut(Math.min(q / 0.6, 1));
        cap.position.set(lerp(0, restX, arc), restY + (liftY - restY) * bounceDrop(q), lerp(0, restZ, arc));
        cap.rotation.set(0, 0, (1 - Math.min(q / 0.6, 1)) * 1.4);
      }
    } else {
      const q = 1 - cp;
      const fly = easeInOut(clamp01(q / 0.6));
      const screw = easeInOut(clamp01((q - 0.6) / 0.4));
      cap.position.set(lerp(restX, 0, fly), lerp(restY, liftY, fly) + Math.sin(Math.PI * fly) * 0.6 - screw * (liftY - onY), lerp(restZ, 0, fly));
      cap.rotation.set(0, screw * 4 * Math.PI, (1 - fly) * 1.4);
    }

    // 수거함: 통통 튀며 나타나고 → 병이 움츠렸다(준비) 뛰어올라 쏙 들어감 → 수거함이 출렁
    const bp = v.bin;
    bin.visible = bp > 0;
    bin.scale.setScalar(Math.max(backOut(clamp01(bp / 0.3)), 0.001));
    const crouch = bp > 0.15 && bp < 0.3 ? Math.sin(Math.PI * (bp - 0.15) / 0.15) : 0;
    const jump = clamp01((bp - 0.28) / 0.5);
    const LIFT = 1.9;
    let rootY = 0;
    if (jump > 0) rootY = jump < 0.45 ? easeInOut(jump / 0.45) * LIFT : lerp(LIFT, 0.1, Math.pow((jump - 0.45) / 0.55, 2));
    root.position.y = rootY;
    root.rotation.z = Math.sin(Math.PI * jump) * 0.15;
    const land = clamp01((bp - 0.78) / 0.22);
    bin.rotation.z = wobble(land, 2) * 0.08;
    bin.scale.y *= 1 - wobble(land, 2) * 0.06;

    // 몸통 늘어남·움츠림 (부피는 그대로인 느낌으로 가로를 반대로)
    const sy = 1 + stretch - crouch * 0.1;
    bottle.scale.set(1 / Math.sqrt(sy), sy, 1 / Math.sqrt(sy));

    shadow.position.x = tilt.position.x;
    const s = 1 / (1 + rootY * 0.5);
    shadow.scale.set(s, s, s);
    shadow.material.opacity = (bp >= 0.6 && rootY < 0.3 ? 0 : s) * 0.75;

    // 쏟아지는 음료 방울
    emitClock += dt;
    if (pour > 0.36 && pour < 0.72) {
      bottle.localToWorld(mouth.set(0, top, 0));
      axis.set(0, 1, 0).applyQuaternion(tilt.quaternion);
      while (emitClock > 0.022) {
        emitClock -= 0.022;
        spread.set((Math.random() - 0.5) * 0.4, 0, (Math.random() - 0.5) * 0.4);
        drops.emit(mouth, axis.clone().multiplyScalar(1.4).add(spread));
      }
    } else {
      emitClock = 0;
    }
    drops.update(dt);

    // 효과음 (체험 창에서 효과음을 켰을 때만): 진행률이 그 순간을 지날 때 한 번
    if (v.crush < 0.5) {
      if (hit(v, "cap", 0.08) || hit(v, "cap", 0.18) || hit(v, "cap", 0.28)) sfx.play("tick"); // 돌려 여는 틱틱
      if (hit(v, "cap", 0.4)) sfx.play("pop");                                                  // 빠질 때 퐁
      if (hit(v, "cap", 0.76) || hit(v, "cap", 0.91)) sfx.play("tap");                          // 바닥에 톡톡
    } else {
      if (hit(v, "cap", 0.68) || hit(v, "cap", 0.8) || hit(v, "cap", 0.9)) sfx.play("tick");   // 돌려 닫는 틱틱
      if (hit(v, "cap", 0.98)) sfx.play("click");                                               // 다 잠기면 딸깍
    }
    if (hit(v, "liquid", 0.36)) sfx.play("pour", 0.86); // 쪼르륵 (기울여 머무는 동안)
    if (hit(v, "label", 0.05)) sfx.play("peel");        // 라벨 떼는 소리
    if (hit(v, "crush", 0.15)) sfx.play("crunch", 0.8); // 찌그럭
    if (hit(v, "bin", 0.78)) sfx.play("thud");           // 수거함에 통
    if (hit(v, "bin", 0.95)) sfx.play("chime");          // 끝 띵동
  }

  return { update: update, reset: drops.clear };
}

function labelTexture(THREE) {
  return canvasTexture(THREE, 1024, 256, function (g, w, h) {
    g.fillStyle = "#5dbb8a";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#fff6e6";
    g.beginPath();
    g.moveTo(0, h * 0.64);
    for (let x = 0; x <= w; x += 8) g.lineTo(x, h * 0.64 + Math.sin((x / w) * TAU * 3) * 16);
    g.lineTo(w, h);
    g.lineTo(0, h);
    g.fill();
    // 잎 무늬
    g.fillStyle = "#ffffff";
    for (let i = 0; i < 3; i++) {
      const cx = w * (i / 3 + 1 / 6), cy = h * 0.34;
      g.save();
      g.translate(cx, cy);
      g.rotate(-0.6);
      g.beginPath();
      g.ellipse(0, 0, 40, 20, 0, 0, TAU);
      g.fill();
      g.restore();
    }
  });
}

function petSticker(THREE) {
  return stickerTexture(THREE, 512, 312, "#4a8fe0", function (g, w, h) {
    // 페트병 아이콘
    g.beginPath();
    g.roundRect(70, 120, 90, 150, 22);
    g.moveTo(92, 120);
    g.lineTo(100, 78);
    g.lineTo(130, 78);
    g.lineTo(138, 120);
    g.fill();
    g.fillRect(98, 56, 34, 24);
    g.font = "900 120px system-ui, sans-serif";
    g.textBaseline = "middle";
    g.fillText("PET", 190, h / 2 + 8);
  });
}
