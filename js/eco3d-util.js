// 3D 장면들이 함께 쓰는 계산·텍스처·물방울 도우미
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

// 위가 열린 둥근 수거함 (앞에 스티커)
export function binGroup(THREE, top, bottom, height, color, rimColor, stickerMap) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.5, side: THREE.DoubleSide });
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(top, bottom, height, 48, 1, true), mat);
  wall.position.y = height / 2;
  const floor = new THREE.Mesh(new THREE.CircleGeometry(bottom, 48), mat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.01;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(top, 0.045, 10, 64), new THREE.MeshStandardMaterial({ color: rimColor, roughness: 0.4 }));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = height;
  const sw = top * 0.95;
  const sticker = new THREE.Mesh(new THREE.PlaneGeometry(sw, sw * 0.62), new THREE.MeshStandardMaterial({ map: stickerMap, roughness: 0.5, transparent: true }));
  const mid = (top + bottom) / 2;
  sticker.position.set(0, height * 0.52, mid + 0.02);
  sticker.rotation.x = -Math.atan((top - bottom) / height);
  g.add(wall, floor, rim, sticker);
  g.visible = false;
  return g;
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
