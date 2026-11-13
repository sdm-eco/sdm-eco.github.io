// 헷갈리는 쓰레기 장면 ("재활용품인 척하는 쓰레기") — 그림(2D)
// 서대문구·서울시 안내: 칫솔·영수증·나무젓가락·고무장갑·테이프 등은 재활용이 안 되므로 종량제 봉투에,
// 컵라면 용기·유색 스티로폼은 깨끗이 씻어 재질별로 모으면 재활용, 아니면 종량제 봉투
// 그림: img/scene/confuse/*.webp (confuse_assets.py가 실사풍 그림을 조각으로 다듬음, 위치 값은 meta.json을 아래 숫자로 옮김)
//       수도꼭지는 공용 img/scene/common/faucet.webp (그림에 붙은 물줄기는 가리고 여기서 물줄기를 그림)
//       종량제 봉투·✕/✓ 표지는 그림이 없어 도형으로 그림
// 단계 값은 3D 장면(scene-confuse.js)과 같아 효과음 순간도 같게 맞춤
import { clamp01, smooth, easeInOut, backOut, lerp, tiltCurve, bounceDrop, wobble } from "./eco3d-util.js?v=20261108r";
import { sfx, hit } from "./eco3d-sound.js?v=20261108r";
import { put, shadow as shade, dropsEmit, dropsDraw, t, fitText, binLabel } from "./eco2d-util.js?v=20261108r";

const D = "img/scene/confuse/";
// 그림 조각의 원래 크기와 그 안의 위치 (confuse_assets.py가 잰 값)
const BIN = { w: 247, h: 300, rim: 25, label: { x: 96, y: 95, w: 110, h: 59 } };
const CUP = { w: 243, h: 230 };
const FAUCET = { w: 246, h: 300, spout: [23, 104], cut: 37 }; // 수도꼭지(spout = 물 나오는 끝, cut 왼쪽 아래 = 그림의 물줄기)

// 장면 배치 (설계 크기 820×760 기준, eco2d.js)
const GY = 700;          // 바닥선
const BIN_X = 150;       // 재활용품 수거함
const SIGN = [150, 318]; // 수거함 위 ✕/✓ 표지 가운데
const SIGN_R = 54;
const BAG_X = 665;       // 종량제 봉투
const BAG_GY = GY - 30;  // 봉투는 조금 뒤에 놓임(쓰레기들보다 안쪽)
const BK = 200;          // 봉투 크기 배율 (3D 단위 → 그림 px)
const CUP_X = 390;       // 컵라면 용기 자리
const KF = 0.72;         // 수도꼭지 배율 (봉투 매듭과 겹치지 않을 만큼)
const SPOUT = [CUP_X + 6, 300];

// 헷갈리는 쓰레기 5가지 (3D와 같은 순서): 그림 이름, 크기, 놓이는 자리(x, 바닥 y)
// 뒷줄(영수증·나무젓가락)은 조금 위에 놓아 앞줄과 겹쳐 보이게
const ITEMS = [
  { im: "toothbrush", w: 225, h: 200, x: 368, gy: GY },
  { im: "receipt", w: 122, h: 180, x: 462, gy: GY - 80 },
  { im: "chopsticks", w: 229, h: 170, x: 660, gy: GY - 92 },
  { im: "glove", w: 185, h: 230, x: 552, gy: GY },
  { im: "tape", w: 147, h: 150, x: 738, gy: GY }
];
const DRAW_ORDER = [1, 2, 0, 3, 4]; // 뒷줄 먼저

export default {
  kind: "2d",
  // show 1 = 헷갈리는 쓰레기가 나오고 재활용함에 ✕, bag 1 = 종량제 봉투에 담아 묶음, cup 1 = 컵라면 용기를 씻어 재활용함에
  states: [
    { show: 0, bag: 0, cup: 0 },
    { show: 1, bag: 0, cup: 0 },
    { show: 1, bag: 1, cup: 0 },
    { show: 1, bag: 1, cup: 1 }
  ],
  moves: [null, [["show", 2.4]], [["bag", 3.0]], [["cup", 3.6]]],
  images: {
    toothbrush: D + "toothbrush.webp", receipt: D + "receipt.webp", chopsticks: D + "chopsticks.webp",
    glove: D + "glove.webp", tape: D + "tape.webp",
    dirty: D + "cup-dirty.webp", clean: D + "cup-clean.webp", bin: D + "bin.webp",
    faucet: "img/scene/common/faucet.webp"
  },
  draw: draw
};

