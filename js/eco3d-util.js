// 3D 장면들이 함께 쓰는 계산·텍스처·물방울 도우미

// 오래된 브라우저(Safari 16·Firefox 112 이전)에는 둥근 사각형 그리기(roundRect)가 없어 3D 무늬를 못 그리고 글 설명만 나왔음
// → 없을 때만 같은 모양을 arcTo로 그리는 대체 함수를 붙임. 반지름은 숫자 하나 또는 [왼위, 오위, 오아래, 왼아래](이 사이트가 쓰는 형태)
if (typeof CanvasRenderingContext2D !== "undefined" && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    const a = Array.isArray(r) ? r : [r, r, r, r];
    const k = function (v) { return Math.max(0, Math.min(v || 0, Math.abs(w) / 2, Math.abs(h) / 2)); };
    this.moveTo(x + k(a[0]), y);
    this.arcTo(x + w, y, x + w, y + h, k(a[1]));
    this.arcTo(x + w, y + h, x, y + h, k(a[2]));
    this.arcTo(x, y + h, x, y, k(a[3]));
    this.arcTo(x, y, x + w, y, k(a[0]));
    this.closePath();
  };
}
export const GROUND = -1.5;   // 바닥 높이
export const TAU = Math.PI * 2;

export function clamp01(x) { return Math.min(1, Math.max(0, x)); }
export function smooth(a, b, x) { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); }
export function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
export function backOut(t) { const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }
export function lerp(a, b, t) { return a + (b - a) * t; }

// 꼭짓점 사이를 잘게 나눠 변형할 때 면이 부드럽게 휘게 함
export function densePoints(THREE, pts, per) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    for (let k = 0; k < per; k++) {
      const t = k / per;
      out.push(new THREE.Vector2(lerp(pts[i][0], pts[i + 1][0], t), lerp(pts[i][1], pts[i + 1][1], t)));
    }
  }
  const end = pts[pts.length - 1];
  out.push(new THREE.Vector2(end[0], end[1]));
  return out;
}

// color: false면 알파맵처럼 색 공간 변환 없이 씀
export function canvasTexture(THREE, w, h, draw, color) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d"), w, h);
  const tex = new THREE.CanvasTexture(c);
  if (color !== false) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function shadowTexture(THREE) {
  return canvasTexture(THREE, 128, 128, function (g, w, h) {
    const grad = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grad.addColorStop(0, "rgba(0,0,0,0.45)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
  });
}

export function addShadow(THREE, scene, size) {
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(size, size),
    new THREE.MeshBasicMaterial({ map: shadowTexture(THREE), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = GROUND + 0.005;
  scene.add(shadow);
  return shadow;
}

// 수거함 앞에 붙이는 흰 스티커 (그림은 draw에서 그림)
export function stickerTexture(THREE, w, h, stroke, draw) {
  return canvasTexture(THREE, w, h, function (g) {
    g.fillStyle = "#ffffff";
    g.beginPath();
    g.roundRect(8, 8, w - 16, h - 16, 40);
    g.fill();
    g.strokeStyle = stroke;
    g.lineWidth = 12;
    g.stroke();
    g.fillStyle = stroke;
    draw(g, w, h);
  });
}

// 정해진 순서로 나오는 난수 (매번 같은 배치를 만들 때)
export function seeded(seed) {
  return function () {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
}

// 위가 열린 둥근 수거함 (앞에 스티커) — 모든 장면이 클레이 스타일로 바뀌어 clayBin과 같은 모양을 씀
export function binGroup(THREE, top, bottom, height, color, rimColor, stickerMap) {
  return clayBin(THREE, top, bottom, height, color, rimColor, stickerMap);
}

// 집 앞 벽(문·창문·불 켜진 등). signMap 텍스처를 문 옆 벽에 붙임. 바닥이 y=0
export function houseFront(THREE, signMap) {
  const g = new THREE.Group();
  function box(w, h, d, color, x, y, z, emissive) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({
      color: color, roughness: 0.8, emissive: emissive || 0x000000, emissiveIntensity: emissive ? 0.7 : 0
    }));
    m.position.set(x, y, z);
    g.add(m);
    return m;
  }
  box(4.6, 2.5, 0.2, 0xefe6d6, 0, 1.25, 0);
  box(4.8, 0.14, 0.4, 0xa58f74, 0, 2.55, 0.05);
  box(4.6, 0.16, 0.3, 0xbdb19c, 0, 0.08, 0.06);
  box(0.82, 1.62, 0.08, 0x7a5236, -1.05, 0.81, 0.12);
  box(0.94, 0.08, 0.12, 0x5c3d28, -1.05, 1.66, 0.12);
  box(0.95, 0.72, 0.06, 0xffd98a, 1.45, 1.45, 0.11, 0xffc861);
  box(1.05, 0.08, 0.12, 0xa58f74, 1.45, 1.06, 0.13);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), new THREE.MeshStandardMaterial({ color: 0xd8b25a, metalness: 0.7, roughness: 0.3 }));
  knob.position.set(-0.76, 0.8, 0.18);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 10), new THREE.MeshStandardMaterial({ color: 0xfff1c4, emissive: 0xffd36b, emissiveIntensity: 1 }));
  lamp.position.set(-1.05, 1.95, 0.2);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.72), new THREE.MeshStandardMaterial({ map: signMap, roughness: 0.6, transparent: true }));
  sign.position.set(0.25, 1.82, 0.11);
  g.add(knob, lamp, sign);
  g.userData.sign = sign;
  g.visible = false;
  return g;
}

