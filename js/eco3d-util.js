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
