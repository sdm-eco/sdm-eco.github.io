// 유리병 장면 — 그림(2D)
// 배출 순서: 서대문구청 재활용품 분리배출 안내(병류) — 병뚜껑 떼기 → 내용물 비우기 → 라벨 떼기 → 유리병 수거함
// 그림: img/scene/glass/*.webp (glass_assets.py가 만든 조각, 위치는 meta.json 값을 아래 숫자로 옮김)
//       병에 끼워진 뚜껑과 종이 라벨은 그림이 없어 도형으로 그림
// 단계 값은 3D 장면(scene-glass.js)과 같아 효과음 순간도 같게 맞춤
import { clamp01, smooth, easeInOut, lerp, tiltCurve, bounceDrop, wobble } from "./eco3d-util.js?v=20261114b";
import { sfx, hit } from "./eco3d-sound.js?v=20261108r";
import { put, shadow as shade, dropsEmit, dropsDraw, binLabel as label } from "./eco2d-util.js?v=20261114g";

const D = "img/scene/glass/";
const TAU = Math.PI * 2;
// 그림 조각의 원래 크기와 그 안의 위치 (glass_assets.py가 잰 값)
const BOTTLE = { w: 163, h: 460, cx: 80, neck: { y: 62, w: 70 }, label: { y: 222, h: 120, w: 160 } };   // neck: 나사산(뚜껑 자리) 아랫선
const LIQUID = { y0: 150, y1: 418 };
const CAP = { w: 85, h: 64 };      // 떼어 내 바닥에 놓인 뚜껑(안쪽이 보임)
const BIN = { w: 361, h: 440, rim: 35, label: { x: 140, y: 140, w: 159, h: 86 } };

// 장면 배치 (설계 크기 820×760 기준, eco2d.js)
const GY = 700;             // 바닥선
const BX = 330;             // 병 자리
const KN = 470 / BIN.h;     // 수거함 높이 470
const BIN_X = 620;
const CAP_GROUND = 560;     // 뚜껑이 떨어지는 바닥 자리(x)
const LABEL_GROUND = 125;   // 라벨이 떨어지는 바닥 자리(x)
const AMBER = "rgba(232,176,76,0.85)";

export default {
  kind: "2d",
  // cap 1 = 뚜껑을 뗌, empty 1 = 내용물을 비움, label 1 = 라벨을 뗌, bin 1 = 유리병 수거함에 넣음
  states: [
    { cap: 0, empty: 0, label: 0, bin: 0 },
    { cap: 1, empty: 0, label: 0, bin: 0 },
    { cap: 1, empty: 1, label: 0, bin: 0 },
    { cap: 1, empty: 1, label: 1, bin: 0 },
    { cap: 1, empty: 1, label: 1, bin: 1 }
  ],
  moves: [null, [["cap", 1.2]], [["empty", 2.2]], [["label", 1.4]], [["bin", 1.8]]],
  images: { bottle: D + "bottle.webp", liquid: D + "liquid.webp", cap: D + "cap.webp", bin: D + "bin.webp" },
  draw: draw
};

// 바닥 그림자 (바닥선 GY 고정)
function shadow(ctx, x, w, a) { shade(ctx, x, GY, w, a); }

