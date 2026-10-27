// 음식물 쓰레기 장면
// 서대문구청 안내: 물기 제거 후 배출, 뼈·조개/달걀 껍데기·핵과류 씨 등은 일반쓰레기,
// 단독주택은 음식물 전용 봉투, 공동주택은 전용 수거함
import { GROUND, TAU, clamp01, smooth, easeInOut, backOut, lerp, densePoints, canvasTexture, addShadow, stickerTexture, createDrops, binGroup, seeded } from "./eco3d-util.js";

const BASE = GROUND + 0.12;   // 바구니 다리 높이만큼 띄움
const G_BIN = [-1.85, 0.25];   // 일반쓰레기통 위치 (x, z)

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
  build: build
};

function build(THREE, scene, spin) {
  // root(들어 올리기·옮기기) → tilt(흔들기·쏟기) → spin(드래그 회전) → basket(물빠짐 바구니)
  const root = new THREE.Group();
  const tilt = new THREE.Group();
  const basket = new THREE.Group();
  root.add(tilt);
  tilt.add(spin);
  spin.add(basket);
  scene.add(root);

  // 구멍 뚫린 스테인리스 바구니
  const steel = new THREE.MeshStandardMaterial({ color: 0xe3e8ec, metalness: 0.65, roughness: 0.32 });
  const bowl = new THREE.Mesh(
    new THREE.LatheGeometry(densePoints(THREE, [[0, 0], [0.5, 0], [0.8, 0.1], [1.0, 0.35], [1.1, 0.65], [1.15, 0.85]], 4), 64),
    new THREE.MeshStandardMaterial({ color: 0xe3e8ec, metalness: 0.65, roughness: 0.32, side: THREE.DoubleSide, alphaMap: holesTexture(THREE), alphaTest: 0.5 })
  );
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.04, 10, 64), steel);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.85;
  const feet = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.045, 10, 48), steel);
  feet.rotation.x = Math.PI / 2;
  feet.position.y = -0.07;
  basket.add(bowl, rim, feet);
  [-1, 1].forEach(function (side) {
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.03, 8, 24, Math.PI), steel);
    handle.position.set(side * 1.15, 0.8, 0);
    handle.rotation.z = side * -Math.PI / 2;
    basket.add(handle);
  });

  // 고인 물
  const water = new THREE.Mesh(
    new THREE.LatheGeometry(densePoints(THREE, [[0, 0.02], [0.48, 0.02], [0.76, 0.11], [0.95, 0.33], [1.0, 0.4], [0, 0.4]], 2), 48),
    new THREE.MeshStandardMaterial({ color: 0x6fb7e8, roughness: 0.1, transparent: true, opacity: 0.55, depthWrite: false })
  );
  basket.add(water);

  // 음식물 조각 (채소·당근·밥·김치)
  const rand = seeded(7);
  const kinds = [
    [new THREE.BoxGeometry(0.26, 0.05, 0.18), 0x5fae4e],
    [new THREE.BoxGeometry(0.14, 0.14, 0.14), 0xec8a2e],
    [new THREE.SphereGeometry(0.1, 12, 8), 0xf4f1e8],
    [new THREE.BoxGeometry(0.22, 0.06, 0.15), 0xd2482f]
  ];
  // 테두리 위로 수북이 쌓아서 바구니 밖에서도 보이게 함
  const chunks = [];
  for (let i = 0; i < 36; i++) {
    const k = kinds[i % kinds.length];
    const m = new THREE.Mesh(k[0], new THREE.MeshStandardMaterial({ color: k[1], roughness: 0.6 }));
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
    basket.add(junk[i]);
  });

  // 일반쓰레기통 (회색)
  const gBin = binGroup(THREE, 0.5, 0.44, 0.8, 0x8d9a92, 0x6b776f, trashSticker(THREE));
  gBin.position.set(G_BIN[0], GROUND, G_BIN[1]);
  scene.add(gBin);

  // 음식물 전용 수거함 (뚜껑 달림)
  const fBin = binGroup(THREE, 0.9, 0.78, 1.2, 0xe39a2d, 0xb8761c, foodSticker(THREE));
  fBin.position.set(0, GROUND, 0);
  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, 1.2, -0.9);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.08, 48), new THREE.MeshStandardMaterial({ color: 0xb8761c, roughness: 0.45 }));
  lid.position.set(0, 0.04, 0.9);
  lidPivot.add(lid);
  fBin.add(lidPivot);
  scene.add(fBin);

  const shadow = addShadow(THREE, scene, 3.2);
  const drops = createDrops(THREE, scene, new THREE.MeshStandardMaterial({ color: 0x7cc0ee, roughness: 0.1 }), 70, 0.045);

  const tmp = new THREE.Vector3();
  const from = new THREE.Vector3();
  const to = new THREE.Vector3();
  const fall = new THREE.Vector3(0, -0.4, 0);
  let emitClock = 0;

  // 바구니 안쪽 좌표 home에서 세계 좌표 target으로 날아가는 위치를 바구니 안쪽 좌표로 돌려줌
  function flyTo(obj, target, q, arc) {
    basket.localToWorld(from.copy(obj.userData.home));
    tmp.lerpVectors(from, target, q < 0.6 ? easeInOut(q / 0.6) : 1);
    tmp.y += Math.sin(Math.PI * Math.min(q / 0.6, 1)) * arc;
    if (q >= 0.6) {
      const d = (q - 0.6) / 0.4;
      tmp.y -= d * d * 0.7;
    }
    basket.worldToLocal(tmp);
    obj.position.copy(tmp);
  }

  function update(v, dt) {
    // 1단계: 들어 올려 흔들며 물기 빼기
    const wp = v.$key === "water" ? v.$p : 0;
    const level = v.$key === "water" ? 1 - smooth(0.15, 0.85, wp) : v.water;
    water.visible = level > 0.01;
    water.scale.y = Math.max(level, 0.001);
    const shake = Math.sin(wp * 50) * 0.07 * smooth(0.1, 0.3, wp) * (1 - smooth(0.75, 0.9, wp));

    // 3단계: 들어 올림 → 수거함에 쏟기 → 옆에 내려놓고 뚜껑 닫기
    const bp = v.bin;
    const lift = easeInOut(clamp01(bp / 0.3)) * 1.9;
    const pourIn = easeInOut(clamp01((bp - 0.36) / 0.22));
    const away = easeInOut(clamp01((bp - 0.66) / 0.2));
    root.position.set(lerp(pourIn * 0.55, 1.65, away), BASE + Math.sin(Math.PI * wp) * 0.75 + lift * (1 - away), lerp(0, 0.3, away));
    root.scale.setScalar(lerp(1, 0.62, away));
    tilt.rotation.z = shake + pourIn * 2.0 * (1 - away);

    fBin.visible = bp > 0.1;
    fBin.scale.setScalar(Math.max(backOut(clamp01((bp - 0.1) / 0.25)), 0.001));
    lidPivot.rotation.x = lerp(-1.25, 0, easeInOut(clamp01((bp - 0.84) / 0.16)));

    // 2단계: 일반쓰레기를 하나씩 집어 일반쓰레기통에 넣기
    const pp = v.pick;
    gBin.visible = pp > 0;
    gBin.scale.setScalar(Math.max(backOut(clamp01(pp / 0.15)), 0.001));
    junk.forEach(function (j, i) {
      const q = clamp01((pp - 0.12 - i * 0.17) / 0.36);
      j.visible = q < 1;
      to.set(G_BIN[0], GROUND + 1.0, G_BIN[1]);
      if (q > 0) flyTo(j, to, q, 0.8);
      else j.position.copy(j.userData.home);
      j.rotation.set(j.userData.rot.x + q * 4, j.userData.rot.y + q * 3, j.userData.rot.z);
    });

    // 음식물 조각이 수거함으로 떨어짐
    chunks.forEach(function (c) {
      const q = clamp01((bp - 0.44 - c.userData.delay * 0.12) / 0.26);
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

    shadow.position.x = root.position.x;
    const s = 1 / (1 + (root.position.y - BASE) * 0.5);
    shadow.scale.setScalar(s * root.scale.x);
    shadow.material.opacity = s;

    // 바구니 바닥에서 떨어지는 물방울
    emitClock += dt;
    if (wp > 0.15 && wp < 0.85) {
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
  }

  return { update: update, reset: drops.clear };
}

function holesTexture(THREE) {
  const tex = canvasTexture(THREE, 1024, 256, function (g, w, h) {
    g.fillStyle = "#fff";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#000";
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 48; col++) {
        g.beginPath();
        g.arc((col + (row % 2) * 0.5 + 0.25) * (w / 48), (row + 0.7) * (h / 10), 6, 0, TAU);
        g.fill();
      }
    }
  }, false);
  return tex;
}

