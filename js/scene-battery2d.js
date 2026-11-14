// 폐건전지·폐형광등 장면 — 그림(2D)
// 서대문구 폐금속자원 배출 안내: 공동주택은 단지 내 수거함, 단독주택은 인근 주민센터·주택 골목 수거함
// 그림: img/scene/battery/*.webp (battery_assets.py가 만든 조각, 크기·위치는 meta.json 값을 아래 숫자로 옮김)
//       수거함은 구청 검토 의견의 예시 그림(battery_bin_gu.py, bin-meta.json): 윗칸 파란 받침 = 형광등, 오른쪽 노란 투입구 = 건전지
//       형광등은 알맞은 그림이 없어 canvas로 그림(유리관 + 양 끝 은색 마개와 핀)
// 단계 값은 3D 장면(scene-battery.js)과 같아 효과음 순간도 같게 맞춤
import { clamp01, smooth, easeInOut, backOut, lerp, bounceDrop, wobble } from "./eco3d-util.js?v=20261114b";
import { sfx, hit } from "./eco3d-sound.js?v=20261108r";
import { put, shadow as shade, binLabel } from "./eco2d-util.js?v=20261114d";

const D = "img/scene/battery/";
// 그림 조각 크기와 그 안의 위치 (battery_assets.py가 잰 값)
const REMOTE = { w: 352, h: 480 };
// 리모컨 칸 속 건전지: 리모컨 그림 안 가운데 자리(x, y)와 기울기(rot, 시계 방향), 칸 입구 네 꼭짓점(hole)
const CELL = { w: 39, h: 105.8, x: 140.7, y: 380.1, rot: 0.5044, hole: [[142, 321.3], [184.9, 331.9], [140.3, 431.3], [92.4, 421]] };
const PILE = { w: 42, h: 132 };     // 미리 모아 둔 건전지(cell-l, cell-r)
// 수거함 그림 안 자리: open = 윗칸 입구(선반 아래 top ~ 파란 받침 테두리 rim, 좌우 x0~x1), slot = 노란 투입구 안쪽, plate = 아래 받침 앞 이름표
const BIN = { w: 486, h: 400, open: { top: 38.3, rim: 81.3, x0: 23.8, x1: 449.9 }, slot: { x0: 388.4, x1: 429, y0: 242.7, y1: 256.6 }, plate: { cx: 185, cy: 330, w: 150, h: 64 } };

// 장면 배치 (설계 크기 820×760 기준, eco2d.js)
const GY = 700;
const REMOTE_X = 186;
const RL = REMOTE_X - REMOTE.w / 2, RT = GY - REMOTE.h;          // 리모컨 그림 왼쪽 위
const SLOT_A = [RL + CELL.x, RT + CELL.y];                         // 보이는 건전지 자리
const SIDE = [Math.cos(CELL.rot), Math.sin(CELL.rot)];             // 건전지 가로 방향(칸 안 옆 칸 쪽)
const AXIS = [Math.sin(CELL.rot), -Math.cos(CELL.rot)];            // 건전지 + 쪽(칸 밖으로 빼는 방향)
const SLOT_B = [SLOT_A[0] - SIDE[0] * 40, SLOT_A[1] - SIDE[1] * 40]; // 뚜껑 밑에 숨은 옆 칸
const STACK_X = 362;                                               // 뺀 건전지를 눕혀 쌓는 자리
const PILE_X = [345, 388];                                         // 미리 모아 둔 건전지(세워 둠)
const TUBE = { L: 380, D: 38 };
const TUBE_X = 610, TUBE_Y = GY - TUBE.D / 2;                      // 형광등을 내려놓는 자리(가운데)
const KN = 330 / BIN.h;                                            // 수거함 크기 배율 (높이 330)
const BIN_X = 605;
const BL = BIN_X - BIN.w * KN / 2, BT = GY - BIN.h * KN;            // 수거함 그림 왼쪽 위
const SLOT = { x0: BL + BIN.slot.x0 * KN, x1: BL + BIN.slot.x1 * KN, y0: BT + BIN.slot.y0 * KN, y1: BT + BIN.slot.y1 * KN };
const HOLE = [(SLOT.x0 + SLOT.x1) / 2, (SLOT.y0 + SLOT.y1) / 2];   // 건전지 넣는 노란 투입구 가운데
const OPEN = { x: BL + (BIN.open.x0 + BIN.open.x1) / 2 * KN, top: BT + BIN.open.top * KN, rim: BT + BIN.open.rim * KN };
OPEN.y = (OPEN.top + OPEN.rim) / 2;                                 // 형광등을 들이미는 높이(윗칸 가운데)
const CELL_IN = 0.22, CELL_GAP = 0.1, CELL_FLY = 0.22; // 수거함 단계: 건전지 출발, 간격, 날아가는 시간 (3D와 같음)