function draw(ctx, v, s) {
  const img = s.img;
  sounds(v);

  // ── 수거함 단계: 수거함이 오른쪽에서 들어오고, 병을 살며시 들어 수거함 안에 세워 넣음(깨지지 않게 던지지 않음) ──
  const b = v.bin;
  const binIn = easeInOut(smooth(0, 0.3, b));
  const binX = lerp(1180, BIN_X, binIn);
  const nw = BIN.w * KN, nh = BIN.h * KN;
  const land = clamp01((b - 0.78) / 0.22);
  const binSy = 1 - wobble(land, 2) * 0.05;
  if (b > 0) {
    shadow(ctx, binX, nw * 1.05, binIn);
    put(ctx, img.bin, binX, GY, nw, nh, { sy: binSy });
  }

  // 바닥에 놓인 것: 뗀 뚜껑·라벨 (수거함이 들어올 때 톡 부풀었다 쏙 작아져 치움, 3D와 같음)
  const gone = smooth(0, 0.22, b);
  const tidy = gone < 1 ? (1 + Math.sin(Math.PI * Math.min(gone / 0.4, 1)) * 0.25) * (1 - smooth(0.3, 1, gone)) : 0;
  if (v.label >= 1 && tidy > 0.01) labelOnGround(ctx, tidy);
  if (v.cap >= 1 && tidy > 0.01) capOnGround(ctx, img, tidy);

  // ── 병 ──
  const top = GY - BOTTLE.h;
  if (b > 0) {
    drawToBin(ctx, img, v, binX, nh, binSy, land);
  } else if (v.label > 0) {
    // 라벨 떼기: 라벨이 위로 밀려 벗겨진 뒤 빙글 돌며 왼쪽 바닥으로 떨어짐
    shadow(ctx, BX, BOTTLE.w * 1.25, 1);
    bottle(ctx, img, BX, GY - BOTTLE.h / 2, 0, 1, 0, false);
    peelLabel(ctx, v.label);
  } else if (v.cap >= 1) {
    pour(ctx, img, v, s);
  } else {
    // 뚜껑 떼기: 달그락 흔들리다(0~0.2) 톡 튀어 올라 → 한 바퀴 돌며 오른쪽 바닥에 떨어져 통통 튐 (3D와 같은 곡선)
    const cp = v.cap;
    const rattle = cp > 0 && cp < 0.2 ? Math.sin(cp * 90) * 0.12 * Math.sin(Math.PI * cp / 0.2) : 0;
    const sy = 1 - Math.abs(rattle) * 0.15;
    shadow(ctx, BX, BOTTLE.w * 1.25, 1);
    ctx.save();
    ctx.translate(BX, GY);
    ctx.scale(1 / Math.sqrt(sy), sy);
    bottle(ctx, img, 0, -BOTTLE.h / 2, 0, 1, 1, true);
    ctx.restore();
    if (cp < 0.2) capOnBottle(ctx, BX - BOTTLE.w / 2 + BOTTLE.cx, GY - (BOTTLE.h - BOTTLE.neck.y) * sy, rattle);
    else capFly(ctx, img, cp);
  }
  // 쏟는 음료 방울
  dropsDraw(ctx, s, GY, AMBER);
}

// 병 한 개: (x, y) 가운데, rot 기울기, k 크기, liquid 음료 남은 정도(0~1), withLabel 라벨 붙음
// 음료는 기울였을 때 바닥 쪽부터 줄어듦(병 입구 쪽에 남은 것이 마지막으로 빠짐)
function bottle(ctx, img, x, y, rot, k, liquid, withLabel) {
  const w = BOTTLE.w, h = BOTTLE.h;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(k, k);
  ctx.translate(-w / 2, -h / 2);
  ctx.drawImage(img.bottle, 0, 0, w, h);
  if (liquid > 0.002) {
    const y1 = LIQUID.y0 + (LIQUID.y1 - LIQUID.y0) * liquid;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, LIQUID.y0 - 2, w, y1 - LIQUID.y0 + 2);
    ctx.clip();
    ctx.globalAlpha = 0.9;
    ctx.drawImage(img.liquid, 0, 0, w, h);
    ctx.restore();
  }
  if (withLabel) paperLabel(ctx, BOTTLE.cx, BOTTLE.label.y + BOTTLE.label.h / 2, 1);
  ctx.restore();
}