function trashSticker(THREE) {
  return stickerTexture(THREE, 512, 312, "#5b6660", function (g, w, h) {
    // 쓰레기통 아이콘
    g.fillRect(w / 2 - 70, 96, 140, 18);
    g.fillRect(w / 2 - 22, 76, 44, 22);
    g.beginPath();
    g.moveTo(w / 2 - 58, 124);
    g.lineTo(w / 2 + 58, 124);
    g.lineTo(w / 2 + 46, 250);
    g.lineTo(w / 2 - 46, 250);
    g.fill();
  });
}

function foodSticker(THREE) {
  return stickerTexture(THREE, 512, 312, "#b8761c", function (g, w, h) {
    // 그릇과 김 아이콘
    g.beginPath();
    g.moveTo(w / 2 - 110, 160);
    g.lineTo(w / 2 + 110, 160);
    g.quadraticCurveTo(w / 2 + 100, 262, w / 2, 262);
    g.quadraticCurveTo(w / 2 - 100, 262, w / 2 - 110, 160);
    g.fill();
    g.lineWidth = 14;
    g.lineCap = "round";
    g.strokeStyle = "#b8761c";
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
  const mat = new THREE.MeshStandardMaterial({ color: 0xf3e9d2, roughness: 0.6 });
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.46, 12), mat);
  shaft.rotation.z = Math.PI / 2;
  g.add(shaft);
  [[-0.25, 0.045], [-0.25, -0.045], [0.25, 0.045], [0.25, -0.045]].forEach(function (p) {
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), mat);
    knob.position.set(p[0], p[1], 0);
    g.add(knob);
  });
  g.rotation.set(0.2, 0.6, 0.1);
  return g;
}