export default {
  kind: "2d",
  // cells 1 = 건전지를 빼서 모음, tube 1 = 형광등을 조심히 내려놓음, box 1 = 수거함에 넣음
  states: [
    { cells: 0, tube: 0, box: 0 },
    { cells: 1, tube: 0, box: 0 },
    { cells: 1, tube: 1, box: 0 },
    { cells: 1, tube: 1, box: 1 }
  ],
  moves: [null, [["cells", 2.2]], [["tube", 2.2]], [["box", 3.6]]],
  images: { remote: D + "remote.webp", cell: D + "cell.webp?v=20261114d", cellL: D + "cell-l.webp?v=20261114d", cellR: D + "cell-r.webp?v=20261114d", bin: D + "bin.webp?v=20261114a" },
  draw: draw
};

function shadow(ctx, x, w, a) { shade(ctx, x, GY, w, a); }

function draw(ctx, v, s) {
  const img = s.img;
  sounds(v);
  const cp = v.cells, bp = v.box;

  // ── 수거함: 위에서 떨어져 통통 → 건전지·형광등이 들어갈 때마다 출렁 ──
  if (bp > 0) {
    const bt = clamp01(bp / 0.2);
    const drop = bounceDrop(bt) * 760;
    let kick = bt > 0.58 && bt < 0.82 ? Math.sin(Math.PI * (bt - 0.58) / 0.24) * 1.4 : 0;
    for (let i = 0; i < 4; i++) kick += wobble(clamp01((bp - CELL_IN - i * CELL_GAP - CELL_FLY * 0.9) / 0.1), 1) * 0.7;
    kick += wobble(clamp01((bp - 0.88) / 0.12), 2);
    const sy = 1 - kick * 0.06;
    shadow(ctx, BIN_X, BIN.w * KN * 1.05, 1 - drop / 760);
    ctx.save();
    ctx.translate(BIN_X, GY - drop);
    ctx.rotate(wobble(clamp01((bt - 0.6) / 0.4), 2) * 0.02);
    ctx.scale(KN / Math.sqrt(sy), KN * sy);
    ctx.drawImage(img.bin, -BIN.w / 2, -BIN.h, BIN.w, BIN.h);
    binPlate(ctx);
    ctx.restore();
  }

  // ── 리모컨: 꾹 움츠렸다가 건전지가 쏙 튀어나옴 ──
  let pinch = 0;
  for (let i = 0; i < 2; i++) {
    const t = clamp01((cp - i * 0.25) / 0.6);
    pinch += t > 0 && t < 0.2 ? Math.sin(Math.PI * t / 0.2) : 0;
  }
  const rsy = 1 - pinch * 0.04;
  shadow(ctx, REMOTE_X - 40, 230, 1);
  put(ctx, img.remote, REMOTE_X, GY, REMOTE.w, REMOTE.h, { sx: 1 / Math.sqrt(rsy), sy: rsy });

  // ── 모아 둔 건전지(세워 둔 2개) ──
  const cells = [cellB(v), cellA(v), pileCell(v, 1), pileCell(v, 0)]; // 수거함에 넣는 순서: 위에 쌓인 것부터
  cells.forEach(function (c, i) { flyCell(c, bp, CELL_IN + i * CELL_GAP); });
  // 그리는 순서: 세워 둔 것(뒤) → 눕힌 것(앞)
  [cells[3], cells[2], cells[1], cells[0]].forEach(function (c) { drawCell(ctx, img, c); });

  // ── 형광등 ──
  drawTubeStep(ctx, v);
}

