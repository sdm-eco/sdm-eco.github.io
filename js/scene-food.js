// 음식물 쓰레기 장면 (클레이 스타일)
// 서대문구청 안내: 물기 제거 후 배출, 뼈·조개/달걀 껍데기·핵과류 씨 등은 일반쓰레기,
// 단독주택은 음식물 전용 봉투, 공동주택은 전용 수거함
import { GROUND, TAU, clamp01, smooth, easeInOut, backOut, lerp, densePoints, canvasTexture, stickerTexture, createDrops, binGroup, seeded, CLAY, clayMat, tiltCurve, bounceDrop, wobble } from "./eco3d-util.js?v=20261108h";
import { sfx, hit } from "./eco3d-sound.js?v=20261108h";

const BASE = GROUND + 0.12;   // 바구니 다리 높이만큼 띄움
const G_BIN = [-1.85, 0.25];   // 일반쓰레기통 위치 (x, z)
const LIFT = 2.1;              // 수거함에 쏟을 때 들어 올리는 높이
const HOLD = 0.8;              // 들어 올린 동안 바구니 크기 (기울였을 때 수거함 테두리를 뚫지 않게)
const LAV = 0xc9b8f5, LAV_DEEP = 0x9b84e0; // 일반쓰레기 분류색(보라)의 파스텔

export default {
  // water 1 = 물기 가득, pick 1 = 일반쓰레기를 골라냄, bin 1 = 전용 수거함에 넣음
  states: [
    { water: 1, pick: 0, bin: 0 },
    { water: 0, pick: 0, bin: 0 },
    { water: 0, pick: 1, bin: 0 },
    { water: 0, pick: 1, bin: 1 }
  ],
  moves: [null, [["water", 2.6]], [["pick", 3.4]], [["bin", 3.6]]],
  spin: 0.35,
  camera: [2.4, -0.1], // 바구니 안이 보이도록 조금 위에서 내려다봄 (카메라 높이, 바라보는 높이)
  clay: true, // 클레이 스타일 조명·그림자 (eco3d.js)
  build: build
};