// 헹구기 단계 공통: 위에서 내려오는 수도꼭지와 물줄기, 그리고 기울인 그릇 입구에서 쏟아지는 방울
// 쓰는 법: const f = createFaucet(THREE, scene, x, y);  매 프레임 f.update(나타남 0~1, 물 나옴 여부, dt)
//          f.pour(obj, 입구(obj 기준 좌표), 기울기 그룹, 방울 모음, dt)  ← 쏟는 동안만 부름
// 클레이 장면용(무광 흰색 + 초록 손잡이)이 기본. clay를 false로 주면 예전 크롬 모양
export function createFaucet(THREE, scene, x, y, clay) {
  clay = clay !== false;
  const g = new THREE.Group();
  const metal = clay ? clayMat(THREE, CLAY.white, { roughness: 0.4, clearcoat: 0.5 }) : new THREE.MeshStandardMaterial({ color: 0xc9d2d6, metalness: 0.85, roughness: 0.25 });
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.1, 20), metal);
  pipe.rotation.z = Math.PI / 2;
  pipe.position.set(0.55, 0.25, 0);
  const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.11, 20, 12), metal);
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.35, 20), metal);
  spout.position.y = 0.08;
  elbow.position.y = 0.25;
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.08, 20), clay ? clayMat(THREE, CLAY.green) : new THREE.MeshStandardMaterial({ color: 0x3b8fd0, roughness: 0.4 }));
  knob.position.set(0.55, 0.4, 0);
  g.add(pipe, elbow, spout, knob);
  g.position.set(x, y, 0);
  g.visible = false;
  scene.add(g);
  const water = new THREE.MeshStandardMaterial({ color: 0x8fd0f5, roughness: 0.1, transparent: true, opacity: 0.85 });
  const drops = createDrops(THREE, scene, water, 90, 0.045);
  const p = new THREE.Vector3(), vel = new THREE.Vector3(), mouth = new THREE.Vector3(), axis = new THREE.Vector3();
  let clock = 0, pourClock = 0;
  return {
    water: water,
    drops: drops,
    update: function (show, flowing, dt) {
      g.visible = show > 0.001;
      g.position.y = y + (1 - show) * 0.8;
      g.scale.setScalar(Math.max(show, 0.001));
      clock = flowing ? clock + dt : 0;
      while (clock > 0.018) {
        clock -= 0.018;
        drops.emit(p.set(x + (Math.random() - 0.5) * 0.08, y - 0.1, (Math.random() - 0.5) * 0.08), vel.set(0, -1.5, 0));
      }
      drops.update(dt);
    },
    pour: function (obj, local, tilt, set, dt) {
      pourClock += dt;
      obj.localToWorld(mouth.copy(local));
      axis.set(0, 1, 0).applyQuaternion(tilt.quaternion);
      while (pourClock > 0.025) {
        pourClock -= 0.025;
        set.emit(mouth, axis.clone().multiplyScalar(1.4).add(vel.set((Math.random() - 0.5) * 0.5, 0, (Math.random() - 0.5) * 0.5)));
      }
    },
    clear: function () { drops.clear(); clock = 0; pourClock = 0; }
  };
}