// 건전지 하나의 모습: x, y(가운데), rot, s(크기), clipHole(리모컨 칸 안에서만 보임), into(수거함 구멍 안에서만 보임), shadowA
function cell(im, w, h, x, y, rot) { return { im: im, w: w, h: h, x: x, y: y, rot: rot, s: 1, clipHole: false, into: false, gone: false, sh: 0 }; }

// 1단계 리모컨 속 건전지: 칸에서 위로 쏙 빠짐 → 포물선으로 날아 눕혀 쌓는 자리에 통통 (3D와 같은 시간 나눔)
// i = 0: 보이는 건전지(A), i = 1: 옆 칸 건전지(B) — B는 A가 빠진 뒤 A 자리로 옮겨 와서 같은 식으로 빠짐
function popCell(v, i, landY) {
  const cp = v.cells;
  const t = clamp01((cp - i * 0.25) / 0.6);
  const c = cell("cell", CELL.w, CELL.h, SLOT_A[0], SLOT_A[1], CELL.rot);
  if (i === 1 && t <= 0) {
    // 옆 칸에서 A 자리로 미끄러져 옴(칸 안에서만 보이게 가림)
    const k = easeInOut(smooth(0.13, 0.24, cp));
    c.x = lerp(SLOT_B[0], SLOT_A[0], k);
    c.y = lerp(SLOT_B[1], SLOT_A[1], k);
    c.clipHole = true;
    return c;
  }
  const up = backOut(clamp01(t / 0.25)) * 74;       // 칸 밖으로 쏙
  const px = SLOT_A[0] + AXIS[0] * up, py = SLOT_A[1] + AXIS[1] * up;
  const q = clamp01((t - 0.25) / 0.75);
  const go = easeInOut(Math.min(q / 0.6, 1));       // 바닥에 닿을 때(0.6) 옮기기 끝
  const popTop = SLOT_A[1] + AXIS[1] * 74;
  c.x = lerp(px, STACK_X, go);
  c.y = q > 0 ? landY - bounceDrop(q) * (landY - popTop) - Math.sin(Math.PI * Math.min(q / 0.6, 1)) * 70 : py;
  c.rot = lerp(CELL.rot, Math.PI / 2, go) + wobble(clamp01((q - 0.6) / 0.4), 2) * 0.12;
  c.clipHole = t <= 0.02;
  c.sh = go;
  return c;
}
const cellA = function (v) { return popCell(v, 0, GY - CELL.w / 2); };
const cellB = function (v) { return popCell(v, 1, GY - CELL.w * 1.5 + 2); };
function pileCell(v, i) {
  const c = cell(i ? "cellR" : "cellL", PILE.w, PILE.h, PILE_X[i], GY - PILE.h / 2, 0);
  c.sh = 1;
  return c;
}

// 3단계: 움찔한 뒤 하나씩 포물선으로 날아 수거함 오른쪽 둥근 구멍으로 쏙 (구멍 가까이에서는 구멍 안만 보임)
function flyCell(c, bp, start) {
  c.y -= bp > start - 0.05 && bp < start ? Math.sin(Math.PI * (bp - start + 0.05) / 0.05) * 8 : 0;
  const raw = clamp01((bp - start) / CELL_FLY);
  if (raw <= 0) return;
  const q = easeInOut(raw);
  c.x = lerp(c.x, HOLE[0], q);
  c.y = lerp(c.y, HOLE[1], q) - Math.sin(Math.PI * q) * 150;
  c.rot = lerp(c.rot, Math.PI * 2.5, q);                 // 한 바퀴 돌며 눕힘(노란 투입구가 가로로 길어서)
  c.s = q > 0.7 ? lerp(1, 0.3, smooth(0.7, 1, q)) : 1;
  c.into = q > 0.86;
  c.sh *= 1 - q;
  c.gone = raw >= 1;
}

