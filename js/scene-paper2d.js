// 종이류 장면 — 그림(2D)
// 서대문구청 안내: 종이류는 이물질(테이프·운송장 스티커 등)을 떼고, 상자는 펴서, 차곡차곡 쌓아 묶어서 배출
// 그림: img/scene/paper/*.webp (paper_assets.py가 만듦, 위치는 meta.json 값을 아래 숫자로 옮김)
//       신문 더미·끈·뭉친 테이프는 그림이 없어 도형으로 그림
// 단계 값은 3D 장면(scene-paper.js)과 같아 효과음 순간도 같게 맞춤
import { clamp01, smooth, easeInOut, backOut, lerp, wobble } from "./eco3d-util.js?v=20261108r";
import { sfx, hit } from "./eco3d-sound.js?v=20261108r";
import { put, shadow as shade } from "./eco2d-util.js?v=20261108r";

const D = "img/scene/paper/";
// 그림 조각의 원래 크기와 그 안의 위치 (paper_assets.py가 잰 값)
const BOX = { w: 416, h: 400 };
const TAPE = { x: 72, y: 8, w: 301, h: 333 };
const LABEL = { x: 77, y: 161, w: 177, h: 179 };
// 펼친 상자: 윗면을 평행사변형으로 본 꼭짓점(앞 왼쪽)과 두 변(앞 변 e1, 안쪽 변 e2), 그림 크기 기준
const FLAT = { w: 420, h: 260, p0: [5, 205], e1: [295, 60], e2: [118, -180] };

// 장면 배치 (설계 크기 820×760 기준, eco2d.js)
const GY = 700;             // 바닥선
const BOX_X = 212;          // 택배 상자 자리(가운데)
const KB = 360 / BOX.h;     // 상자 높이 360
const KF = 0.95;            // 펼친 상자 배율 (신문 더미 윗면에 맞춤)
// 신문 더미: 윗면 앞 왼쪽 꼭짓점 S0, 앞 변 E1, 안쪽 변 E2, 두께 T (펼친 상자 그림과 같은 기울기)
const E1 = [300, 61], E2 = [118, -160], T = 104;
const S0 = [800 - E1[0] - E2[0], GY - T - E1[1]];
const LIFT = 14;            // 펼친 상자 두께(끈이 상자 윗면을 지나도록)
const PILE = [72, GY - 8];  // 떼어 낸 테이프·운송장이 놓이는 바닥 자리

export default {
  kind: "2d",
  // peel 1 = 테이프·운송장을 뗌, flat 1 = 상자를 펴서 더미 위에 얹음, tie 1 = 끈으로 묶음
  states: [
    { peel: 0, flat: 0, tie: 0 },
    { peel: 1, flat: 0, tie: 0 },
    { peel: 1, flat: 1, tie: 0 },
    { peel: 1, flat: 1, tie: 1 }
  ],
  moves: [null, [["peel", 1.8]], [["flat", 2.2]], [["tie", 1.8]]],
  images: { box: D + "box-clean.webp", tape: D + "box-tape.webp", label: D + "box-label.webp", flat: D + "box-flat.webp" },
  draw: draw
};

function shadow(ctx, x, w, a) { shade(ctx, x, GY, w, a); }
// 신문 더미 위의 자리: u = 앞 변 방향(0~1), v = 안쪽 방향(0~1), z = 아래로 내려간 거리(px)
function P(u, v, z, dy) { return [S0[0] + E1[0] * u + E2[0] * v, S0[1] + E1[1] * u + E2[1] * v + z + (dy || 0)]; }