function shadow(ctx, x, w, a, gy) { shade(ctx, x, gy || GY, w, a); }

function draw(ctx, v, s) {
  const img = s.img;
  sounds(v);
  const sp = v.show, bp = v.bag, cp = v.cup;

  // ── 재활용품 수거함: 컵이 들어가면 출렁 ──
  const binLand = wobble(clamp01((cp - 0.9) / 0.1), 2);
  const binSy = 1 - binLand * 0.05;
  shadow(ctx, BIN_X, BIN.w * 1.05, 1);
  put(ctx, img.bin, BIN_X, GY, BIN.w, BIN.h, { sy: binSy });
  binLabel(ctx, "cat.recycle", BIN_X - BIN.w / 2 + BIN.label.x, GY - BIN.h * binSy + BIN.label.y * binSy, BIN.label.w, BIN.label.h * binSy);

  // ── 종량제 봉투: 떨어져 통통 튀고, 쓰레기가 들어갈 때마다 출렁, 끝에 입구를 묶음 ──
  let jiggle = 0;
  ITEMS.forEach(function (it, i) { jiggle += wobble(clamp01((bp - 0.45 - i * 0.1) / 0.14), 1); });
  const bagPop = backOut(clamp01(bp / 0.2));
  const tie = easeInOut(clamp01((bp - 0.8) / 0.18));
  const full = clamp01((bp - 0.15) / 0.6);
  let mouth = null;
  if (bp > 0) {
    const drop = bounceDrop(clamp01(bp / 0.22)) * 200;
    mouth = drawBag(ctx, BAG_X, BAG_GY, drop, Math.max(bagPop, 0.001), 1 - jiggle * 0.07, tie, full);
  }

  // ── 헷갈리는 쓰레기 ──
  DRAW_ORDER.forEach(function (i) { drawItem(ctx, img, ITEMS[i], i, sp, bp, mouth); });

  // ── 컵라면 용기: 씻기 → 물 쏟기 → 재활용함으로 ──
  faucet(ctx, img, cp);
  drawCup(ctx, img, s, cp, binSy);
  water(ctx, s, cp); // 물줄기는 컵 안으로 떨어지도록 컵 다음에 그림
  dropsDraw(ctx, s, GY);

  // ── 수거함 위 표지: ✕가 고개 젓듯 흔들리다, 컵이 들어가면 한 바퀴 뒤집혀 ✓ ──
  const xk = backOut(clamp01((sp - 0.62) / 0.3));
  if (xk > 0.001) {
    const flip = easeInOut(clamp01((cp - 0.84) / 0.12));
    const pop = 1 + 0.15 * Math.sin(clamp01((cp - 0.9) / 0.1) * Math.PI);
    ctx.save();
    ctx.translate(SIGN[0], SIGN[1]);
    ctx.rotate(wobble(clamp01((sp - 0.78) / 0.22), 2) * 0.35);
    ctx.scale(Math.max(xk * pop * Math.abs(Math.cos(Math.PI * flip)), 0.001), xk * pop);
    sign(ctx, flip >= 0.5);
    ctx.restore();
  }
}