function build(THREE, scene, spin, ext) {
  // root(들어 올리기·옮기기) → tilt(흔들기·쏟기) → spin(드래그 회전) → basket(물빠짐 바구니)
  const root = new THREE.Group();
  const tilt = new THREE.Group();
  const basket = new THREE.Group();
  root.add(tilt);
  tilt.add(spin);
  spin.add(basket);
  scene.add(root);

  // 구멍 뚫린 민트색 점토 바구니 + 두툼한 테두리·손잡이 (구멍 사이로 그림자도 비침)
  const clay = clayMat(THREE, CLAY.mint, { roughness: 0.5 });
  const bowl = new THREE.Mesh(
    new THREE.LatheGeometry(densePoints(THREE, [[0, 0], [0.5, 0], [0.8, 0.1], [1.0, 0.35], [1.1, 0.65], [1.15, 0.85]], 4), 64),
    clayMat(THREE, CLAY.mint, { roughness: 0.5, side: THREE.DoubleSide, alphaMap: holesTexture(THREE), alphaTest: 0.5 })
  );
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.07, 14, 72), clayMat(THREE, CLAY.green));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.85;
  const feet = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.06, 12, 48), clay);
  feet.rotation.x = Math.PI / 2;
  feet.position.y = -0.06;
  basket.add(bowl, rim, feet);
  [-1, 1].forEach(function (side) {
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.05, 12, 24, Math.PI), clayMat(THREE, CLAY.green));
    handle.position.set(side * 1.17, 0.8, 0);
    handle.rotation.z = side * -Math.PI / 2;
    basket.add(handle);
  });

  // 고인 물 (투명 → 그림자 없음)
  const water = new THREE.Mesh(
    new THREE.LatheGeometry(densePoints(THREE, [[0, 0.02], [0.48, 0.02], [0.76, 0.11], [0.95, 0.33], [1.0, 0.4], [0, 0.4]], 2), 48),
    new THREE.MeshPhysicalMaterial({ color: 0x9fd3f5, roughness: 0.1, transparent: true, opacity: 0.55, depthWrite: false, clearcoat: 0.6 })
  );
  basket.add(water);

  // 음식물 조각 (채소·당근·밥·김치): 둥근 점토 덩어리
  function rbox(w, h, d) {
    return ext && ext.RoundedBoxGeometry ? new ext.RoundedBoxGeometry(w, h, d, 2, Math.min(w, h, d) * 0.4) : new THREE.BoxGeometry(w, h, d);
  }
  const rand = seeded(7);
  const kinds = [
    [rbox(0.26, 0.06, 0.18), clayMat(THREE, 0x8fd17a)],
    [rbox(0.15, 0.15, 0.15), clayMat(THREE, 0xf5a462)],
    [new THREE.SphereGeometry(0.1, 16, 12), clayMat(THREE, CLAY.white, { sheen: 0.8 })],
    [rbox(0.22, 0.07, 0.15), clayMat(THREE, CLAY.coral)]
  ];
  // 테두리 위로 수북이 쌓아서 바구니 밖에서도 보이게 함
  const chunks = [];
  for (let i = 0; i < 36; i++) {
    const k = kinds[i % kinds.length];
    const m = new THREE.Mesh(k[0], k[1]);
    const r = Math.sqrt(rand()) * 0.85;
    const y = 0.28 + rand() * (0.66 - r * 0.45);
    const a = rand() * TAU;
    m.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
    m.rotation.set(rand() * 3, rand() * 3, rand() * 3);
    m.userData.home = m.position.clone();
    m.userData.delay = rand();
    basket.add(m);
    chunks.push(m);
  }

  // 일반쓰레기로 버려야 하는 것 (뼈·달걀 껍데기·조개껍데기·복숭아 씨)
  const junk = [bone(THREE), eggShell(THREE), clamShell(THREE), peachPit(THREE)];
  [[-0.32, 0.92, 0.18], [0.3, 0.94, -0.1], [0.0, 0.98, 0.36], [0.4, 0.88, 0.3]].forEach(function (p, i) {
    junk[i].position.set(p[0], p[1], p[2]);
    junk[i].userData.home = junk[i].position.clone();
    junk[i].userData.rot = junk[i].rotation.clone();
    junk[i].userData.size = junk[i].scale.clone();
    basket.add(junk[i]);
  });

  // 일반쓰레기통 (일반쓰레기 분류색의 파스텔 보라)
  const gBin = binGroup(THREE, 0.5, 0.44, 0.8, LAV, LAV_DEEP, trashSticker(THREE));
  gBin.position.set(G_BIN[0], GROUND, G_BIN[1]);
  scene.add(gBin);

  // 음식물 전용 수거함 (파스텔 노랑, 뚜껑 달림)
  const fBin = binGroup(THREE, 0.9, 0.78, 1.2, CLAY.yellow, CLAY.yellowDeep, foodSticker(THREE));
  fBin.position.set(0, GROUND, 0);
  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, 1.22, -0.92);
  const lidMat = clayMat(THREE, CLAY.yellowDeep);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.96, 0.96, 0.08, 56), lidMat);
  lid.position.set(0, 0.04, 0.92);
  const lidEdge = new THREE.Mesh(new THREE.TorusGeometry(0.96, 0.05, 12, 64), lidMat);
  lidEdge.rotation.x = Math.PI / 2;
  lidEdge.position.set(0, 0.04, 0.92);
  const knob = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.3, 4, 12), clayMat(THREE, CLAY.cream));
  knob.rotation.z = Math.PI / 2;
  knob.position.set(0, 0.12, 1.55);
  lidPivot.add(lid, lidEdge, knob);
  fBin.add(lidPivot);
  scene.add(fBin);

  const drops = createDrops(THREE, scene, new THREE.MeshStandardMaterial({ color: 0x8fd0f5, roughness: 0.1, transparent: true, opacity: 0.85 }), 70, 0.045);

  const tmp = new THREE.Vector3();
  const from = new THREE.Vector3();
  const to = new THREE.Vector3();
  const fall = new THREE.Vector3(0, -0.4, 0);
  let emitClock = 0;

  // 바구니 안쪽 좌표 home에서 세계 좌표 target으로: 살짝 들썩(준비) → 포물선 → 쓰레기통 안으로 쏙
  function flyTo(obj, target, q, arc) {
    const f = clamp01((q - 0.12) / 0.88);
    basket.localToWorld(from.copy(obj.userData.home));
    tmp.lerpVectors(from, target, f < 0.6 ? easeInOut(f / 0.6) : 1);
    tmp.y += Math.sin(Math.PI * Math.min(f / 0.6, 1)) * arc;
    if (f >= 0.6) {
      const d = (f - 0.6) / 0.4;
      tmp.y -= d * d * 0.7;
    }
    basket.worldToLocal(tmp);
    obj.position.copy(tmp);
    if (q < 0.12) obj.position.y += Math.sin(Math.PI * q / 0.12) * 0.08;
    return f;
  }

  function update(v, dt) {
    // 1단계: 살짝 눌렀다가(준비) 들어 올려 흔들며 물기 빼기 → 내려놓을 때 통통 튀고 출렁
    const wp = v.$key === "water" ? v.$p : 0;
    const level = v.$key === "water" ? 1 - smooth(0.15, 0.85, wp) : v.water;
    water.visible = level > 0.01;
    water.scale.y = Math.max(level, 0.001);
    const shake = Math.sin(wp * 50) * 0.07 * smooth(0.12, 0.3, wp) * (1 - smooth(0.72, 0.84, wp));
    let wy = 0;
    if (wp > 0) {
      if (wp < 0.08) wy = -Math.sin(Math.PI * wp / 0.08) * 0.06;
      else if (wp < 0.8) wy = easeInOut(clamp01((wp - 0.08) / 0.16)) * 0.75;
      else wy = bounceDrop(clamp01((wp - 0.8) / 0.2)) * 0.75;
    }
    const wSettle = wp > 0.88 ? wobble(clamp01((wp - 0.88) / 0.12), 2) : 0;

    // 3단계: 들썩(준비) → 들어 올려 수거함 위로 → 기울여 쏟음(살짝 젖혔다 기울여 머묾 → 지나쳐 세움)
    //        → 옆으로 옮겨 통통 튀며 내려놓고 → 뚜껑이 덜컥 닫히며 수거함이 출렁
    const bp = v.bin;
    const prep = bp > 0 && bp < 0.06 ? -Math.sin(Math.PI * bp / 0.06) * 0.08 : 0;
    const lift = easeInOut(clamp01((bp - 0.04) / 0.22));
    const pp = clamp01((bp - 0.3) / 0.4);
    const pour = pp > 0 && pp < 1 ? tiltCurve(pp) : 0;
    const away = easeInOut(clamp01((bp - 0.7) / 0.2));
    const drop = bp >= 0.7 ? bounceDrop(clamp01((bp - 0.7) / 0.24)) : 1;
    const aSettle = wobble(clamp01((bp - 0.84) / 0.14), 2);
    root.position.set(lerp(lift * 0.55, 1.65, away), BASE + wy + prep + lift * LIFT * drop, lerp(0, 0.3, away));
    root.scale.setScalar(lerp(lerp(1, HOLD, lift), 0.62, away));
    tilt.rotation.z = shake + pour * 1.8 + (wSettle + aSettle) * 0.05;

    fBin.visible = bp > 0.16;
    fBin.scale.setScalar(Math.max(backOut(clamp01((bp - 0.16) / 0.2)), 0.001));
    // 뚜껑: 뒤로 젖혀 열린 채 나왔다가 떨어지듯 닫히고 두 번 작게 튀어 오름
    lidPivot.rotation.x = -1.9 * bounceDrop(clamp01((bp - 0.82) / 0.18));
    const lidLand = wobble(clamp01((bp - 0.9) / 0.1), 2);
    fBin.rotation.z = lidLand * 0.04;
    fBin.scale.y *= 1 - lidLand * 0.04;

    // 2단계: 일반쓰레기통이 통통 나오고, 일반쓰레기를 하나씩 집어 넣음 (들어갈 때마다 통이 출렁)
    const pk = v.pick;
    gBin.visible = pk > 0;
    gBin.scale.setScalar(Math.max(backOut(clamp01(pk / 0.15)), 0.001));
    let gShake = 0;
    junk.forEach(function (j, i) {
      const q = clamp01((pk - 0.1 - i * 0.15) / 0.34);
      j.visible = q < 1;
      to.set(G_BIN[0], GROUND + 1.0, G_BIN[1]);
      let f = 0;
      if (q > 0) f = flyTo(j, to, q, 0.8);
      else j.position.copy(j.userData.home);
      const e = easeInOut(f);
      j.rotation.set(j.userData.rot.x + e * 4, j.userData.rot.y + e * 3, j.userData.rot.z);
      j.scale.copy(j.userData.size).multiplyScalar(f > 0.85 ? lerp(1, 0.4, (f - 0.85) / 0.15) : 1);
      gShake += wobble(clamp01((pk - 0.44 - i * 0.15) / 0.1), 1);
    });
    gBin.rotation.z = gShake * 0.08;

    // 음식물 조각이 수거함으로 떨어짐 (바구니가 다 기울어 머무는 동안)
    chunks.forEach(function (c) {
      const q = clamp01((bp - 0.43 - c.userData.delay * 0.05) / 0.1);
      c.visible = q < 1;
      if (q > 0) {
        basket.localToWorld(from.copy(c.userData.home));
        to.set(c.userData.home.x * 0.5, GROUND + 0.35, c.userData.home.z * 0.5);
        tmp.lerpVectors(from, to, q * q);
        basket.worldToLocal(tmp);
        c.position.copy(tmp);
      } else {
        c.position.copy(c.userData.home);
      }
    });

    // 바구니 바닥에서 떨어지는 물방울
    emitClock += dt;
    if (wp > 0.15 && wp < 0.8) {
      while (emitClock > 0.02) {
        emitClock -= 0.02;
        const a = Math.random() * TAU, r = Math.random() * 0.7;
        basket.localToWorld(tmp.set(Math.cos(a) * r, 0.02, Math.sin(a) * r));
        drops.emit(tmp, fall);
      }
    } else {
      emitClock = 0;
    }
    drops.update(dt);

    // 효과음 (체험 창에서 효과음을 켰을 때만): 진행률이 그 순간을 지날 때 한 번
    if (hit(v, "water", 0.15)) sfx.play("water", 1.69); // 흔드는 동안 물 빠지는 소리
    if (hit(v, "water", 0.92)) sfx.play("tap");         // 바구니를 내려놓을 때 톡
    if (hit(v, "pick", 0.4) || hit(v, "pick", 0.55) || hit(v, "pick", 0.7) || hit(v, "pick", 0.85)) sfx.play("slide"); // 일반쓰레기가 통에 하나씩 쏙
    if (hit(v, "bin", 0.53)) sfx.play("thud");          // 음식물이 수거함에 툭
    if (hit(v, "bin", 0.844)) sfx.play("tap");          // 바구니를 내려놓을 때 톡
    if (hit(v, "bin", 0.928)) sfx.play("lid");          // 뚜껑이 탁 닫힘
    if (hit(v, "bin", 0.97)) sfx.play("chime");         // 끝 띵동
  }

  return { update: update, reset: drops.clear };
}