function draw(ctx, v, s) {
  const img = s.img;
  sounds(v);
  const tp = v.tie;
  const bundle = -Math.sin(Math.PI * clamp01((tp - 0.82) / 0.18)) * 12;   // 다 묶으면 묶음이 통 튐
  const fl = v.flat;
  const land = clamp01((fl - 0.9) / 0.1);
  const squish = fl < 1 ? wobble(land, 2) * 4 : 0;                         // 상자가 얹힐 때 더미가 출렁

  // 묶기 단계: 상자가 사라진 왼쪽이 비지 않게 묶음을 먼저 가운데로 끌어옴
  const shift = -180 * easeInOut(smooth(0, 0.18, tp));
  ctx.save();
  ctx.translate(shift, 0);

  // ── 신문 더미 ──
  shadow(ctx, S0[0] + (E1[0] + E2[0]) / 2 + 10, E1[0] + E2[0] + 40, 1);
  drawStack(ctx, bundle + squish);

  // ── 택배 상자 / 펼친 상자 ──
  drawBox(ctx, img, v, bundle);

  // ── 끈 ──
  if (tp > 0) drawTie(ctx, tp, bundle);
  ctx.restore();
}

// 택배 상자: 테이프·운송장 떼기 → 눌러 펴서 납작하게 → 뛰어서 신문 더미 위에 얹힘
function drawBox(ctx, img, v, bundle) {
  const pp = v.peel, fl = v.flat;
  const bw = BOX.w * KB, bh = BOX.h * KB;
  const left = BOX_X - bw / 2, top = GY - bh;
  const rip = pp < 1 ? wobble(clamp01((pp - 0.12) / 0.45), 2) * 0.03 : 0;

  // 펴기: 쭉 늘었다가(준비) 꾹 눌려 납작해지며 펼친 상자 그림으로 바뀜
  const stretch = fl > 0 && fl < 0.12 ? Math.sin(Math.PI * fl / 0.12) : 0;
  const f = easeInOut(clamp01((fl - 0.1) / 0.38));
  const spread = backOut(clamp01((fl - 0.1) / 0.45));
  const morph = smooth(0.45, 0.9, f);
  // 옮기기: 바닥 자리 → 신문 더미 위 (포물선, 공중에서 살짝 기울어짐)
  const move = clamp01((fl - 0.5) / 0.5);
  const hx = easeInOut(Math.min(move / 0.8, 1));
  const air = Math.sin(Math.PI * Math.min(move / 0.8, 1));
  const fw = FLAT.w * KF, fh = FLAT.h * KF;
  // 펼친 상자를 더미 위에 얹었을 때 그림 아래 가운데 자리 (그림의 윗면 꼭짓점을 더미 윗면 안쪽에 맞춤)
  const onX = S0[0] + 0.03 * E1[0] + 0.03 * E2[0] - FLAT.p0[0] * KF + fw / 2;
  const onY = S0[1] + 0.03 * E1[1] + 0.03 * E2[1] - FLAT.p0[1] * KF + fh + 4;
  const fx = lerp(BOX_X, onX, hx);
  const fy = lerp(GY, onY, hx) - air * 120 + (fl >= 1 ? bundle : 0);

  // 바닥 그림자: 상자 자리에서 떠나면 옅어짐
  shadow(ctx, BOX_X + 10, lerp(bw * 1.1, fw, morph), 1 - smooth(0.5, 0.7, fl));

  if (morph < 1) {
    ctx.save();
    ctx.translate(BOX_X, GY);
    ctx.rotate(rip);
    ctx.scale(lerp(1, 1.06, spread), lerp(1, 0.3, f) * (1 + stretch * 0.06));
    ctx.globalAlpha = 1 - morph;
    ctx.drawImage(img.box, -bw / 2, -bh, bw, bh);
    // 아직 붙어 있는 테이프·운송장 (떼기 전)
    if (pp < 1e-3) {
      ctx.drawImage(img.tape, -bw / 2 + TAPE.x * KB, -bh + TAPE.y * KB, TAPE.w * KB, TAPE.h * KB);
      ctx.drawImage(img.label, -bw / 2 + LABEL.x * KB, -bh + LABEL.y * KB, LABEL.w * KB, LABEL.h * KB);
    }
    ctx.restore();
  }
  if (morph > 0) {
    put(ctx, img.flat, fx, fy, fw, fh, { alpha: morph, rot: air * -0.12, sy: lerp(0.6, 1, morph) });
  }

  // 떼는 중 / 떼어 낸 테이프·운송장 (상자를 펴기 시작하면 사라짐 = 종량제 봉투로)
  if (pp > 0) {
    const gone = 1 - smooth(0, 0.18, fl);
    if (gone > 0.01) drawPeel(ctx, img, pp, left, top, gone);
  }
}