// 비우기(empty)·헹구기(rinse) 단계의 진행 값: 기울기(0~1), 수도꼭지 보임·물 나옴, 쏟는 중인지
// 헹구기 = 수도꼭지가 내려와 물을 받음(0~0.45) → 사라짐 → 기울여 물을 쏟음(0.55~1)
export function pourPhase(v) {
  const pour = v.$key === "empty" ? v.$p : 0;
  const r = v.$key === "rinse" ? v.$p : 0;
  const rq = clamp01((r - 0.55) / 0.45);
  return {
    tilt: Math.max(Math.sin(Math.PI * pour), Math.sin(Math.PI * rq)),
    faucet: smooth(0, 0.12, r) * (1 - smooth(0.45, 0.55, r)),
    flowing: r > 0.12 && r < 0.42,
    pouring: pour > 0.32 && pour < 0.78,
    rinsing: rq > 0.32 && rq < 0.78
  };
}

// 수거함 단계(bp 0~1): 들어 올렸다가(최고 lift) 수거함 안 end 높이로 떨어뜨림
export function dropHeight(bp, lift, end) {
  if (bp > 0.12 && bp < 0.55) return easeInOut(clamp01((bp - 0.12) / 0.38)) * lift;
  if (bp >= 0.55) { const q = clamp01((bp - 0.55) / 0.45); return lerp(lift, end, q * q); }
  return 0;
}