// 종이 라벨 (크림 바탕에 초록 띠·노란 동그라미·잎, 상표 없음): (x, y) 가운데, curve 1 = 병에 감긴 둥근 모양
function paperLabel(ctx, x, y, curve) {
  const w = BOTTLE.label.w, h = BOTTLE.label.h, bow = 9 * curve;
  const l = x - w / 2, t = y - h / 2;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(l, t);
  ctx.quadraticCurveTo(x, t + bow * 2, l + w, t);
  ctx.lineTo(l + w, t + h);
  ctx.quadraticCurveTo(x, t + h + bow * 2, l, t + h);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = "#f8f1df";
  ctx.fillRect(l, t, w, h + bow * 2);
  // 위·아래 초록 띠 (병 둘레를 따라 휨)
  ctx.fillStyle = "#3f9a5c";
  for (const yy of [t, t + h - 16]) {
    ctx.beginPath();
    ctx.moveTo(l, yy);
    ctx.quadraticCurveTo(x, yy + bow * 2, l + w, yy);
    ctx.lineTo(l + w, yy + 16);
    ctx.quadraticCurveTo(x, yy + 16 + bow * 2, l, yy + 16);
    ctx.closePath();
    ctx.fill();
  }
  // 가운데 노란 동그라미와 잎
  const my = y + bow;
  ctx.fillStyle = "#f2c94c";
  ctx.beginPath();
  ctx.ellipse(x, my, 30 * (0.75 + 0.25 * (1 - curve)), 30, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#2f8f5b";
  ctx.save();
  ctx.translate(x + 4, my - 4);
  ctx.rotate(-0.7);
  ctx.beginPath();
  ctx.ellipse(0, 0, 16, 7, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = "#2f8f5b";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 8, my + 12);
  ctx.quadraticCurveTo(x - 2, my + 2, x + 6, my - 6);
  ctx.stroke();
  // 둥근 병에 감긴 느낌: 양 끝은 어둡고 왼쪽에 밝은 빛
  const g = ctx.createLinearGradient(l, 0, l + w, 0);
  g.addColorStop(0, `rgba(40,60,40,${0.32 * curve})`);
  g.addColorStop(0.28, `rgba(255,255,255,${0.32 * curve})`);
  g.addColorStop(0.5, "rgba(255,255,255,0)");
  g.addColorStop(1, `rgba(40,60,40,${0.38 * curve + 0.06})`);
  ctx.fillStyle = g;
  ctx.fillRect(l, t, w, h + bow * 2);
  ctx.restore();
}

// 라벨 떼기 움직임 (l 0~1)
function peelLabel(ctx, l) {
  const slide = easeInOut(smooth(0.05, 0.45, l));
  const fall = smooth(0.45, 0.85, l);
  const k = easeInOut(fall);
  const x0 = BX - BOTTLE.w / 2 + BOTTLE.cx, y0 = GY - BOTTLE.h + BOTTLE.label.y + BOTTLE.label.h / 2;
  if (l >= 0.999) { labelOnGround(ctx, 1); return; }
  const x = lerp(x0 - 30 * slide, LABEL_GROUND, k);
  const y = lerp(y0 - 70 * slide, GY - 16, k * k) - Math.sin(Math.PI * k) * 40;
  const rot = -0.35 * slide + k * (0.35 + 0.12) - Math.sin(Math.PI * 2 * k) * 0.25;
  const sy = lerp(1, 0.32, k);
  const curve = 1 - smooth(0.05, 0.4, l) * 0.7;
  shadow(ctx, x, 190, k);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(1 + 0.08 * slide, sy);
  paperLabel(ctx, 0, 0, curve);
  ctx.restore();
}
// 바닥에 떨어진 라벨 (k: 크기, 치울 때 작아짐)
function labelOnGround(ctx, k) {
  shadow(ctx, LABEL_GROUND, 190 * k, 1);
  ctx.save();
  ctx.translate(LABEL_GROUND, GY - 16 * k);
  ctx.rotate(0.12);
  ctx.scale(k, 0.32 * k);
  paperLabel(ctx, 0, 0, 0.3);
  ctx.restore();
}

// 병에 끼워진 초록 금속 뚜껑 (도형): x 가운데, y 아랫선, rot 흔들림
function capOnBottle(ctx, x, y, rot) {
  const w = BOTTLE.neck.w + 6, h = BOTTLE.neck.y + 2;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  capShape(ctx, w, h);
  ctx.restore();
}
// 뚜껑 모양: 아래 가운데가 (0,0)
function capShape(ctx, w, h) {
  const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
  g.addColorStop(0, "#1c4f26");
  g.addColorStop(0.22, "#3f8f4c");
  g.addColorStop(0.34, "#8fd09a");
  g.addColorStop(0.5, "#3c8a48");
  g.addColorStop(1, "#173f1f");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h, w, h, [8, 8, 4, 4]);
  ctx.fill();
  // 미끄럼 막는 세로 줄무늬
  ctx.strokeStyle = "rgba(10,40,15,0.28)";
  ctx.lineWidth = 1.4;
  for (let i = -w / 2 + 5; i < w / 2 - 3; i += 5) {
    ctx.beginPath();
    ctx.moveTo(i, -h * 0.72);
    ctx.lineTo(i, -3);
    ctx.stroke();
  }
  // 윗면 테두리, 아래 띠
  ctx.fillStyle = "rgba(160,220,170,0.55)";
  ctx.beginPath();
  ctx.ellipse(0, -h + 3, w / 2 - 3, 3, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "rgba(10,40,15,0.3)";
  ctx.fillRect(-w / 2, -6, w, 3);
}
// 뚜껑이 톡 튀어 날아가 바닥에서 통통 튐 (cp 0.2~1)
function capFly(ctx, img, cp) {
  const q = clamp01((cp - 0.2) / 0.8);
  const arc = easeInOut(Math.min(q / 0.7, 1));
  const onY = GY - BOTTLE.h + BOTTLE.neck.y, peakY = onY - 150, restY = GY;
  const y = q < 0.25 ? lerp(onY, peakY, 1 - Math.pow(1 - q / 0.25, 2)) : restY + (peakY - restY) * bounceDrop((q - 0.25) / 0.75);
  const x = lerp(BX - BOTTLE.w / 2 + BOTTLE.cx, CAP_GROUND, arc);
  const rot = arc * TAU + (cp < 1 ? wobble(clamp01((q - 0.7) / 0.3), 3) * 0.2 : 0);
  shadow(ctx, x, 90, smooth(0.3, 0.7, q));
  if (arc < 0.25) {
    // 아직 병에 끼워진 모습 그대로 돌기 시작
    const h = BOTTLE.neck.y + 2;
    ctx.save();
    ctx.translate(x, y - h / 2);
    ctx.rotate(rot);
    ctx.translate(0, h / 2);
    capShape(ctx, BOTTLE.neck.w + 6, h);
    ctx.restore();
  } else {
    // 반 바퀴 넘게 돈 뒤에는 뒤집혀 안쪽이 보이는 그림
    put(ctx, img.cap, x, y - CAP.h / 2, CAP.w, CAP.h, { rot: rot, py: 0.5 });
  }
}
function capOnGround(ctx, img, k) {
  shadow(ctx, CAP_GROUND, 90 * k, 1);
  put(ctx, img.cap, CAP_GROUND, GY, CAP.w * k, CAP.h * k);
}

// 비우기: 살짝 젖혔다(준비) 왼쪽으로 기울여 머무는 동안 쏟고 → 살짝 지나쳐 세움 (3D와 같은 곡선)
function pour(ctx, img, v, s) {
  const e = v.empty;
  const tp = e < 1 ? tiltCurve(e) : 0;
  const ang = -2.1 * tp;
  const lift = 90 * Math.max(tp, 0);
  const cx = BX - 40 * tp, cy = GY - BOTTLE.h / 2 - lift;
  const level = e >= 1 ? 0 : 1 - smooth(0.36, 0.72, e);
  shadow(ctx, BX - 20 * tp, BOTTLE.w * 1.25, 1 - 0.3 * Math.abs(tp));
  bottle(ctx, img, cx, cy, ang, 1, level, true);
  if (e > 0.36 && e < 0.72) {
    // 병 입구 = 가운데에서 위쪽으로 h/2 떨어진 점을 기운 각도만큼 돌린 자리
    const mx = cx + Math.sin(ang) * (BOTTLE.h / 2), my = cy - Math.cos(ang) * (BOTTLE.h / 2);
    const flow = smooth(0.36, 0.42, e) * (1 - smooth(0.62, 0.72, e));
    ribbon(ctx, mx, my, flow);
    dropsEmit(s, mx - 30, my + 120 * flow, { vx: -30, vy: 120, every: 0.03, r: 2 });
  }
}
// 병 입구에서 흘러내리는 음료 줄기
function ribbon(ctx, x, y, a) {
  if (a <= 0.01) return;
  const len = 130 * a;
  ctx.save();
  ctx.fillStyle = AMBER;
  ctx.beginPath();
  ctx.moveTo(x - 5, y);
  ctx.quadraticCurveTo(x - 30, y + len * 0.2, x - 33, y + len);
  ctx.lineTo(x - 28, y + len);
  ctx.quadraticCurveTo(x - 16, y + len * 0.25, x + 6, y + 2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// 수거함에 넣기: 움츠렸다(0.15~0.3) → 살며시 들어 눕히듯 옮겨(0.28~0.6) → 세우며 수거함 안으로 내려놓음(~0.78)
// 끝 모습은 병 목이 수거함 위로 살짝 보이게 (넣었다는 것이 한눈에 보이게)
const PATH = [
  { t: 0, x: BX, y: GY - BOTTLE.h / 2, r: 0, k: 1 },
  { t: 0.3, x: BX + 20, y: 330, r: -0.25, k: 0.94 },
  { t: 0.6, x: 515, y: 155, r: -1.35, k: 0.88 },
  { t: 1, x: BIN_X - 6, y: GY - 140 - BOTTLE.h * 0.85 / 2, r: 0.14, k: 0.85 }
];
function drawToBin(ctx, img, v, binX, nh, binSy, land) {
  const b = v.bin;
  const crouch = b > 0.15 && b < 0.3 ? Math.sin(Math.PI * (b - 0.15) / 0.15) : 0;
  const u = clamp01((b - 0.28) / 0.5);
  let i = 0;
  while (i < PATH.length - 2 && u > PATH[i + 1].t) i++;
  const A = PATH[i], B = PATH[i + 1];
  const f = easeInOut(clamp01((u - A.t) / (B.t - A.t)));
  const x = lerp(A.x, B.x, f) + (u >= 1 ? binX - BIN_X : 0);
  const y = lerp(A.y, B.y, f);
  const rot = lerp(A.r, B.r, f) + wobble(land, 2) * 0.05;
  const k = lerp(A.k, B.k, f);
  shadow(ctx, BX, BOTTLE.w * 1.25, 1 - smooth(0.28, 0.4, b));
  ctx.save();
  if (u > 0.6) {
    // 입구 테두리 아래로 내려간 부분은 가려서 '들어가는' 모습
    const rim = GY - nh * binSy + BIN.rim * KN;
    ctx.beginPath();
    ctx.rect(-500, -500, 2000, rim + 500);
    ctx.clip();
  }
  // 움츠림: 바닥을 축으로 납작해짐
  const sy = 1 - crouch * 0.1;
  ctx.translate(x, y + (BOTTLE.h / 2) * (1 - sy));
  ctx.scale(1 / Math.sqrt(sy), sy);
  bottle(ctx, img, 0, 0, rot, k, 0, false);
  ctx.restore();
  // 수거함 이름표는 병보다 앞에
  label(ctx, "item.glass", binX - BIN.w * KN / 2 + BIN.label.x * KN, GY - nh * binSy + BIN.label.y * KN * binSy, BIN.label.w * KN, BIN.label.h * KN * binSy);
}

// 효과음 (3D 장면과 같은 순간)
function sounds(v) {
  if (hit(v, "cap", 0.03)) sfx.play("rattle");                       // 뚜껑 달그락
  if (hit(v, "cap", 0.2)) sfx.play("pop");                           // 톡 튀어 오름
  if (hit(v, "cap", 0.76) || hit(v, "cap", 0.91)) sfx.play("tap");   // 바닥에 톡톡
  if (hit(v, "empty", 0.36)) sfx.play("pour", 0.79);                 // 쪼르륵 비우기
  if (hit(v, "label", 0.05)) sfx.play("peel");                       // 라벨 떼는 소리
  if (hit(v, "bin", 0.78)) sfx.play("clink");                        // 유리병 수거함에 쨍
  if (hit(v, "bin", 0.95)) sfx.play("chime");                        // 끝 띵동
}