// 1단계: 테이프 끝이 살짝 들렸다가 쭉 벗겨져 날아가 바닥에 뭉쳐지고, 운송장은 모서리부터 벗겨져 바닥에 떨어짐
function drawPeel(ctx, img, pp, left, top, alpha) {
  const lift = pp < 0.15 ? Math.sin(Math.PI * pp / 0.15) : 0;
  const t1 = easeInOut(clamp01((pp - 0.12) / 0.5));
  const t2 = easeInOut(clamp01((pp - 0.4) / 0.6));
  // 테이프: 붙은 자리 가운데에서 왼쪽 바닥으로 (줄어들며 돌다가 뭉친 테이프로 바뀜)
  const tw = TAPE.w * KB, th = TAPE.h * KB;
  const tx0 = left + (TAPE.x + TAPE.w / 2) * KB, ty0 = top + (TAPE.y + TAPE.h / 2) * KB;
  const ball = smooth(0.7, 0.95, t1);
  if (t1 < 0.95) {
    const x = lerp(tx0, PILE[0], t1), y = lerp(ty0 - lift * 6, PILE[1] - 14, t1) - Math.sin(Math.PI * t1) * 140;
    put(ctx, img.tape, x, y, tw, th, { px: 0.5, py: 0.5, rot: -lift * 0.04 - t1 * 2.4, sx: lerp(1, 0.18, t1), sy: lerp(1, 0.18, t1), alpha: alpha * (1 - ball) });
  }
  if (ball > 0) tapeBall(ctx, PILE[0], PILE[1], alpha * ball);
  // 운송장: 오른쪽 모서리부터 젖혀지며(가로로 줄고 들림) 떨어져 바닥에 납작하게 놓임
  const lw = LABEL.w * KB, lh = LABEL.h * KB;
  const lx0 = left + LABEL.x * KB, ly0 = top + (LABEL.y + LABEL.h / 2) * KB;
  if (t2 <= 0) {
    put(ctx, img.label, lx0, ly0, lw, lh, { px: 0, py: 0.5, alpha: alpha });
    return;
  }
  const peel = smooth(0, 0.35, t2), fall = smooth(0.3, 1, t2);
  const x = lerp(lx0, PILE[0] + 82, fall), y = lerp(ly0, PILE[1] - 6, fall) - Math.sin(Math.PI * fall) * 70;
  const sc = lerp(1, 0.72, fall);
  put(ctx, img.label, x, y, lw * sc, lh * sc, {
    px: lerp(0, 0.5, fall), py: lerp(0.5, 1, fall), alpha: alpha,
    rot: -0.22 * peel * (1 - fall) + lerp(0, -0.1, fall),
    sx: lerp(1, 0.7, peel) * lerp(1, 1 / 0.7, fall), sy: lerp(1, 0.5, fall)
  });
}

// 뭉친 테이프: 반투명 황갈색 덩어리 (그림이 없어 도형으로)
function tapeBall(ctx, x, gy, a) {
  ctx.save();
  ctx.globalAlpha = a;
  shadow(ctx, x, 80, 1);
  ctx.translate(x, gy - 17);
  ctx.scale(1.35, 1.35);
  const g = ctx.createRadialGradient(-6, -6, 2, 0, 0, 22);
  g.addColorStop(0, "rgba(250,236,205,0.95)");
  g.addColorStop(1, "rgba(214,176,120,0.9)");
  ctx.fillStyle = g;
  ctx.strokeStyle = "rgba(160,120,70,0.55)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  const pts = [[-22, 2], [-15, -12], [-2, -15], [12, -10], [21, -1], [17, 10], [2, 13], [-14, 11]];
  pts.forEach(function (p, i) { if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); });
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // 구김 선
  ctx.beginPath();
  ctx.moveTo(-12, -4); ctx.lineTo(-2, 2); ctx.lineTo(8, -6);
  ctx.moveTo(-6, 8); ctx.lineTo(4, 4); ctx.lineTo(13, 6);
  ctx.stroke();
  ctx.restore();
}

