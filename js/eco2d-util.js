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
// 수거함 앞 이름표: ♻ + 품목 이름(key = i18n 키, 예 "item.pet"). 그림에는 글자를 넣지 않고 여기서 씀
export function binLabel(ctx, key, left, top, w, h, color) {
  fitText(ctx, "♻", left + w / 2, top + h * 0.3, w, h * 0.3, 700, color);
  fitText(ctx, t(key), left + w / 2, top + h * 0.7, w * 0.9, h * 0.3, 800, color);
}