// 떨어지는 물방울 (중력으로 떨어지다 바닥에서 사라짐)
export function createDrops(THREE, scene, material, count, size) {
  const mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(size, 8, 6), material, count);
  mesh.frustumCulled = false;
  scene.add(mesh);
  const data = Array.from({ length: count }, function () {
    return { pos: new THREE.Vector3(), vel: new THREE.Vector3(), life: 0 };
  });
  const dummy = new THREE.Object3D();
  let next = 0;
  return {
    emit: function (pos, vel) {
      const d = data[next];
      next = (next + 1) % count;
      d.pos.copy(pos);
      d.vel.copy(vel);
      d.life = 1;
    },
    clear: function () { data.forEach(function (d) { d.life = 0; }); },
    update: function (dt) {
      data.forEach(function (d, i) {
        if (d.life > 0) {
          d.life -= dt * 1.4;
          d.vel.y -= 9 * dt;
          d.pos.addScaledVector(d.vel, dt);
          if (d.pos.y < GROUND) d.life = 0;
        }
        dummy.position.copy(d.pos);
        dummy.scale.setScalar(d.life > 0 ? 0.6 + d.life * 0.6 : 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    }
  };
}

// 휴대폰 화면(신고·예약)과 신고필증: 대형폐기물·폐가전 장면이 함께 씀
export function screenBase(g, w, h) {
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, w, h);
  g.fillStyle = "#2f8f5b";
  g.fillRect(0, 0, w, 70);
  g.fillStyle = "#ffffff";
  g.fillRect(24, 28, 70, 14);
}

// 완료 화면: 초록 체크
export function phoneDone(THREE) {
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
export function permitTexture(THREE) {
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

// ── 클레이(점토) 스타일: 배너 아래 3D 그림 아이콘처럼 말랑한 파스텔 + 사이트 테마(맑은 에코그린) ──
// 시범 적용 장면(def.clay)에서만 씀. 색은 이 팔레트에서만 고름
export const CLAY = {
  cream: 0xfff1d8, white: 0xf4f5ef,
  green: 0x4fbb80, greenDeep: 0x23864f, mint: 0x9fdcb8,
  blue: 0x6eb0ef, blueDeep: 0x3a7fd8,
  yellow: 0xf6c84c, yellowDeep: 0xe09a22,
  coral: 0xee7f68, wood: 0xdcae78, silver: 0xcfd6db
};

// 손으로 빚은 점토 표면: 물건 자체 좌표의 잔무늬로 빛 받는 방향(법선)을 살짝 흔들고 색도 아주 조금 얼룩지게 함
//  - 그림 파일 없이 셰이더에서 계산. 물건 좌표를 쓰므로 움직여도 무늬가 따라가고, 크기를 키워도 무늬 굵기는 일정
//  - 높이 = 굵은 덩어리(손으로 누른 자국) + 잔 알갱이. 물건 좌표에서 기울기를 직접 구해 법선을 기울임(픽셀 깨짐 없음)
//  - 세기: GRAIN(빛 받는 방향 흔들림), MOTTLE(색 얼룩). 조각 하나당 잡음 9번 계산이라 작은 3D 화면에선 부담 적음
const GRAIN = "0.32", MOTTLE = "0.035";
function clayGrain(shader) {
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", "#include <common>\nvarying vec3 vClayPos, vClayX, vClayY, vClayZ;")
    .replace("#include <begin_vertex>", "#include <begin_vertex>\n" +
      "vClayPos = transformed * vec3(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz), length(modelMatrix[2].xyz));\n" +
      "vClayX = normalize(mat3(modelViewMatrix) * vec3(1.0, 0.0, 0.0));\n" +
      "vClayY = normalize(mat3(modelViewMatrix) * vec3(0.0, 1.0, 0.0));\n" +
      "vClayZ = normalize(mat3(modelViewMatrix) * vec3(0.0, 0.0, 1.0));");
  shader.fragmentShader = shader.fragmentShader
    .replace("#include <common>", "#include <common>\nvarying vec3 vClayPos, vClayX, vClayY, vClayZ;\n" +
      "float clayHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }\n" +
      "float clayNoise(vec3 x) { vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);\n" +
      "  return mix(mix(mix(clayHash(i), clayHash(i + vec3(1, 0, 0)), f.x), mix(clayHash(i + vec3(0, 1, 0)), clayHash(i + vec3(1, 1, 0)), f.x), f.y),\n" +
      "             mix(mix(clayHash(i + vec3(0, 0, 1)), clayHash(i + vec3(1, 0, 1)), f.x), mix(clayHash(i + vec3(0, 1, 1)), clayHash(i + vec3(1, 1, 1)), f.x), f.y), f.z); }\n" +
      "float clayHeight(vec3 p) { return clayNoise(p * 9.0) * 0.05 + clayNoise(p * 20.0) * 0.008; }")
    .replace("#include <color_fragment>", "#include <color_fragment>\n" +
      "diffuseColor.rgb *= 1.0 - " + MOTTLE + " + 2.0 * " + MOTTLE + " * clayNoise(vClayPos * 3.0);")
    .replace("#include <normal_fragment_maps>", "#include <normal_fragment_maps>\n" +
      "{ float h0 = clayHeight(vClayPos);\n" +
      "  vec3 g = vec3(clayHeight(vClayPos + vec3(0.004, 0.0, 0.0)), clayHeight(vClayPos + vec3(0.0, 0.004, 0.0)), clayHeight(vClayPos + vec3(0.0, 0.0, 0.004))) - h0;\n" +
      "  vec3 gv = (g.x * vClayX + g.y * vClayY + g.z * vClayZ) / 0.004;\n" +
      "  #ifdef DOUBLE_SIDED\n  gv *= faceDirection;\n  #endif\n" +
      "  normal = normalize(normal - " + GRAIN + " * (gv - dot(gv, normal) * normal)); }");
}
function grainKey() { return "clay-grain"; }

// 무광에 가까운 부드러운 점토 재질 (가장자리에 은은한 윤기, 표면은 손으로 빚은 잔무늬)
// extra.grain === false 이면 무늬 없이 매끈하게 (화면·유리처럼 매끈해야 하는 것)
export function clayMat(THREE, color, extra) {
  const opt = Object.assign({}, extra || {});
  const grain = opt.grain !== false;
  delete opt.grain;
  const m = new THREE.MeshPhysicalMaterial(Object.assign({
    color: color, roughness: 0.62, metalness: 0, sheen: 0.3, sheenRoughness: 0.7, sheenColor: 0xffffff,
    clearcoat: 0.1, clearcoatRoughness: 0.7
  }, opt));
  if (grain) {
    m.onBeforeCompile = clayGrain;
    m.customProgramCacheKey = grainKey;
  }
  return m;
}

// 둥글둥글한 수거함: 아래가 둥글게 말린 몸통 + 두툼한 테두리 + 앞 스티커. 바닥이 y=0, 처음엔 숨김
export function clayBin(THREE, top, bottom, height, color, rimColor, stickerMap) {
  const g = new THREE.Group();
  const pts = [[0, 0], [bottom - 0.12, 0], [bottom - 0.03, 0.03], [bottom, 0.12], [top, height - 0.05], [top, height]];
  const wall = new THREE.Mesh(new THREE.LatheGeometry(pts.map(function (p) { return new THREE.Vector2(p[0], p[1]); }), 64), clayMat(THREE, color, { side: THREE.DoubleSide }));
  const rim = new THREE.Mesh(new THREE.TorusGeometry(top, Math.min(0.075, top * 0.1), 16, 72), clayMat(THREE, rimColor));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = height;
  const sw = top * 0.95;
  const sticker = new THREE.Mesh(new THREE.PlaneGeometry(sw, sw * 0.62), new THREE.MeshStandardMaterial({ map: stickerMap, roughness: 0.6, transparent: true }));
  sticker.position.set(0, height * 0.5, (top + bottom) / 2 + 0.025);
  sticker.rotation.x = -Math.atan((top - bottom) / height);
  g.add(wall, rim, sticker);
  g.visible = false;
  return g;
}

// 부드러운 움직임 곡선
// 기울여 쏟기(p 0~1): 살짝 뒤로 젖혔다가(준비) → 기울여 머묾 → 바로 세울 때 살짝 지나쳤다 돌아옴
export function tiltCurve(p) {
  const prep = p < 0.12 ? -0.06 * Math.sin(Math.PI * p / 0.12) : 0;
  const up = easeInOut(clamp01((p - 0.1) / 0.25));
  const back = backOut(clamp01((p - 0.72) / 0.28));
  return up * (1 - back) + prep;
}
// 통통 튀며 내려앉기: 0→1로 갈 때 바닥에 닿고 두 번 작게 튐 (높이 비율 반환, 0이 바닥)
export function bounceDrop(t) {
  t = clamp01(t);
  if (t < 0.6) return 1 - Math.pow(t / 0.6, 2);
  if (t < 0.85) return 0.18 * Math.sin(Math.PI * (t - 0.6) / 0.25);
  return 0.05 * Math.sin(Math.PI * (t - 0.85) / 0.15);
}
// 내려앉은 뒤 흔들림이 잦아듦 (t 0~1, 진폭 1에서 0으로)
export function wobble(t, times) {
  t = clamp01(t);
  return Math.sin(t * Math.PI * 2 * (times || 3)) * Math.pow(1 - t, 2);
}