// 신문 더미: 종이 여러 장을 비스듬히 쌓은 덩어리 (앞면·오른쪽 면은 종이 끝이 겹친 줄, 윗면은 신문 1면)
function drawStack(ctx, dy) {
  const SHEETS = 6, sh = T / SHEETS;
  // 앞면과 오른쪽 면: 장마다 아주 조금씩 어긋나게
  for (let i = SHEETS - 1; i >= 0; i--) {
    const z0 = i * sh, z1 = z0 + sh;
    const off = [3, -2, 4, -3, 1, -1][i];
    const front = [P(0, 0, z0, dy), P(1, 0, z0, dy), P(1, 0, z1, dy), P(0, 0, z1, dy)];
    const side = [P(1, 0, z0, dy), P(1, 1, z0, dy), P(1, 1, z1, dy), P(1, 0, z1, dy)];
    front.forEach(function (p) { p[0] += off; });
    side.forEach(function (p) { p[0] += off; });
    poly(ctx, side, i % 2 ? "#ddd6c5" : "#e6e0d1", "rgba(150,140,120,0.45)");
    poly(ctx, front, i % 2 ? "#ebe5d6" : "#f4efe3", "rgba(150,140,120,0.45)");
  }
  // 윗면: 신문 1면 (제목 띠·글줄·사진 칸)
  ctx.save();
  ctx.transform(E1[0], E1[1], E2[0], E2[1], S0[0], S0[1] + dy);
  ctx.fillStyle = "#faf7ef";
  ctx.fillRect(0, 0, 1, 1);
  ctx.fillStyle = "#6f7d76";
  ctx.fillRect(0.07, 0.8, 0.86, 0.1);
  ctx.fillStyle = "#d3cdbd";
  for (let c = 0; c < 3; c++) for (let r = 0; r < 7; r++) {
    if (c === 1 && r < 4) continue;
    ctx.fillRect(0.07 + c * 0.3, 0.68 - r * 0.09, 0.25 - (r % 3) * 0.04, 0.035);
  }
  ctx.fillStyle = "#bcd9c8";
  ctx.fillRect(0.37, 0.4, 0.25, 0.3);
  ctx.restore();
  poly(ctx, [P(0, 0, 0, dy), P(1, 0, 0, dy), P(1, 1, 0, dy), P(0, 1, 0, dy)], null, "rgba(140,130,110,0.55)");
}

function poly(ctx, pts, fill, stroke) {
  ctx.beginPath();
  pts.forEach(function (p, i) { if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); });
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.2; ctx.stroke(); }
}

// 3단계: 끈 두 줄(앞뒤로 한 줄, 좌우로 한 줄)이 감기며 나타나 느슨했다가 꽉 조여지고 → 가운데에 나비 매듭이 톡
function drawTie(ctx, tp, dy) {
  const top = -LIFT;
  // 앞뒤 끈: 앞면 아래 → 앞 모서리 → 윗면을 지나 안쪽 끝 / 좌우 끈: 오른쪽 면 아래 → 오른쪽 모서리 → 윗면을 지나 왼쪽 끝
  const loops = [
    [P(0.5, 0, T, dy), P(0.5, 0, top, dy), P(0.5, 1, top, dy)],
    [P(1, 0.5, T, dy), P(1, 0.5, top, dy), P(0, 0.5, top, dy)]
  ];
  loops.forEach(function (pts, i) {
    const q = clamp01((tp - i * 0.2) / 0.55);
    if (q <= 0) return;
    const loose = (1 - backOut(clamp01((q - 0.45) / 0.55))) * 1;   // 다 감긴 뒤 조여짐(살짝 지나쳤다 돌아옴)
    const draw = smooth(0, 0.5, q);                                // 감기는 정도(끈 길이)
    cord(ctx, pts, draw, loose);
  });
  // 매듭
  const k = backOut(clamp01((tp - 0.75) / 0.2));
  if (k > 0.001) bow(ctx, P(0.5, 0.5, top, dy), k);
}

