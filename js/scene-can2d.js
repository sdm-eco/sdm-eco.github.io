// 캔 장면 — 그림(2D)
// 배출 순서: 서대문구청 안내(내용물 비우기 → 물로 헹구기 → 눌러 찌그러뜨리기 → 캔류 수거함)
// 그림: img/scene/can/*.webp (can_assets.py가 만든 조각, 위치는 meta.json 값을 아래 숫자로 옮김), 수도꼭지는 공용 그림
// 단계 값은 3D 장면(scene-can.js)과 같아 효과음 순간도 같게 맞춤
import { clamp01, smooth, easeInOut, lerp, tiltCurve, wobble } from "./eco3d-util.js?v=20261114b";
import { sfx, hit } from "./eco3d-sound.js?v=20261108r";
import { put, shadow as shade, dropsEmit, dropsDraw, binLabel as label } from "./eco2d-util.js?v=20261108r";

const D = "img/scene/can/";
// 그림 조각의 원래 크기와 그 안의 위치 (can_assets.py가 잰 값)
const CAN = { w: 258, h: 420, hole: { x: 131, y: 62 } };   // hole: 뚜껑 따는 구멍 자리(고리 앞쪽)
const CRUSHED = { w: 302, h: 240 };
const BIN = { w: 365, h: 440, rim: 36, label: { x: 140, y: 141, w: 162, h: 86 } };
const FAUCET = { w: 246, h: 300, mouth: { x: 25, y: 106 } };   // 공용 수도꼭지: 그림에 그려진 물줄기는 가리고 직접 그림

// 장면 배치 (설계 크기 820×760 기준, eco2d.js)
const GY = 700;             // 바닥선
const BX = 300;             // 캔 자리
const KN = 470 / BIN.h;     // 수거함 높이 470
const BIN_X = 605;
const KF = 0.82;            // 수도꼭지 크기 배율
const SPOUT_Y = 135;        // 수도꼭지 입구 높이 (그림 윗선이 설계 위쪽 여유 안에 들게)
const HOLE_X = BX - CAN.w / 2 + CAN.hole.x;   // 캔 구멍(세워 둔 자리 기준)
const HOLE_Y = GY - CAN.h + CAN.hole.y;
const COLA = "rgba(150,92,48,0.8)";

export default {
  kind: "2d",
  // empty 1 = 음료를 비움, rinse 1 = 물로 헹굼, crush 1 = 눌러 찌그러뜨림, bin 1 = 수거함에 넣음
  states: [
    { empty: 0, rinse: 0, crush: 0, bin: 0 },
    { empty: 1, rinse: 0, crush: 0, bin: 0 },
    { empty: 1, rinse: 1, crush: 0, bin: 0 },
    { empty: 1, rinse: 1, crush: 1, bin: 0 },
    { empty: 1, rinse: 1, crush: 1, bin: 1 }
  ],
  moves: [null, [["empty", 2.4]], [["rinse", 3.8]], [["crush", 2.2]], [["bin", 2.0]]],
  images: { can: D + "can.webp", crushed: D + "crushed.webp", bin: D + "bin.webp", faucet: "img/scene/common/faucet.webp" },
  draw: draw
};

// 바닥 그림자 (바닥선 GY 고정)
function shadow(ctx, x, w, a) { shade(ctx, x, GY, w, a); }

function draw(ctx, v, s) {
  const img = s.img;
  sounds(v);

  // ── 수거함 단계: 수거함이 오른쪽에서 들어오고, 캔이 움츠렸다 포물선으로 날아 들어감 ──
  const b = v.bin;
  const binIn = easeInOut(smooth(0, 0.3, b));
  const binX = lerp(1180, BIN_X, binIn);
  const nw = BIN.w * KN, nh = BIN.h * KN;
  const land = clamp01((b - 0.78) / 0.22);
  const binSy = 1 - wobble(land, 2) * 0.06;
  if (b > 0) {
    shadow(ctx, binX, nw * 1.05, binIn);
    put(ctx, img.bin, binX, GY, nw, nh, { sy: binSy });
    label(ctx, "item.can", binX - nw / 2 + BIN.label.x * KN, GY - nh * binSy + BIN.label.y * KN * binSy, BIN.label.w * KN, BIN.label.h * KN * binSy);
  }

  // 헹구기: 수도꼭지가 위에서 내려와 물을 받고 올라감 (캔보다 뒤에 그림)
  drawFaucet(ctx, img, v, s);

  if (v.crush > 0) drawCrush(ctx, img, v, s, binX, nh, binSy);
  else drawPour(ctx, img, v, s);

  // 쏟는 음료(갈색) / 헹군 물(파랑)
  dropsDraw(ctx, s, GY, v.rinse > 0 ? null : COLA);
}