function eggShell(THREE) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.17, 24, 12, 0, TAU, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0xfbf5ea, roughness: 0.5, side: THREE.DoubleSide }));
  m.scale.set(1, 1.25, 1);
  m.rotation.set(Math.PI + 0.5, 0, 0.3);
  return m;
}

function clamShell(THREE) {
  const tex = canvasTexture(THREE, 256, 128, function (g, w, h) {
    g.fillStyle = "#dcc5a0";
    g.fillRect(0, 0, w, h);
    g.strokeStyle = "#b99b70";
    g.lineWidth = 5;
    for (let x = 0; x < w; x += 18) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, h);
      g.stroke();
    }
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 12, 0, TAU, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, side: THREE.DoubleSide }));
  m.scale.set(1, 0.35, 0.85);
  m.rotation.set(0.15, 0.4, -0.2);
  return m;
}

function peachPit(THREE) {
  const geo = new THREE.SphereGeometry(0.12, 18, 12);
  // 위치로 울퉁불퉁함을 정해서 이음매가 벌어지지 않게 함
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const k = 1 + 0.09 * Math.sin(pos.getX(i) * 60) * Math.sin(pos.getY(i) * 55) * Math.sin(pos.getZ(i) * 50 + 1);
    pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k, pos.getZ(i) * k);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x8b5a3c, roughness: 0.9 }));
  m.scale.set(1, 0.72, 0.78);
  return m;
}