// 끈 한 줄: 꺾인 선을 따라 앞에서부터 frac만큼, loose만큼 바깥으로 불룩하게
function cord(ctx, pts, frac, loose) {
  const seg = [];
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    seg.push([a, b, len]);
    total += len;
  }
  let left = total * frac;
  const path = [];
  seg.forEach(function (sg, i) {
    if (left <= 0) return;
    const a = sg[0], b = sg[1], t = Math.min(1, left / sg[2]);
    left -= sg[2];
    // 느슨할 때는 가운데가 바깥(앞면은 왼쪽 앞, 윗면은 위)으로 불룩
    const nx = i === 0 ? -1 : 0, ny = i === 0 ? 0.3 : -1;
    for (let k = 0; k <= 12; k++) {
      const u = (k / 12) * t;
      const bulge = Math.sin(Math.PI * u) * 18 * loose;
      path.push([lerp(a[0], b[0], u) + nx * bulge, lerp(a[1], b[1], u) + ny * bulge]);
    }
  });
  if (path.length < 2) return;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  [["#8a5a2e", 9], ["#b78149", 6.5], ["rgba(236,196,140,0.8)", 2]].forEach(function (st) {
    ctx.strokeStyle = st[0];
    ctx.lineWidth = st[1];
    ctx.beginPath();
    path.forEach(function (p, i) { if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); });
    ctx.stroke();
  });
  ctx.restore();
}

// 나비 매듭: 양옆 고리 두 개 + 가운데 매듭 + 늘어진 끝 두 가닥
function bow(ctx, c, k) {
  ctx.save();
  ctx.translate(c[0], c[1]);
  ctx.scale(k, k);
  ctx.lineCap = "round";
  [["#8a5a2e", 9], ["#b78149", 6.5]].forEach(function (st) {
    ctx.strokeStyle = st[0];
    ctx.lineWidth = st[1];
    ctx.beginPath();
    ctx.ellipse(-20, -6, 20, 11, -0.35, 0, Math.PI * 2);
    ctx.moveTo(40, -6);
    ctx.ellipse(20, -6, 20, 11, 0.35, 0, Math.PI * 2);
    ctx.moveTo(-3, 3); ctx.quadraticCurveTo(-14, 16, -24, 26);
    ctx.moveTo(3, 3); ctx.quadraticCurveTo(12, 18, 26, 24);
    ctx.stroke();
  });
  ctx.fillStyle = "#9c6a38";
  ctx.beginPath();
  ctx.ellipse(0, -2, 8, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// 효과음 (3D 장면과 같은 순간)
function sounds(v) {
  if (hit(v, "peel", 0.12)) sfx.play("rip");          // 테이프 찌익
  if (hit(v, "peel", 0.4)) sfx.play("peel");          // 운송장 떼는 슥
  if (hit(v, "flat", 0.1)) sfx.play("paper", 0.84);   // 상자를 눌러 펴는 사각사각
  if (hit(v, "flat", 0.9)) sfx.play("tap");           // 신문 더미 위에 톡
  if (hit(v, "tie", 0.35)) sfx.play("tie");           // 끈 조이기 슥슥
  if (hit(v, "tie", 0.75)) sfx.play("tie");           // 매듭
  if (hit(v, "tie", 0.95)) sfx.play("chime");         // 끝 띵동
}