function holesTexture(THREE) {
  const tex = canvasTexture(THREE, 1024, 256, function (g, w, h) {
    g.fillStyle = "#fff";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#000";
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 40; col++) {
        g.beginPath();
        g.arc((col + (row % 2) * 0.5 + 0.25) * (w / 40), (row + 0.9) * (h / 10), 7, 0, TAU);
        g.fill();
      }
    }
  }, false);
  return tex;
}

function trashSticker(THREE) {
  return stickerTexture(THREE, 512, 312, "#9b84e0", function (g, w, h) {
    // 쓰레기통 아이콘 (둥근 모서리)
    g.beginPath();
    g.roundRect(w / 2 - 70, 94, 140, 20, 10);
    g.roundRect(w / 2 - 22, 74, 44, 26, 10);
    g.fill();
    g.beginPath();
    g.moveTo(w / 2 - 58, 124);
    g.lineTo(w / 2 + 58, 124);
    g.lineTo(w / 2 + 46, 250);
    g.quadraticCurveTo(w / 2 + 44, 258, w / 2 + 36, 258);
    g.lineTo(w / 2 - 36, 258);
    g.quadraticCurveTo(w / 2 - 44, 258, w / 2 - 46, 250);
    g.fill();
  });
}

function foodSticker(THREE) {
  return stickerTexture(THREE, 512, 312, "#e2a93a", function (g, w, h) {
    // 그릇과 김 아이콘
    g.beginPath();
    g.moveTo(w / 2 - 110, 160);
    g.lineTo(w / 2 + 110, 160);
    g.quadraticCurveTo(w / 2 + 100, 262, w / 2, 262);
    g.quadraticCurveTo(w / 2 - 100, 262, w / 2 - 110, 160);
    g.fill();
    g.lineWidth = 14;
    g.lineCap = "round";
    g.strokeStyle = "#e2a93a";
    [-50, 0, 50].forEach(function (dx) {
      g.beginPath();
      g.moveTo(w / 2 + dx, 136);
      g.quadraticCurveTo(w / 2 + dx - 18, 110, w / 2 + dx, 86);
      g.quadraticCurveTo(w / 2 + dx + 18, 62, w / 2 + dx, 46);
      g.stroke();
    });
  });
}

