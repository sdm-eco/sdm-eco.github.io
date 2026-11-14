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
// 분리배출 표시 (구청 2차 의견 2-8 '재활용 마크를 정확하게'): 제품에 찍힌 표시처럼 두 화살표가 둥근 고리를 이루고
// 가운데에 재질 이름. 재질 이름은 실제 표시 그대로 한국어(외국인도 제품에서 이 글자를 찾게 됨), 아래 품목 이름은 사이트 언어
const MARK = { "item.pet": "투명페트", "item.can": "캔류", "item.glass": "유리", "item.carton": "종이팩" };
function markLoop(ctx, cx, cy, w, h, text, color) {
  const lw = Math.max(1.5, h * 0.11), rx = w / 2 - lw, ry = h / 2 - lw, r = ry;
  const x0 = cx - rx + r, x1 = cx + rx - r;   // 둥근 양 끝 원의 중심
  const ah = lw * 1.9;                        // 화살촉 크기
  ctx.save();
  ctx.strokeStyle = ctx.fillStyle = color;
  ctx.lineWidth = lw; ctx.lineCap = "round";
  // 위쪽 화살표: 왼쪽 끝 원 아래에서 시작해 위를 지나 오른쪽 위에서 멈춤(시계 방향), 아래쪽도 같은 모양을 180도 돌려 그림
  [0, Math.PI].forEach(function (rot) {
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(rot); ctx.translate(-cx, -cy);
    ctx.beginPath();
    ctx.arc(x0, cy, r, Math.PI * 0.62, Math.PI * 1.5);
    ctx.lineTo(x1 - r * 0.15, cy - r);
    ctx.stroke();
    ctx.beginPath();                          // 화살촉(오른쪽을 향함)
    ctx.moveTo(x1 - r * 0.15 + ah, cy - r);
    ctx.lineTo(x1 - r * 0.15 - ah * 0.4, cy - r - ah * 0.75);
    ctx.lineTo(x1 - r * 0.15 - ah * 0.4, cy - r + ah * 0.75);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  });
  ctx.restore();
  fitText(ctx, text, cx, cy + h * 0.02, (x1 - x0) + r * 1.2, h * 0.42, 800, color);
}
// 재질 표시가 없는 공용 재활용 수거함·폐건전지: 세 화살표가 도는 삼각형 재활용 마크를 선으로 그림(글꼴 ♻에 기대지 않음)
function markTriangle(ctx, cx, cy, s, color) {
  const lw = Math.max(1.5, s * 0.12), R = s * 0.5, ah = lw * 1.7;
  const P = [0, 1, 2].map(function (i) { const a = -Math.PI / 2 + i * Math.PI * 2 / 3; return [cx + Math.cos(a) * R, cy + Math.sin(a) * R * 0.95]; });
  ctx.save();
  ctx.strokeStyle = ctx.fillStyle = color; ctx.lineWidth = lw; ctx.lineCap = "round"; ctx.lineJoin = "round";
  for (let i = 0; i < 3; i++) {
    const a = P[i], b = P[(i + 1) % 3];
    const ax = a[0] + (b[0] - a[0]) * 0.16, ay = a[1] + (b[1] - a[1]) * 0.16;
    const bx = a[0] + (b[0] - a[0]) * 0.74, by = a[1] + (b[1] - a[1]) * 0.74;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    const d = Math.atan2(b[1] - a[1], b[0] - a[0]);
    ctx.beginPath();
    ctx.moveTo(bx + Math.cos(d) * ah, by + Math.sin(d) * ah);
    ctx.lineTo(bx + Math.cos(d + 2.4) * ah, by + Math.sin(d + 2.4) * ah);
    ctx.lineTo(bx + Math.cos(d - 2.4) * ah, by + Math.sin(d - 2.4) * ah);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}
// 수거함 앞 이름표: 위에 분리배출 표시, 아래에 품목 이름(key = i18n 키, 예 "item.pet"). 그림에는 글자를 넣지 않고 여기서 씀
// 폐의약품은 재활용품이 아니라 표시 없이 이름만
// 글자색은 통 색을 따름: 초록 통(페트·유리·공용)은 진한 초록, 노랑 통(캔·종이팩)은 진한 갈색 (흰 이름표 위 대비 4.5 이상)
const INK = { "item.pet": "#2c6b34", "item.glass": "#2c6b34", "cat.recycle": "#2c6b34", "item.can": "#7a4f00", "item.carton": "#7a4f00" };
export function binLabel(ctx, key, left, top, w, h, color) {
  color = color || INK[key] || "#1f5a9e";
  const cx = left + w / 2;
  if (key === "item.medicine") { fitText(ctx, t(key), cx, top + h / 2, w * 0.9, h * 0.34, 800, color); return; }
  if (MARK[key]) markLoop(ctx, cx, top + h * 0.33, w * 0.78, h * 0.44, MARK[key], color);
  else markTriangle(ctx, cx, top + h * 0.33, h * 0.4, color);
  fitText(ctx, t(key), cx, top + h * 0.76, w * 0.9, h * 0.27, 800, color);
}