// 비우기·헹군 물 쏟기: 살짝 젖혔다(준비) 왼쪽으로 기울여 머문 뒤 살짝 지나쳐 세움 (3D와 같은 곡선)
function drawPour(ctx, img, v, s) {
  const pour = v.empty < 1 ? v.empty : 0;
  const rq = v.rinse < 1 ? clamp01((v.rinse - 0.55) / 0.45) : 0;
  const tp = pour > 0 ? tiltCurve(pour) : rq > 0 ? tiltCurve(rq) : 0;
  const ang = -2.0 * tp;                      // 왼쪽으로 약 115도
  const lift = 80 * Math.max(tp, 0);
  const cx = BX - 40 * tp, cy = GY - CAN.h / 2 - lift;  // 캔 가운데(회전축)
  // 헹굴 때 물이 차면서 살짝 출렁
  const slosh = v.rinse > 0.12 && v.rinse < 0.5 ? Math.sin(v.rinse * 60) * 0.015 * smooth(0.12, 0.2, v.rinse) * (1 - smooth(0.42, 0.5, v.rinse)) : 0;
  shadow(ctx, BX - 20 * tp, CAN.w * 1.1, 1 - 0.3 * Math.abs(tp));
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(ang + slosh);
  ctx.drawImage(img.can, -CAN.w / 2, -CAN.h / 2, CAN.w, CAN.h);
  // 딴 구멍: 비우기를 시작하면 고리 앞이 열림
  drawHole(ctx, -CAN.w / 2 + CAN.hole.x, -CAN.h / 2 + CAN.hole.y, smooth(0, 0.06, v.empty), v.rinse);
  ctx.restore();
  // 구멍에서 기운 방향으로 쏟아짐
  const q = pour > 0 ? pour : rq;
  if (q > 0.36 && q < 0.72) {
    const hx = -CAN.w / 2 + CAN.hole.x, hy = -CAN.h / 2 + CAN.hole.y - 6;
    const c = Math.cos(ang), sn = Math.sin(ang);
    const mx = cx + hx * c - hy * sn, my = cy + hx * sn + hy * c;
    // 처음과 끝은 가늘게(쏟아지기 시작·끝)
    const flow = smooth(0.36, 0.42, q) * (1 - smooth(0.62, 0.72, q));
    pourRibbon(ctx, mx, my, flow, rq > 0 ? "rgba(140,200,240,0.85)" : COLA);
    dropsEmit(s, mx - 30, my + 110 * flow, { vx: -30, vy: 120, every: 0.03, r: 2 });
  }
}
// 구멍에서 흘러내리는 줄기 (위는 굵고 아래로 가늘어짐)
function pourRibbon(ctx, x, y, a, color) {
  if (a <= 0.01) return;
  const len = 120 * a;
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x - 4, y);
  ctx.quadraticCurveTo(x - 30, y + len * 0.2, x - 32, y + len);
  ctx.lineTo(x - 28, y + len);
  ctx.quadraticCurveTo(x - 18, y + len * 0.25, x + 5, y + 2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// 캔 뚜껑의 딴 구멍 (a: 보이는 정도, rinse: 헹굴 때 물빛이 비침)
function drawHole(ctx, x, y, a, rinse) {
  if (a <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = "#3b4442";
  ctx.beginPath();
  ctx.ellipse(x, y, 18, 7, -0.05, 0, Math.PI * 2);
  ctx.fill();
  const wet = smooth(0.15, 0.25, rinse) * (1 - smooth(0.6, 0.8, rinse));
  if (wet > 0) {
    ctx.globalAlpha = a * wet;
    ctx.fillStyle = "#8fc8ea";
    ctx.beginPath();
    ctx.ellipse(x, y + 1, 14, 5, -0.05, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = a * 0.7;
  ctx.strokeStyle = "#e9eeee";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(x, y + 1, 18, 7, -0.05, 0.1, Math.PI - 0.1);
  ctx.stroke();
  ctx.restore();
}

// 수도꼭지: 0~0.12 위에서 내려옴, 0.12~0.42 물줄기, 0.45~0.55 올라가 사라짐 (3D와 같은 구간)
function drawFaucet(ctx, img, v, s) {
  const r = v.rinse;
  if (r <= 0 || r >= 1) return;
  const show = easeInOut(smooth(0, 0.12, r)) * (1 - easeInOut(smooth(0.45, 0.55, r)));
  if (show <= 0.001) return;
  // 위에서 살짝 내려오며 나타남 (화면 위로 잘리지 않게 멀리서 오지 않음)
  const mx = HOLE_X, my = SPOUT_Y - (1 - show) * 12;   // 수도꼭지 입구 자리
  const left = mx - FAUCET.mouth.x * KF, top = my - FAUCET.mouth.y * KF;
  ctx.save();
  ctx.globalAlpha = show;
  ctx.translate(left, top);
  ctx.scale(KF, KF);
  // 그림에 그려진 물줄기(입구 아래 왼쪽 부분)는 빼고 그림
  ctx.beginPath();
  ctx.rect(0, 0, FAUCET.w, FAUCET.mouth.y);
  ctx.rect(60, FAUCET.mouth.y, FAUCET.w - 60, FAUCET.h - FAUCET.mouth.y);
  ctx.clip();
  ctx.drawImage(img.faucet, 0, 0, FAUCET.w, FAUCET.h);
  ctx.restore();
  // 물줄기: 위에서부터 내려와 캔 구멍까지 → 잠그면 꼬리가 떨어짐
  const head = smooth(0.12, 0.16, r), tail = smooth(0.42, 0.46, r);
  if (head > 0 && tail < 1) {
    const y0 = lerp(my, HOLE_Y, tail), y1 = lerp(my, HOLE_Y, head);
    stream(ctx, mx, y0, y1, s.t);
    if (head >= 1 && tail <= 0) {
      // 구멍에서 튀는 물방울
      dropsEmit(s, mx - 6, HOLE_Y - 4, { vx: -70, vy: -140, every: 0.06, r: 2, spread: 4 });
      dropsEmit(s, mx + 6, HOLE_Y - 4, { vx: 70, vy: -140, every: 0.06, r: 2, spread: 4 });
    }
  }
}
// 물줄기 한 줄 (가운데가 밝은 연파랑, 가장자리가 살짝 흔들림)
function stream(ctx, x, y0, y1, t) {
  if (y1 - y0 < 1) return;
  const w = 11;
  const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
  g.addColorStop(0, "rgba(120,185,230,0.55)");
  g.addColorStop(0.4, "rgba(225,244,255,0.9)");
  g.addColorStop(1, "rgba(110,175,225,0.6)");
  ctx.save();
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y0);
  for (let y = y0; y <= y1; y += 12) ctx.lineTo(x - w / 2 + Math.sin(y * 0.09 + t * 18) * 1.2, y);
  ctx.lineTo(x - w / 2 + 1, y1);
  ctx.lineTo(x + w / 2 - 1, y1);
  for (let y = y1; y >= y0; y -= 12) ctx.lineTo(x + w / 2 + Math.sin(y * 0.08 + t * 15) * 1.2, y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// 찌그러뜨리기·수거함에 넣기
// 누르는 판: 위에서 내려와(0~0.28) → 꾹 눌러 캔이 납작해지고(0.28~0.6) → 살짝 튀었다 위로 사라짐(0.66~1)
function drawCrush(ctx, img, v, s, binX, nh, binSy) {
  const c = v.crush, b = v.bin;
  const press = clamp01((c - 0.28) / 0.32);
  const d = c >= 1 ? 1 : Math.pow(press, 1.7);
  const H1 = CAN.h * lerp(1, 0.6, d);          // 눌린 캔 높이 (끝은 찌그러진 캔 그림 높이와 비슷)
  const crushedA = smooth(0.7, 0.95, d);
  const settle = c < 1 ? 1 + wobble(clamp01((c - 0.6) / 0.4), 2) * 0.06 : 1;

  // 수거함 단계: 움츠렸다(0.15~0.3) 뛰어올라 포물선으로 수거함 안에 쏙(0.28~0.78)
  let x = BX, y = GY, rot = 0, k = 1;
  const crouch = b > 0.15 && b < 0.3 ? Math.sin(Math.PI * (b - 0.15) / 0.15) : 0;
  const u = clamp01((b - 0.28) / 0.5);
  const land = clamp01((b - 0.78) / 0.22);
  ctx.save();
  if (u > 0) {
    // 끝 모습: 찌그러진 캔 윗부분이 수거함 위로 살짝 보이게 (넣었다는 것이 한눈에 보이게)
    const rim = GY - nh * binSy + BIN.rim * KN;
    x = lerp(BX, binX, easeInOut(u));
    y = lerp(GY, GY - nh + BIN.rim * KN + 150, u) - 4 * u * (1 - u) * 250;   // 가장 높을 때도 화면 위로 잘리지 않게
    rot = u * Math.PI * 2 + wobble(land, 2) * 0.06;
    k = lerp(1, 0.75, u);
    if (u > 0.5) {
      // 입구 테두리 아래로 내려간 부분은 가려서 '들어가는' 모습
      ctx.beginPath();
      ctx.rect(-500, -500, 2000, rim + 500);
      ctx.clip();
    }
  }
  shadow(ctx, BX, CRUSHED.w * lerp(0.95, 1.05, crushedA), 1 - smooth(0.28, 0.4, b));
  ctx.translate(x, y - (u > 0 ? CRUSHED.h * 0.5 : 0));
  ctx.rotate(rot);
  ctx.scale(k * (1 + crouch * 0.08), k * settle * (1 - crouch * 0.12));
  if (u > 0) ctx.translate(0, CRUSHED.h * 0.5);   // 날 때는 가운데를 축으로 돎
  if (crushedA < 1) {
    // 위에서 눌러 키가 줄고 가운데가 불룩해짐
    const wk = 1 + 0.16 * d;
    ctx.save();
    ctx.globalAlpha = 1 - crushedA;
    ctx.drawImage(img.can, -CAN.w * wk / 2, -H1, CAN.w * wk, H1);
    ctx.restore();
  }
  if (crushedA > 0) {
    ctx.globalAlpha = crushedA;
    ctx.drawImage(img.crushed, -CRUSHED.w / 2, -CRUSHED.h, CRUSHED.w, CRUSHED.h);
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  // 누르는 나무 판
  if (c > 0 && c < 1) {
    let py;
    if (c < 0.28) py = -(1 - easeInOut(c / 0.28)) * 190;
    else if (c < 0.66) py = 0;
    else { const q = clamp01((c - 0.66) / 0.34); py = -(q < 0.3 ? Math.sin(Math.PI * q / 0.3) * 12 : 0) - smooth(0.25, 1, q) * 200; }
    const plateBottom = GY - lerp(H1, CRUSHED.h * settle, crushedA) + py;   // 판 아랫면 = 캔 윗면
    // 나타날 때·사라질 때는 흐려짐 (휴대폰처럼 위쪽이 좁은 화면에서도 잘려 보이지 않게)
    board(ctx, BX, plateBottom, smooth(0, 0.1, c) * (1 - smooth(0.85, 1, c)));
  }
}

// 나무 판 (둥근 모서리, 나뭇결, 아래로 진 그림자): x 가운데, y 아랫면, a 진하기
function board(ctx, x, y, a) {
  if (a <= 0.01) return;
  const w = 340, h = 40;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.shadowColor = "rgba(40,30,20,0.25)";
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 6;
  const g = ctx.createLinearGradient(0, y - h, 0, y);
  g.addColorStop(0, "#e2b67c");
  g.addColorStop(0.55, "#cf9a5c");
  g.addColorStop(1, "#a9733d");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - h, w, h, 10);
  ctx.fill();
  ctx.shadowColor = "transparent";
  // 나뭇결
  ctx.strokeStyle = "rgba(120,75,35,0.28)";
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 3; i++) {
    const yy = y - h + 11 + i * 9;
    ctx.beginPath();
    ctx.moveTo(x - w / 2 + 14, yy);
    ctx.bezierCurveTo(x - 60, yy - 4, x + 40, yy + 4, x + w / 2 - 14, yy - 1);
    ctx.stroke();
  }
  // 윗면 밝은 테두리
  ctx.strokeStyle = "rgba(255,240,215,0.7)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - w / 2 + 10, y - h + 2);
  ctx.lineTo(x + w / 2 - 10, y - h + 2);
  ctx.stroke();
  ctx.restore();
}

// 효과음 (3D 장면과 같은 순간)
function sounds(v) {
  if (hit(v, "empty", 0.36)) sfx.play("pour", 0.86);        // 쪼르륵 비우기
  if (hit(v, "rinse", 0.12)) sfx.play("water", 1.14);       // 수도꼭지 물줄기
  if (hit(v, "rinse", 0.71)) sfx.play("pour", 0.6);         // 헹군 물 쏟기
  if (hit(v, "crush", 0.28)) sfx.play("crunch", 0.7, true); // 판이 누를 때 금속 찌그럭
  if (hit(v, "bin", 0.78)) sfx.play("thud");                 // 수거함에 통
  if (hit(v, "bin", 0.95)) sfx.play("chime");                // 끝 띵동
}