function drawCell(ctx, img, c) {
  if (c.gone) return;
  if (c.sh > 0.01) shadow(ctx, c.x, Math.max(c.w, Math.abs(Math.sin(c.rot)) * c.h) * 1.1, c.sh * clamp01(1 - (GY - c.y - c.h / 2) / 200));
  ctx.save();
  if (c.clipHole) {
    ctx.beginPath();
    CELL.hole.forEach(function (p, i) { ctx[i ? "lineTo" : "moveTo"](RL + p[0], RT + p[1]); });
    ctx.closePath();
    ctx.clip();
  }
  if (c.into) {
    ctx.beginPath();
    ctx.rect(SLOT.x0, SLOT.y0, SLOT.x1 - SLOT.x0, SLOT.y1 - SLOT.y0);
    ctx.clip();
  }
  put(ctx, img[c.im], c.x, c.y, c.w, c.h, { rot: c.rot, sx: c.s, sy: c.s, py: 0.5 });
  ctx.restore();
}

// 형광등: 2단계에 위에서 점점 느려지며 내려와 살며시 놓이고(작게 흔들림) 은은하게 빛남
// 3단계에 살짝 가라앉았다(준비) 눕힌 채 떠올라(조금 작아짐 = 안으로 들어감) 수거함 윗칸 앞으로 → 파란 받침 속으로 쏙
function drawTubeStep(ctx, v) {
  const tp = v.tube, bp = v.box;
  if (tp <= 0) return;
  const dq = clamp01(tp / 0.75);
  const down = 1 - Math.pow(1 - dq, 3);
  let x = TUBE_X, y = lerp(150, TUBE_Y, down), rot = wobble(clamp01((tp - 0.72) / 0.28), 2) * 0.04, s = 1;
  const glow = Math.sin(Math.PI * clamp01((tp - 0.6) / 0.4)) * 0.9;
  const q = clamp01((bp - 0.6) / 0.4);
  let inside = false, shA = smooth(0, 0.75, tp);
  if (q > 0) {
    const prep = q < 0.12 ? Math.sin(Math.PI * q / 0.12) : 0;
    const rise = easeInOut(clamp01((q - 0.1) / 0.45));
    const sk = clamp01((q - 0.6) / 0.35), sink = sk * sk;
    s = lerp(1, 0.85, rise);
    x = lerp(TUBE_X, OPEN.x, rise);
    y = lerp(TUBE_Y, OPEN.y, rise) - Math.sin(Math.PI * rise) * 70 + prep * 4 + sink * (OPEN.rim - OPEN.y + TUBE.D);
    rot = Math.sin(Math.PI * rise) * 0.05;
    inside = rise >= 1;          // 윗칸 안: 선반 아래 ~ 받침 테두리 위만 보임
    shA *= 1 - rise;
    if (sk >= 1) return;
  }
  shadow(ctx, x, TUBE.L * 1.05 * s, shA);
  ctx.save();
  if (inside) { ctx.beginPath(); ctx.rect(-500, OPEN.top, 2000, OPEN.rim - OPEN.top); ctx.clip(); }
  drawTube(ctx, x, y, TUBE.L * s, TUBE.D * s, rot, glow);
  ctx.restore();
}

