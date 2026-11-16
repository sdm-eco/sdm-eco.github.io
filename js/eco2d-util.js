// 그림(2D) 체험 장면들이 함께 쓰는 그리기 도구 (eco2d.js 장면 파일에서 가져다 씀)
// 좌표는 모두 eco2d.js의 설계 크기(820×760) 기준

// 그림 한 장 그리기: (x, y)를 기준점으로, 기준점은 그림 안 (px, py) 비율 자리(0~1, 기본 아래 가운데)
// o: { alpha, rot, sx, sy, px, py }
export function put(ctx, im, x, y, w, h, o) {
  o = o || {};
  if ((o.alpha ?? 1) <= 0.001) return;
  ctx.save();
  ctx.globalAlpha = o.alpha ?? 1;
  ctx.translate(x, y);
  if (o.rot) ctx.rotate(o.rot);
  ctx.scale(o.sx ?? 1, o.sy ?? 1);
  ctx.drawImage(im, -w * (o.px ?? 0.5), -h * (o.py ?? 1), w, h);
  ctx.restore();
}

// 바닥 그림자 (부드러운 타원): x 가운데, gy 바닥선, w 폭, a 진하기(0~1)
export function shadow(ctx, x, gy, w, a) {
  if (a <= 0.01) return;
  const g = ctx.createRadialGradient(x, gy, 0, x, gy, w / 2);
  g.addColorStop(0, `rgba(30,60,45,${0.22 * a})`);
  g.addColorStop(1, "rgba(30,60,45,0)");
  ctx.save();
  ctx.translate(x, gy);
  ctx.scale(1, 0.18);
  ctx.translate(-x, -gy);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, gy, w / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// 물방울 만들기: 매 그림마다 부르면 every초마다 (x, y)에서 하나씩 생김 (s.mem.drops에 쌓임)
// spread: 가로 흩어짐, vx·vy: 처음 속도(범위의 가운데), 방울은 dropsDraw가 움직이고 그림
export function dropsEmit(s, x, y, o) {
  o = o || {};
  const m = s.mem;
  m.drops = m.drops || [];
  m.dropAcc = (m.dropAcc || 0) + s.dt;
  const every = o.every || 0.025;
  while (m.dropAcc > every) {
    m.dropAcc -= every;
    m.drops.push({
      x: x + (Math.random() - 0.5) * (o.spread ?? 8), y: y,
      vx: (o.vx ?? -25) + (Math.random() - 0.5) * 30, vy: (o.vy ?? 55) + (Math.random() - 0.5) * 30,
      r: (o.r ?? 3) + Math.random() * 3
    });
  }
}
// 물방울 움직이고 그리기: 중력으로 떨어지다 바닥선(gy)에 닿으면 사라짐
export function dropsDraw(ctx, s, gy, color) {
  const list = s.mem.drops;
  if (!list || !list.length) return;
  ctx.save();
  ctx.fillStyle = color || "rgba(150,205,240,0.75)";
  for (let i = list.length - 1; i >= 0; i--) {
    const d = list[i];
    d.vy += 900 * s.dt;
    d.x += d.vx * s.dt;
    d.y += d.vy * s.dt;
    if (d.y > gy) { list.splice(i, 1); continue; }
    ctx.beginPath();
    ctx.ellipse(d.x, d.y, d.r * 0.8, d.r * 1.3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// 사이트 언어로 된 글자 (i18n.js의 window.I18N, 없으면 한국어)
export function t(key) {
  const L = window.I18N || {};
  const lang = (document.documentElement.lang || "ko").slice(0, 2);
  return (L[lang] && L[lang][key]) || (L.ko && L.ko[key]) || "";
}
const FONT = '"Pretendard Variable", "Pretendard Std Variable", system-ui, sans-serif';
// 상자 (left, top, w, h) 안에 글자를 가운데 맞춤, 넘치면 글자 크기를 줄임
export function fitText(ctx, text, cx, cy, maxW, size, weight, color) {
  ctx.save();
  ctx.fillStyle = color || "#1f5a9e";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  size = Math.round(size);
  ctx.font = `${weight || 800} ${size}px ${FONT}`;
  while (ctx.measureText(text).width > maxW && size > 8) {
    size--;
    ctx.font = `${weight || 800} ${size}px ${FONT}`;
  }
  ctx.fillText(text, cx, cy);
  ctx.restore();
}
// 분리배출 표시 (구청 2차 의견 2-8 '재활용 마크를 정확하게'): 한국환경공단이 배포하는 공식 도안 파일을 그대로 씀
//  - img/scene/common/mark-*.svg: 한국환경공단 분리배출표시제도 '재질별 분리배출표시 기본도안' ai 파일의 벡터를 그대로 옮긴 것(모양·색 그대로)
//  - 페트는 '무색페트', 캔은 '캔류 · 알미늄'(공식 도안은 캔류 아래에 재질을 씀), 우유팩 같은 살균팩은 '일반팩', 유리는 '유리'
//  - 이 파일은 페이지를 열 때 eco3d.js와 함께 불러오므로 여기서 미리 받아 두면 수거함이 나올 때는 이미 받아져 있음
const MARK = {};
[["item.pet", "pet"], ["item.can", "can"], ["item.glass", "glass"], ["item.carton", "carton"]].forEach(function (p) {
  const im = new Image();
  im.src = "img/scene/common/mark-" + p[1] + ".svg";
  MARK[p[0]] = im;
});
// 두 줄까지 허용하는 글자: 너무 길면 띄어쓰기(없으면 가운데 글자)에서 나눠 두 줄로
function fitText2(ctx, text, cx, cy, maxW, size, weight, color) {
  ctx.save(); ctx.font = `${weight} ${Math.round(size)}px ${FONT}`;
  const one = ctx.measureText(text).width <= maxW; ctx.restore();
  if (one || text.length < 4) { fitText(ctx, text, cx, cy, maxW, size, weight, color); return; }
  const sp = text.split(" ");
  let a, b;
  if (sp.length > 1) {
    let best = 1, diff = 1e9;
    for (let k = 1; k < sp.length; k++) { const d = Math.abs(sp.slice(0, k).join(" ").length - sp.slice(k).join(" ").length); if (d < diff) { diff = d; best = k; } }
    a = sp.slice(0, best).join(" "); b = sp.slice(best).join(" ");
  } else { const m = Math.ceil(text.length / 2); a = text.slice(0, m); b = text.slice(m); }
  fitText(ctx, a, cx, cy - size * 0.58, maxW, size * 0.92, weight, color);
  fitText(ctx, b, cx, cy + size * 0.58, maxW, size * 0.92, weight, color);
}
// 재활용 수거함(페트·캔·유리·종이팩, 같은 원본 통 그림 bin.webp ≈361×440)의 앞 테두리 윗선 [x, y]
//  입구 안쪽(어두움)이 끝나고 테두리(밝음)가 시작하는 줄을 열마다 잰 값. 원근 때문에 오른쪽이 조금 높음
const RIM_FRONT = [[90, 71], [120, 74], [150, 71], [180, 68], [210, 64], [240, 61], [270, 57], [300, 54]];
// 물건이 수거함에 들어갈 때 앞 테두리 윗선 아래를 가림(앞 벽 뒤로 들어가는 모습)
//  (left, top) = 그림 왼쪽 위, kx·ky = 그림 1px의 장면 크기. 입구 안쪽 중간 높이에서 수평으로 자르면 물건이 입구 안에서 잘려 떠 보임
export function clipBelowRim(ctx, left, top, kx, ky) {
  const P = RIM_FRONT.map(function (p) { return [left + p[0] * kx, top + p[1] * ky]; });
  ctx.beginPath();
  ctx.moveTo(-500, -500); ctx.lineTo(2000, -500);
  ctx.lineTo(2000, P[P.length - 1][1]);
  for (let j = P.length - 1; j >= 0; j--) ctx.lineTo(P[j][0], P[j][1]);
  ctx.lineTo(-500, P[0][1]);
  ctx.closePath();
  ctx.clip();
}
// 수거함 앞 이름표: 왼쪽에 분리배출 표시(공식 도안 그림), 오른쪽에 품목 이름(사이트 언어, 두 줄까지). 그림에는 글자를 넣지 않고 여기서 씀
// 공식 도안이 없는 통(공용 재활용 수거함·건전지·형광등·폐의약품)은 표시 없이 이름만 이름표 가운데에
//  분리배출 표시 공식 도안은 재질별(페트·캔류·유리·종이팩 등)로만 있어 '재활용품 전체'나 건전지를 뜻하는 것이 없음
// 품목 이름 색은 통 색을 따름: 초록 통(페트·유리·공용)은 진한 초록, 노랑 통(캔·종이팩)은 진한 갈색 (흰 이름표 위 대비 4.5 이상)
const INK = { "item.pet": "#2c6b34", "item.glass": "#2c6b34", "cat.recycle": "#2c6b34", "item.can": "#7a4f00", "item.carton": "#7a4f00" };
export function binLabel(ctx, key, left, top, w, h, color) {
  color = color || INK[key] || "#1f5a9e";
  const im = MARK[key];
  if (!im) {
    // 이름만: 띄어쓰기가 있는 긴 이름(영어·베트남어)은 띄어쓰기에서 두 줄로, 띄어쓰기가 없으면 한 줄에 맞게 글자를 줄임
    const name = t(key);
    (name.indexOf(" ") > 0 ? fitText2 : fitText)(ctx, name, left + w / 2, top + h / 2, w * 0.9, h * 0.34, 800, color);
    return;
  }
  const col = Math.min(h * 0.98, w * 0.46);             // 왼쪽 표시 칸 폭
  const mx = left + w * 0.04 + col / 2;
  // 공식 도안 그림: 비율을 지켜 표시 칸(칸 폭의 94%, 이름표 높이의 84%) 가운데에. 아직 받지 못했으면 그리지 않음
  if (im.complete && im.naturalWidth) {
    const k = Math.min(col * 0.94 / im.naturalWidth, h * 0.84 / im.naturalHeight);
    const dw = im.naturalWidth * k, dh = im.naturalHeight * k;
    ctx.drawImage(im, mx - dw / 2, top + h / 2 - dh / 2, dw, dh);
  }
  const nx = left + w * 0.04 + col + (w * 0.96 - col) / 2;
  fitText2(ctx, t(key), nx, top + h / 2, (w * 0.92 - col), h * 0.24, 800, color);
}