function bone(THREE) {
  const mat = clayMat(THREE, CLAY.cream, { roughness: 0.6 });
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.42, 4, 12), mat);
  shaft.rotation.z = Math.PI / 2;
  g.add(shaft);
  [[-0.25, 0.045], [-0.25, -0.045], [0.25, 0.045], [0.25, -0.045]].forEach(function (p) {
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 12), mat);
    knob.position.set(p[0], p[1], 0);
    g.add(knob);
  });
  g.rotation.set(0.2, 0.6, 0.1);
  return g;
}

function eggShell(THREE) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.17, 28, 14, 0, TAU, 0, Math.PI / 2),
    clayMat(THREE, 0xfff1dc, { roughness: 0.5, side: THREE.DoubleSide }));
  m.scale.set(1, 1.25, 1);
  m.rotation.set(Math.PI + 0.5, 0, 0.3);
  return m;
}

function clamShell(THREE) {
  const tex = canvasTexture(THREE, 256, 128, function (g, w, h) {
    g.fillStyle = "#f4dcc0";
    g.fillRect(0, 0, w, h);
    g.strokeStyle = "#e3bf98";
    g.lineWidth = 7;
    g.lineCap = "round";
    for (let x = 9; x < w; x += 20) {
      g.beginPath();
      g.moveTo(x, 6);
      g.lineTo(x, h - 6);
      g.stroke();
    }
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.2, 28, 14, 0, TAU, 0, Math.PI / 2),
    clayMat(THREE, 0xffffff, { map: tex, roughness: 0.55, side: THREE.DoubleSide }));
  m.scale.set(1, 0.35, 0.85);
  m.rotation.set(0.15, 0.4, -0.2);
  return m;
}

function peachPit(THREE) {
  const geo = new THREE.SphereGeometry(0.12, 24, 16);
  // 위치로 울퉁불퉁함을 정해서 이음매가 벌어지지 않게 함 (점토처럼 굵고 얕게)
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const k = 1 + 0.07 * Math.sin(pos.getX(i) * 40) * Math.sin(pos.getY(i) * 36) * Math.sin(pos.getZ(i) * 34 + 1);
    pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k, pos.getZ(i) * k);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, clayMat(THREE, 0xc98e6a, { roughness: 0.8 }));
  m.scale.set(1, 0.72, 0.78);
  return m;
}