// 쓰레기 하나: 1단계에 위에서 떨어져 통통 튀며 놓이고, 2단계에 움츠렸다 뛰어 봉투 입구로 쏙
function drawItem(ctx, img, it, i, sp, bp, mouth) {
  const k = clamp01((sp - i * 0.1) / 0.4);
  const q = clamp01((bp - 0.15 - i * 0.1) / 0.3);
  if (k <= 0 || q >= 1) return;
  const crouch = q > 0 && q < 0.15 ? Math.sin(Math.PI * q / 0.15) : 0;
  const f = easeInOut(clamp01((q - 0.12) / 0.88));
  const size = Math.max(backOut(clamp01(k / 0.5)), 0.001) * lerp(1, 0.45, smooth(0.1, 0.7, f));
  const land = q <= 0 ? wobble(clamp01((k - 0.55) / 0.45), 2) : 0;
  const sy = 1 - crouch * 0.2 - land * 0.1;
  const w = it.w * size, h = it.h * size;
  if (f <= 0) {
    // 바닥에 놓인 모습 (떨어지는 중이면 위에 떠 있음)
    const y = it.gy - bounceDrop(k) * 260;
    shadow(ctx, it.x, it.w * 0.9 * size, 1 - bounceDrop(k), it.gy);
    put(ctx, img[it.im], it.x, y, w / Math.sqrt(sy), h * sy);
    return;
  }
  // 날아가기: 포물선으로 봉투 입구 위 → 입구 아래로
  const mx = mouth ? mouth[0] : BAG_X, my = mouth ? mouth[1] : BAG_GY - 330;
  const x = lerp(it.x, mx, f);
  const yc = lerp(it.gy - it.h / 2, my + h / 2 + 30, f) - Math.sin(Math.PI * f) * 300;
  shadow(ctx, it.x, it.w * 0.9, 1 - smooth(0, 0.3, f), it.gy);
  ctx.save();
  if (f > 0.55) {
    ctx.beginPath();
    ctx.rect(-500, -500, 2000, my + 500);
    ctx.clip();
  }
  put(ctx, img[it.im], x, yc, w, h, { rot: f * Math.PI, py: 0.5 });
  ctx.restore();
}