// 형광등 그리기 (가운데 x, y, 길이 L, 굵기 d, 기울기 rot, 빛 0~1): 둥근 유리관 + 은색 마개 + 핀 2개씩
function drawTube(ctx, x, y, L, d, rot, glow) {
  const cap = d * 0.62;          // 마개 길이
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  // 유리관 (위가 밝고 아래가 살짝 어두운 원통)
  const g = ctx.createLinearGradient(0, -d / 2, 0, d / 2);
  g.addColorStop(0, "#e9eef2");
  g.addColorStop(0.28, "#ffffff");
  g.addColorStop(0.62, "#f1f4f6");
  g.addColorStop(1, "#c3ccd3");
  if (glow > 0.01) { ctx.shadowColor = `rgba(205,235,255,${0.9 * glow})`; ctx.shadowBlur = 26 * glow; }
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(-L / 2 + cap * 0.8, -d / 2, L - cap * 1.6, d, d * 0.2);
  ctx.fill();
  ctx.shadowColor = "transparent";
  if (glow > 0.01) {
    ctx.fillStyle = `rgba(232,246,255,${0.55 * glow})`;
    ctx.beginPath();
    ctx.roundRect(-L / 2 + cap, -d * 0.32, L - cap * 2, d * 0.5, d * 0.25);
    ctx.fill();
  }
  ctx.strokeStyle = "rgba(110,125,135,0.35)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.roundRect(-L / 2 + cap * 0.8, -d / 2, L - cap * 1.6, d, d * 0.2);
  ctx.stroke();
  // 양 끝 은색 마개와 핀
  const m = ctx.createLinearGradient(0, -d / 2, 0, d / 2);
  m.addColorStop(0, "#c9ced2");
  m.addColorStop(0.3, "#f4f6f7");
  m.addColorStop(1, "#8b9399");
  [-1, 1].forEach(function (sd) {
    const cx = sd * (L / 2 - cap / 2);
    const pin = d * 0.22, px = sd > 0 ? L / 2 - 1 : -L / 2 - pin + 1; // 마개 바깥으로 튀어나온 핀
    ctx.fillStyle = "#8b9399";
    ctx.fillRect(px, -d * 0.28, pin, d * 0.1);
    ctx.fillRect(px, d * 0.18, pin, d * 0.1);
    ctx.fillStyle = m;
    ctx.beginPath();
    ctx.roundRect(cx - cap / 2, -d / 2 - 1, cap, d + 2, 3);
    ctx.fill();
    ctx.strokeStyle = "rgba(80,90,98,0.45)";
    ctx.stroke();
  });
  ctx.restore();
}

// 수거함 아래 파란 받침 앞 흰 이름표 + 사이트 언어로 '건전지·형광등' (그림에 글자가 없어 여기서 씀, 좌표는 수거함 그림 기준)
function binPlate(ctx) {
  const P = BIN.plate;
  ctx.save();
  ctx.translate(-BIN.w / 2 + P.cx, -BIN.h + P.cy);
  ctx.shadowColor = "rgba(0,0,0,0.18)";
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 1;
  ctx.fillStyle = "#fbfcfd";
  ctx.beginPath();
  ctx.roundRect(-P.w / 2, -P.h / 2, P.w, P.h, 8);
  ctx.fill();
  ctx.shadowColor = "transparent";
  binLabel(ctx, "item.battery", -P.w / 2 + 6, -P.h / 2 + 2, P.w - 12, P.h - 4, "#1f5a9e");
  ctx.restore();
}

// 효과음 (3D 장면과 같은 순간)
function sounds(v) {
  if (hit(v, "cells", 0.06)) sfx.play("pop");                          // 건전지 쏙 빠짐
  if (hit(v, "cells", 0.42) || hit(v, "cells", 0.67)) sfx.play("tap"); // 모은 자리에 톡톡
  if (hit(v, "tube", 0.74)) sfx.play("clink");                         // 형광등 살며시 놓임
  if (hit(v, "box", 0.12)) sfx.play("thud");                           // 수거함 쿵
  if (hit(v, "box", CELL_IN + CELL_FLY * 0.9) || hit(v, "box", CELL_IN + 2 * CELL_GAP + CELL_FLY * 0.9)) sfx.play("rattle"); // 구멍에 달그락 (4개 중 두 번만)
  if (hit(v, "box", 0.86)) sfx.play("slide");                          // 형광등이 윗칸 받침 속으로 쏙
  if (hit(v, "box", 0.95)) sfx.play("chime");                          // 끝 띵동
}
