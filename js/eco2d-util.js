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
// 분리배출 표시 (구청 2차 의견 2-8 '재활용 마크를 정확하게'): 환경부고시 제2021-140호 「분리배출 표시에 관한 지침」 별표 도안
//  - 화살표 3개가 시계 방향으로 돌며 정삼각형을 이루고(화살표 뒷부분은 120°로 꺾임), 가운데에 도안 내부 표시 문자
//  - 세부 재질(캔류의 철·알루미늄)은 삼각형 아래. 표시 문자는 제품에 찍힌 그대로 한국어(외국인도 제품에서 이 글자를 찾게 됨)
//  - 색은 고시 표의 권장 색(무색페트 노랑·캔류 회색·유리 주황·일반팩 녹색). 흰 이름표 위에서 읽히게 조금 진하게
//  - 우유팩 같은 살균팩은 '일반팩'(멸균팩과 구분), 페트는 '무색페트'
const MARK = {
  "item.pet": { text: "무색페트", color: "#c99400" },
  // 고시 도안은 캔류 아래에 세부 재질(철·알루미늄)을 쓰지만, 수거함 이름표 크기에서는 읽히지 않아 '캔류'만 씀
  "item.can": { text: "캔류", color: "#6f757c" },
  "item.glass": { text: "유리", color: "#d9631c" },
  "item.carton": { text: "일반팩", color: "#2e8b3a" }
};
// 정삼각형 분리배출 표시: (cx, cy) = 삼각형 무게중심, s = 한 변 길이. text가 없으면 화살표만(공용 재활용 표시)
function markTri(ctx, cx, cy, s, color, text) {
  const lw = s * 0.11, R = s / Math.sqrt(3);          // 선 굵기, 꼭짓점까지 거리
  const P = [0, 1, 2].map(function (i) { const a = -Math.PI / 2 + i * Math.PI * 2 / 3; return [cx + Math.cos(a) * R, cy + Math.sin(a) * R]; });
  const lerp2 = function (a, b, k) { return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]; };
  ctx.save();
  ctx.strokeStyle = ctx.fillStyle = color; ctx.lineWidth = lw; ctx.lineCap = "butt"; ctx.lineJoin = "miter";
  for (let i = 0; i < 3; i++) {
    const a = P[i], b = P[(i + 1) % 3], prev = P[(i + 2) % 3];
    // 꼬리: 앞 변 끝부분(꼭짓점 a 앞)에서 시작해 꼭짓점 a에서 120°로 꺾여 이번 변을 따라감
    const tail = lerp2(a, prev, 0.13), end = lerp2(a, b, 0.58);
    ctx.beginPath(); ctx.moveTo(tail[0], tail[1]); ctx.lineTo(a[0], a[1]); ctx.lineTo(end[0], end[1]); ctx.stroke();
    // 화살촉: 이번 변 방향(다음 꼭짓점 쪽)으로
    const d = Math.atan2(b[1] - a[1], b[0] - a[0]), ah = lw * 2.1, tip = lerp2(a, b, 0.58 + 0.17);
    const bx = tip[0] - Math.cos(d) * ah, by = tip[1] - Math.sin(d) * ah;
    ctx.beginPath();
    ctx.moveTo(tip[0], tip[1]);
    ctx.lineTo(bx + Math.cos(d + Math.PI / 2) * ah * 0.95, by + Math.sin(d + Math.PI / 2) * ah * 0.95);
    ctx.lineTo(bx - Math.cos(d + Math.PI / 2) * ah * 0.95, by - Math.sin(d + Math.PI / 2) * ah * 0.95);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  if (!text) return;
  // 가운데 표시 문자: 화살표 띠와 겹쳐도 읽히게 흰 테두리를 두른 뒤 채움
  let size = Math.round(s * (text.length > 3 ? 0.25 : text.length > 2 ? 0.29 : 0.33));
  ctx.save();
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.font = `900 ${size}px ${FONT}`;
  while (ctx.measureText(text).width > s * 0.9 && size > 7) { size--; ctx.font = `900 ${size}px ${FONT}`; }
  ctx.lineJoin = "round"; ctx.lineWidth = size * 0.32; ctx.strokeStyle = "#ffffff";
  ctx.strokeText(text, cx, cy + s * 0.05);
  ctx.fillStyle = color; ctx.fillText(text, cx, cy + s * 0.05);
  ctx.restore();
}
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
// 수거함 앞 이름표: 왼쪽에 분리배출 표시(정삼각형), 오른쪽에 품목 이름(사이트 언어, 두 줄까지). 그림에는 글자를 넣지 않고 여기서 씀
// 공용 재활용 수거함·폐건전지는 글자 없는 표시, 폐의약품은 재활용품이 아니라 표시 없이 이름만
// 품목 이름 색은 통 색을 따름: 초록 통(페트·유리·공용)은 진한 초록, 노랑 통(캔·종이팩)은 진한 갈색 (흰 이름표 위 대비 4.5 이상)
const INK = { "item.pet": "#2c6b34", "item.glass": "#2c6b34", "cat.recycle": "#2c6b34", "item.can": "#7a4f00", "item.carton": "#7a4f00" };
export function binLabel(ctx, key, left, top, w, h, color) {
  color = color || INK[key] || "#1f5a9e";
  if (key === "item.medicine") { fitText(ctx, t(key), left + w / 2, top + h / 2, w * 0.9, h * 0.34, 800, color); return; }
  const m = MARK[key];
  const col = Math.min(h * 0.98, w * 0.46);             // 왼쪽 표시 칸 폭
  const s = col * (m && m.sub ? 0.78 : 0.9);              // 삼각형 한 변
  const mx = left + w * 0.04 + col / 2;
  const triH = s * Math.sqrt(3) / 2;
  const my = top + h * 0.5 - (m && m.sub ? h * 0.08 : 0) + triH / 6;   // 무게중심(위로 1/3)
  markTri(ctx, mx, my, s, m ? m.color : color, m ? m.text : "");
  if (m && m.sub) fitText(ctx, m.sub, mx, my + triH / 3 + h * 0.13, col, h * 0.15, 800, m.color);
  const nx = left + w * 0.04 + col + (w * 0.96 - col) / 2;
  fitText2(ctx, t(key), nx, top + h / 2, (w * 0.92 - col), h * 0.24, 800, color);
}