// 종량제 봉투 (그림이 없어 도형으로): 크림색 비닐에 초록 띠 + '종량제 봉투' 글자, 위는 열린 목 → 묶으면 매듭
// x, gy: 바닥 가운데, lift: 떨어지는 높이, k: 크기(나타날 때), sq: 눌림(출렁), tie: 묶은 정도, full: 찬 정도
// 돌려주는 값: 입구 가운데 [x, y]
function drawBag(ctx, x, gy, lift, k, sq, tie, full) {
  const wide = (0.92 + full * 0.1) * k / Math.sqrt(sq), tall = (0.94 + full * 0.06) * k * sq;
  const U = BK;
  // 몸통 옆모습 (반지름, 높이) — 3D bagGroup의 회전체 단면과 같은 값
  const P = [[0, 0], [0.42, 0.02], [0.62, 0.14], [0.7, 0.45], [0.68, 0.82], [0.56, 1.04], [0.4, 1.15]];
  const neckH = 0.42 * lerp(1, 0.72, tie);
  const neckTop = lerp(0.5, 0.06, tie);    // 열려 있을 때는 입구가 바깥으로 벌어짐
  const waist = lerp(0.26, 0.18, tie);     // 목 가운데(잘록한 곳)
  const top = 1.15 + neckH;
  const X = function (r) { return r * U * wide; };
  const Y = function (h) { return gy - lift - h * U * tall; };
  shadow(ctx, x, X(0.7) * 2.1, k * (1 - lift / 200), gy);

  ctx.save();
  // 실루엣: 오른쪽 아래 → 위 → 목 → 왼쪽 → 아래
  ctx.beginPath();
  ctx.moveTo(x, Y(0));
  for (let i = 1; i < P.length; i++) {
    const a = P[i - 1], b = P[i];
    ctx.quadraticCurveTo(x + X(a[0]), Y(a[1]), x + X((a[0] + b[0]) / 2), Y((a[1] + b[1]) / 2));
  }
  ctx.lineTo(x + X(0.4), Y(1.15));
  ctx.quadraticCurveTo(x + X(waist), Y(1.15 + neckH * 0.5), x + X(neckTop), Y(top));
  ctx.lineTo(x - X(neckTop), Y(top));
  ctx.quadraticCurveTo(x - X(waist), Y(1.15 + neckH * 0.5), x - X(0.4), Y(1.15));
  for (let i = P.length - 1; i > 0; i--) {
    const a = P[i], b = P[i - 1];
    ctx.quadraticCurveTo(x - X(a[0]), Y(a[1]), x - X((a[0] + b[0]) / 2), Y((a[1] + b[1]) / 2));
  }
  ctx.closePath();
  // 둥근 몸통 느낌: 가로로 밝은 가운데 → 어두운 가장자리
  const g = ctx.createLinearGradient(x - X(0.72), 0, x + X(0.72), 0);
  g.addColorStop(0, "#d8d1bf");
  g.addColorStop(0.32, "#fffdf7");
  g.addColorStop(0.55, "#f7f3e8");
  g.addColorStop(1, "#cfc7b3");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  ctx.clip();
  // 초록 띠 두 줄 + 이름
  const b1 = Y(0.72), b2 = Y(0.55);
  ctx.fillStyle = "#6cc596";
  ctx.fillRect(x - X(0.8), b1, X(1.6), b2 - b1);
  ctx.fillRect(x - X(0.8), Y(0.5), X(1.6), Y(0.47) - Y(0.5));
  // 둥근 몸통이라 띠 양 끝을 어둡게
  const e = ctx.createLinearGradient(x - X(0.72), 0, x + X(0.72), 0);
  e.addColorStop(0, "rgba(40,60,50,0.22)");
  e.addColorStop(0.3, "rgba(40,60,50,0)");
  e.addColorStop(0.7, "rgba(40,60,50,0)");
  e.addColorStop(1, "rgba(40,60,50,0.25)");
  ctx.fillStyle = e;
  ctx.fillRect(x - X(0.8), Y(top), X(1.6), Y(0) - Y(top));
  // 비닐 주름 몇 줄
  ctx.strokeStyle = "rgba(120,110,90,0.16)";
  ctx.lineWidth = 2;
  [[-0.35, 0.2, 0.95], [0.18, 0.12, 0.4], [0.42, 0.85, 1.1], [-0.1, 0.9, 1.12]].forEach(function (c) {
    ctx.beginPath();
    ctx.moveTo(x + X(c[0]), Y(c[1]));
    ctx.quadraticCurveTo(x + X(c[0] + 0.08), Y((c[1] + c[2]) / 2), x + X(c[0] - 0.02), Y(c[2]));
    ctx.stroke();
  });
  // 목(입구 쪽)의 세로 주름: 얇은 비닐이 모인 느낌
  ctx.strokeStyle = "rgba(120,110,90,0.24)";
  [-0.8, -0.45, -0.1, 0.25, 0.6].forEach(function (f, i) {
    ctx.beginPath();
    ctx.moveTo(x + X(f * 0.4), Y(1.08));
    ctx.quadraticCurveTo(x + X(f * waist + (i % 2 ? 0.03 : -0.03)), Y(1.15 + neckH * 0.5), x + X(f * neckTop), Y(top - 0.02));
    ctx.stroke();
  });
  ctx.restore();
  ctx.strokeStyle = "rgba(150,140,115,0.45)";
  ctx.lineWidth = 2;
  ctx.stroke();
  fitText(ctx, t("item.general"), x, (b1 + b2) / 2 + 1, X(0.9), (b2 - b1) * 0.62, 800, "#ffffff");

  // 열린 입구: 안쪽이 보이는 타원
  const mouthY = Y(top);
  if (tie < 0.6) {
    // 비닐 입구라 테두리를 살짝 물결지게
    ctx.globalAlpha = 1 - smooth(0.3, 0.6, tie);
    const rx = X(neckTop), ry = rx * 0.3;
    ctx.beginPath();
    for (let i = 0; i <= 48; i++) {
      const a = i / 48 * Math.PI * 2, wv = 1 + 0.045 * Math.sin(a * 7);
      const px = x + Math.cos(a) * rx * wv, py = mouthY + Math.sin(a) * ry * wv;
      if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.closePath();
    const ig = ctx.createLinearGradient(0, mouthY - ry, 0, mouthY + ry);
    ig.addColorStop(0, "#8f866f");
    ig.addColorStop(1, "#c9c0aa");
    ctx.fillStyle = ig;
    ctx.fill();
    ctx.strokeStyle = "#fbf8f0";
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // 매듭: 가운데 공 + 양쪽 귀가 톡 나옴
  const kn = backOut(clamp01((tie - 0.5) / 0.5));
  if (kn > 0.01) {
    ctx.translate(x, mouthY + 2);
    ctx.scale(kn * k, kn * k);
    [-1, 1].forEach(function (sd) {
      ctx.save();
      ctx.translate(sd * 30, -14);
      ctx.rotate(-sd * 0.6);
      knotBall(ctx, 0, 0, 30, 15);
      ctx.restore();
    });
    knotBall(ctx, 0, 0, 17, 15);
  }
  ctx.restore();
  return [x, mouthY];
}
function knotBall(ctx, x, y, rx, ry) {
  const g = ctx.createRadialGradient(x - rx * 0.3, y - ry * 0.4, 1, x, y, rx);
  g.addColorStop(0, "#fffdf7");
  g.addColorStop(1, "#d6cfbd");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(150,140,115,0.45)";
  ctx.lineWidth = 2;
  ctx.stroke();
}

// ✕(산호색) / ✓(초록) 동그라미 표지 — 크림 테두리, 가운데 (0, 0)
function sign(ctx, ok) {
  const r = SIGN_R;
  ctx.shadowColor = "rgba(30,60,45,0.18)";
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = "#fff6e6";
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.fillStyle = ok ? "#5cb98a" : "#ee8f7b";
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.88, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = r * 0.24;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  if (ok) { ctx.moveTo(-r * 0.44, r * 0.03); ctx.lineTo(-r * 0.12, r * 0.34); ctx.lineTo(r * 0.46, -r * 0.3); }
  else { ctx.moveTo(-r * 0.32, -r * 0.32); ctx.lineTo(r * 0.32, r * 0.32); ctx.moveTo(r * 0.32, -r * 0.32); ctx.lineTo(-r * 0.32, r * 0.32); }
  ctx.stroke();
}

// 3단계 컵라면 용기: 통통 나와서(0~0.16) → 수도꼭지 물로 헹궈 국물 자국이 지워지고(0.2~0.42)
// → 들어서 왼쪽으로 기울여 물을 쏟고(0.48~0.64) → 움츠렸다 뛰어 재활용함에 쏙(0.68~0.92)
function drawCup(ctx, img, s, cp, binSy) {
  if (cp <= 0) return;
  const ck = Math.max(backOut(clamp01(cp / 0.14)), 0.001);
  const drop = bounceDrop(clamp01(cp / 0.16)) * 180;
  const pour = clamp01((cp - 0.48) / 0.16);
  const tp = pour > 0 && pour < 1 ? tiltCurve(pour) : 0;
  const crouch = cp > 0.64 && cp < 0.7 ? Math.sin(Math.PI * (cp - 0.64) / 0.06) : 0;
  const q = easeInOut(clamp01((cp - 0.68) / 0.24));
  const clean = smooth(0.24, 0.42, cp);
  const rimY = GY - BIN.h * binSy + BIN.rim;
  const size = ck * lerp(1, 0.55, smooth(0.1, 0.8, q));
  const w = CUP.w * size, h = CUP.h * size;
  // 컵 가운데 자리
  const lift = 80 * smooth(0, 0.3, tp);
  const x = lerp(CUP_X, BIN_X, q);
  // 끝에는 입구 위로 컵 윗부분만 살짝 보이게 수거함 안에 놓임
  const yc = lerp(GY - h / 2, rimY + h / 2 - 26, q) - Math.sin(Math.PI * q) * 260 - lift - drop;
  const ang = -tp * 1.9 - Math.sin(Math.PI * q) * 0.8; // 날아가며 기울었다가 똑바로 들어가 앉음
  shadow(ctx, CUP_X, CUP.w * 1.05 * ck, (1 - smooth(0, 0.3, q)) * (1 - drop / 180) * (1 - smooth(0, 0.3, tp) * 0.5));
  ctx.save();
  if (q > 0.55) {
    // 수거함 입구 아래로 내려간 부분은 가려서 '들어가는' 모습
    ctx.beginPath();
    ctx.rect(-500, -500, 2000, rimY + 500);
    ctx.clip();
  }
  ctx.translate(x, yc + h / 2);
  ctx.scale(1 + crouch * 0.08, 1 - crouch * 0.16);
  ctx.translate(0, -h / 2);
  ctx.rotate(ang);
  ctx.drawImage(img.dirty, -w / 2, -h / 2, w, h);
  if (clean > 0) { ctx.globalAlpha = clean; ctx.drawImage(img.clean, -w / 2, -h / 2, w, h); }
  ctx.restore();
  // 컵 안에 받은 물 (헹구는 동안 차오르고, 쏟으면 비워짐)
  const water = smooth(0.22, 0.42, cp) * (1 - smooth(0.5, 0.56, cp));
  if (water > 0.02 && tp < 0.05) {
    ctx.save();
    ctx.globalAlpha = 0.55 * water;
    ctx.fillStyle = "#9fd2f2";
    ctx.beginPath();
    ctx.ellipse(x, yc - h / 2 + h * lerp(0.42, 0.2, water), w * lerp(0.36, 0.43, water), h * 0.07, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // 쏟는 물방울: 기운 컵 입구(왼쪽 위 가장자리)에서
  if (pour > 0.36 && pour < 0.72) {
    const mx = -w * 0.48, my = -h / 2 + 6;
    const c = Math.cos(ang), si = Math.sin(ang);
    dropsEmit(s, x + mx * c - my * si, yc + mx * si + my * c, { spread: 30, vx: -30, vy: 40, r: 4, every: 0.014 });
  }
}

// 수도꼭지: 위에서 살짝 내려오며 나타나 물을 틀고(0.2~0.42), 다 쓰면 위로 사라짐
function faucetDy(cp) { return -40 * (1 - clamp01((cp - 0.12) / 0.08)) - 40 * clamp01((cp - 0.44) / 0.06); }
function faucet(ctx, img, cp) {
  const a = clamp01((cp - 0.12) / 0.08) * (1 - clamp01((cp - 0.44) / 0.06));
  if (a <= 0.01) return;
  const dy = faucetDy(cp);
  const left = SPOUT[0] - FAUCET.spout[0] * KF, top = SPOUT[1] - FAUCET.spout[1] * KF + dy;
  const cy = FAUCET.spout[1] + 2, cx = FAUCET.cut;
  ctx.save();
  ctx.globalAlpha = a;
  // 그림에 붙은 물줄기(왼쪽 아래)는 빼고 그림
  ctx.drawImage(img.faucet, 0, 0, FAUCET.w, cy, left, top, FAUCET.w * KF, cy * KF);
  ctx.drawImage(img.faucet, cx, cy, FAUCET.w - cx, FAUCET.h - cy, left + cx * KF, top + cy * KF, (FAUCET.w - cx) * KF, (FAUCET.h - cy) * KF);
  ctx.restore();
}
// 물줄기: 틀면 위에서 아래로 뻗어 컵 안으로, 잠그면 끝이 떨어져 내려감
function water(ctx, s, cp) {
  const on = smooth(0.2, 0.23, cp), off = smooth(0.42, 0.45, cp);
  if (on > 0 && off < 1) {
    const y0 = SPOUT[1] + faucetDy(cp), y1 = GY - CUP.h * 0.7;
    stream(ctx, s, SPOUT[0], lerp(y0, y1, off), lerp(y0, y1, on), 18);
  }
}

// 물줄기 한 줄기 (x 가운데, y0~y1, 굵기 w): 투명한 하늘색 + 흘러내리는 반짝임
function stream(ctx, s, x, y0, y1, w) {
  if (y1 - y0 < 1) return;
  ctx.save();
  const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
  g.addColorStop(0, "rgba(110,180,232,0.75)");
  g.addColorStop(0.45, "rgba(205,236,255,0.95)");
  g.addColorStop(1, "rgba(95,165,225,0.8)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y0, w, y1 - y0, w / 2);
  ctx.fill();
  ctx.beginPath();
  ctx.rect(x - w / 2, y0, w, y1 - y0);
  ctx.clip();
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  const off = (s.t * 420) % 46;
  for (let y = y0 - 46 + off; y < y1; y += 46) ctx.fillRect(x - 2, y, 3, 16);
  ctx.restore();
}

// 효과음 (3D 장면과 같은 순간)
function sounds(v) {
  if (hit(v, "show", 0.24) || hit(v, "show", 0.44) || hit(v, "show", 0.64)) sfx.play("tap"); // 쓰레기가 떨어져 톡톡 (5개 중 3번만)
  if (hit(v, "bag", 0.132)) sfx.play("rustle", 0.25);  // 봉투가 떨어질 때 바스락
  if (hit(v, "bag", 0.42)) sfx.play("rustle", 1.3);    // 쓰레기가 하나씩 들어가는 동안 바스락
  if (hit(v, "bag", 0.86)) sfx.play("tie");            // 입구 묶기 슥슥
  if (hit(v, "cup", 0.2)) sfx.play("water", 0.79);     // 수도꼭지 물줄기
  if (hit(v, "cup", 0.538)) sfx.play("pour", 0.21);    // 헹군 물 쏟기
  if (hit(v, "cup", 0.86)) sfx.play("slide");          // 컵이 재활용함에 쏙
  if (hit(v, "cup", 0.95)) sfx.play("chime");          // ✓로 바뀌며 끝 띵동
}
