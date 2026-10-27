// 투명 페트병 장면
// 배출 순서: 서울시 안내(내용물 비우기 → 라벨 제거 → 압착 → 뚜껑 닫기 → 투명 페트병 전용 수거함)
import { GROUND, TAU, clamp01, smooth, easeInOut, backOut, lerp, densePoints, canvasTexture, addShadow, stickerTexture, createDrops } from "./eco3d-util.js";

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
  moves: [null, [["cap", 0.9], ["liquid", 2.2]], [["label", 1.4]], [["crush", 1.2]], [["cap", 0.9]], [["bin", 1.8]]],
  spin: 0.5, // 자동 재생 때 라벨 무늬가 보이는 각도
  build: build
};

function build(THREE, scene, spin) {
  // root(들어 올리기) → tilt(쏟을 때 기울이기) → spin(드래그 회전) → bottle(병 본체)
  const root = new THREE.Group();
  const tilt = new THREE.Group();
  const bottle = new THREE.Group();
  bottle.position.y = GROUND;
  root.add(tilt);
  tilt.add(spin);
  spin.add(bottle);
  scene.add(root);

  // 병 몸통
  const bodyGeo = new THREE.LatheGeometry(densePoints(THREE, PROFILE, 5), 64);
  const bodyOrig = bodyGeo.attributes.position.array.slice();
  // 투명한 병은 안쪽 면 → 바깥 면 순서로 따로 그려야 돌릴 때 얼룩지지 않음
  const bodyMat = {
    color: 0xe8f6ff, roughness: 0.06, metalness: 0, transparent: true,
    clearcoat: 1, clearcoatRoughness: 0.05, depthWrite: false, envMapIntensity: 1.5
  };
  const bodyBack = new THREE.Mesh(bodyGeo, new THREE.MeshPhysicalMaterial(Object.assign({}, bodyMat, { side: THREE.BackSide, opacity: 0.18 })));
  const body = new THREE.Mesh(bodyGeo, new THREE.MeshPhysicalMaterial(Object.assign({}, bodyMat, { side: THREE.FrontSide, opacity: 0.3 })));
  bodyBack.renderOrder = 2;
  body.renderOrder = 3;
  bottle.add(bodyBack, body);

  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.035, 10, 40),
    new THREE.MeshStandardMaterial({ color: 0x2f6fd0, roughness: 0.4 }));
  ring.rotation.x = Math.PI / 2;
  bottle.add(ring);

  // 음료 (윗면 기준으로 줄어들어서, 병을 뒤집으면 입구 쪽으로 빠져나가는 것처럼 보임)
  const LIQUID_TOP = 1.85;
  const liquidGeo = new THREE.LatheGeometry(densePoints(THREE,
    [[0, 0.06], [0.54, 0.06], [0.585, 0.18], [0.585, 0.95], [0.54, 1.08], [0.585, 1.2], [0.585, LIQUID_TOP], [0, LIQUID_TOP]], 2), 48);
  liquidGeo.translate(0, -LIQUID_TOP, 0);
  const liquidMat = new THREE.MeshStandardMaterial({ color: 0xe3a23f, roughness: 0.2, transparent: true, opacity: 0.85 });
  const liquid = new THREE.Mesh(liquidGeo, liquidMat);
  liquid.position.y = LIQUID_TOP;
  liquid.renderOrder = 1;
  bottle.add(liquid);

  // 라벨
  const labelMat = new THREE.MeshStandardMaterial({ map: labelTexture(THREE), roughness: 0.35, transparent: true, side: THREE.DoubleSide });
  const label = new THREE.Mesh(new THREE.CylinderGeometry(0.633, 0.633, 0.62, 64, 1, true), labelMat);
  bottle.add(label);

  // 뚜껑 (병이 기울어도 따라 기울지 않도록 root에 둠)
  const cap = new THREE.Group();
  const capMat = new THREE.MeshStandardMaterial({ color: 0x2f6fd0, roughness: 0.35 });
  cap.add(new THREE.Mesh(new THREE.CylinderGeometry(0.245, 0.245, 0.28, 32), capMat));
  for (let i = 0; i < 16; i++) {
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.24, 0.03), capMat);
    const a = (i / 16) * TAU;
    rib.position.set(Math.cos(a) * 0.25, 0, Math.sin(a) * 0.25);
    cap.add(rib);
  }
  root.add(cap);

  const shadow = addShadow(THREE, scene, 2.6);

  // 투명 페트병 전용 수거함
  const bin = new THREE.Group();
  const binMat = new THREE.MeshPhysicalMaterial({ color: 0x3b8fd0, roughness: 0.3, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false });
  const binWall = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 0.82, 1.5, 48, 1, true), binMat);
  binWall.position.y = 0.75;
  binWall.renderOrder = 3;
  const binFloor = new THREE.Mesh(new THREE.CircleGeometry(0.82, 48), binMat);
  binFloor.rotation.x = -Math.PI / 2;
  binFloor.position.y = 0.01;
  const binRim = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.05, 10, 64), new THREE.MeshStandardMaterial({ color: 0x1f5f9a, roughness: 0.4 }));
  binRim.rotation.x = Math.PI / 2;
  binRim.position.y = 1.5;
  const sticker = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.55), new THREE.MeshStandardMaterial({ map: petSticker(THREE), roughness: 0.5, transparent: true }));
  sticker.position.set(0, 0.8, 0.93);
  sticker.rotation.x = -0.11;
  sticker.renderOrder = 4;
  bin.add(binWall, binFloor, binRim, sticker);
  bin.position.y = GROUND;
  bin.visible = false;
  scene.add(bin);

  const drops = createDrops(THREE, scene, liquidMat, 60, 0.05);
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
    const pour = v.$key === "liquid" ? v.$p : 0;
    const level = v.$key === "liquid" ? 1 - smooth(0.32, 0.78, v.$p) : v.liquid;
    const crush = easeInOut(v.crush);

    deform(crush);
    const top = topY(crush);
    ring.position.y = top - 0.2;

    tilt.rotation.z = Math.sin(Math.PI * pour) * 2.3;
    tilt.position.x = Math.sin(Math.PI * pour) * -0.5;

    liquid.visible = level > 0.005;
    liquid.scale.y = Math.max(level, 0.001);

    const lp = easeInOut(v.label);
    label.visible = lp < 0.99;
    label.position.set(easeInOut(lp) * 1.8, 1.55 + Math.sin(Math.PI * lp) * 0.6 - smooth(0.6, 1, lp) * 1.2, 0);
    label.rotation.set(0, lp * 5, -lp * 0.9);
    labelMat.opacity = 1 - smooth(0.65, 1, lp);

    // 뚜껑: 돌려서 들어 올린 뒤 병 옆 바닥에 내려놓음
    const cp = easeInOut(v.cap);
    const onY = GROUND + top + 0.13;
    const liftY = onY + 0.6;
    if (cp < 0.45) {
      const q = easeInOut(cp / 0.45);
      cap.position.set(0, lerp(onY, liftY, q), 0);
      cap.rotation.set(0, -q * 4 * Math.PI, 0);
    } else {
      const q = easeInOut((cp - 0.45) / 0.55);
      cap.position.set(lerp(0, 1.3, q), lerp(liftY, GROUND + 0.14, q) + Math.sin(Math.PI * q) * 0.5, lerp(0, 0.5, q));
      cap.rotation.set(0, 0, 0);
    }

    // 수거함: 나타난 뒤 병을 들어 올려 떨어뜨림
    const bp = v.bin;
    bin.visible = bp > 0;
    bin.scale.setScalar(Math.max(backOut(clamp01(bp / 0.35)), 0.001));
    const LIFT = 1.7;
    let rootY = 0;
    if (bp > 0.12 && bp < 0.55) rootY = easeInOut(clamp01((bp - 0.12) / 0.38)) * LIFT;
    else if (bp >= 0.55) {
      const q = clamp01((bp - 0.55) / 0.45);
      rootY = lerp(LIFT, 0.1, q * q);
    }
    root.position.y = rootY;

    shadow.position.x = tilt.position.x;
    const s = 1 / (1 + rootY * 0.5);
    shadow.scale.set(s, s, s);
    shadow.material.opacity = bp >= 0.55 && rootY < 0.2 ? 0 : s;

    // 쏟아지는 음료 방울
    emitClock += dt;
    if (pour > 0.32 && pour < 0.78) {
      bottle.localToWorld(mouth.set(0, top, 0));
      axis.set(0, 1, 0).applyQuaternion(tilt.quaternion);
      while (emitClock > 0.025) {
        emitClock -= 0.025;
        spread.set((Math.random() - 0.5) * 0.5, 0, (Math.random() - 0.5) * 0.5);
        drops.emit(mouth, axis.clone().multiplyScalar(1.4).add(spread));
      }
    } else {
      emitClock = 0;
    }
    drops.update(dt);
  }

  return { update: update, reset: drops.clear };
}

function labelTexture(THREE) {
  return canvasTexture(THREE, 1024, 256, function (g, w, h) {
    g.fillStyle = "#2f8f5b";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#d4f29a";
    g.beginPath();
    g.moveTo(0, h * 0.62);
    for (let x = 0; x <= w; x += 8) g.lineTo(x, h * 0.62 + Math.sin((x / w) * TAU * 3) * 18);
    g.lineTo(w, h);
    g.lineTo(0, h);
    g.fill();
    g.fillStyle = "#ffffff";
    for (let i = 0; i < 3; i++) {
      const cx = w * (i / 3 + 1 / 6), cy = h * 0.36;
      g.beginPath();
      g.moveTo(cx, cy - 46);
      g.bezierCurveTo(cx + 40, cy, cx + 30, cy + 34, cx, cy + 34);
      g.bezierCurveTo(cx - 30, cy + 34, cx - 40, cy, cx, cy - 46);
      g.fill();
    }
  });
}

function petSticker(THREE) {
  return stickerTexture(THREE, 512, 312, "#1f5f9a", function (g, w, h) {
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
