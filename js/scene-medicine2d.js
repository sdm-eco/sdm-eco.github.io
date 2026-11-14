// 폐의약품 장면 — 그림(2D)
// 서울시 폐의약품 안내: 알약·가루약은 포장된 그대로, 물약·시럽·연고는 마개를 닫아 용기째
// → 주민센터·보건소·구청 등 폐의약품 수거함
// 그림: img/scene/medicine/*.webp (medicine_assets.py가 만든 조각, 크기·위치는 meta.json 값을 아래 숫자로 옮김)
// 단계 값은 3D 장면(scene-medicine.js)과 같아 효과음 순간도 같게 맞춤
import { clamp01, smooth, easeInOut, backOut, lerp, bounceDrop, wobble } from "./eco3d-util.js?v=20261114b";
import { sfx, hit } from "./eco3d-sound.js?v=20261108r";
import { put, shadow as shade, binLabel } from "./eco2d-util.js?v=20261114d";

const D = "img/scene/medicine/";
// 그림 조각 크기(장면에 그대로 1:1로 씀)와 그 안의 위치
const BLISTER = { w: 184, h: 340 };
const PILLS = { w: 139, h: 250 };
const SYRUP = { w: 172, h: 410, cap: { w: 117, h: 98 } };   // 마개는 병 위 가운데, 마개 아랫선 = 병 위에서 98
const OINT = { w: 270, h: 98 };                            // 눕힌 모습(파란 마개가 왼쪽)
const BIN = { w: 300, h: 480, label: { x: 113, y: 198, w: 146, h: 78 }, slot: { x: 121, y: 84, w: 116, h: 26 } };

// 장면 배치 (설계 크기 820×760 기준, eco2d.js)
const GY = 700;             // 바닥선
const BIN_X = 655;          // 수거함 자리(3단계)
const SLOT = [BIN_X - BIN.w / 2 + BIN.slot.x + BIN.slot.w / 2, GY - BIN.h + BIN.slot.y + BIN.slot.h / 2]; // 투입구 가운데
const CAP_GROUND = 405;     // 시럽 마개가 처음 놓인 바닥 자리(x)
const SYRUP_X = 540;
// 물건별 자리: 처음 → 1단계에 모은 자리 → 3단계에 수거함 옆으로 비켜선 자리
const SPOT = {
  blister: [114, 150, 100],   // 처음 자리는 기울어진 모서리가 왼쪽 끝에 닿지 않게
  pills: [300, 268, 215],
  syrup: [SYRUP_X, SYRUP_X, 345],
  oint: [680, 705, 470]
};
const ENTER = 0.24, GAP = 0.15, FLY = 0.2; // 수거함 단계: 첫 물건 출발, 물건 사이 간격, 날아가는 시간 (3D와 같음)
const ORDER = ["oint", "syrup", "pills", "blister"]; // 수거함에 가까운 것부터 넣음

export default {
  kind: "2d",
  // pills 1 = 알약 포장을 그대로 모음, liquid 1 = 물약 마개를 닫아 모음, box 1 = 수거함에 넣음
  states: [
    { pills: 0, liquid: 0, box: 0 },
    { pills: 1, liquid: 0, box: 0 },
    { pills: 1, liquid: 1, box: 0 },
    { pills: 1, liquid: 1, box: 1 }
  ],
  moves: [null, [["pills", 2.0]], [["liquid", 2.2]], [["box", 3.4]]],
  images: {
    blister: D + "blister.webp", pills: D + "pillbottle.webp", syrup: D + "syrup.webp", cap: D + "syrup-cap.webp",
    oint: D + "ointment.webp", bin: D + "bin.webp"
  },
  draw: draw
};

function shadow(ctx, x, w, a) { shade(ctx, x, GY, w, a); }

function draw(ctx, v, s) {
  const img = s.img;
  sounds(v);
  const bp = v.box;

  // ── 수거함: 위에서 떨어져 통통 → 물건이 들어갈 때마다 출렁 ──
  if (bp > 0) {
    const bt = clamp01(bp / 0.25);
    const drop = bounceDrop(bt) * 760;
    let kick = bt > 0.58 && bt < 0.82 ? Math.sin(Math.PI * (bt - 0.58) / 0.24) * 1.4 : 0;
    for (let i = 0; i < ORDER.length; i++) kick += wobble(clamp01((bp - ENTER - i * GAP - FLY * 0.9) / 0.1), 1);
    const sy = 1 - kick * 0.06;
    shadow(ctx, BIN_X, BIN.w * 1.1, 1 - drop / 760);
    ctx.save();
    ctx.translate(BIN_X, GY - drop);
    ctx.rotate(wobble(clamp01((bt - 0.6) / 0.4), 2) * 0.03);
    ctx.scale(1 / Math.sqrt(sy), sy);
    ctx.drawImage(img.bin, -BIN.w / 2, -BIN.h, BIN.w, BIN.h);
    // 앞면 흰 라벨 자리에 사이트 언어로 '폐의약품'
    const L = BIN.label;
    binLabel(ctx, "item.medicine", -BIN.w / 2 + L.x, -BIN.h + L.y, L.w, L.h, "#2c7a4b");
    ctx.restore();
  }

  // ── 물건: 뒤에서 앞 순서(알약 포장 → 약통 → 마개 → 시럽병 → 연고) ──
  const shift = easeInOut(smooth(0.02, 0.22, bp)); // 3단계 시작: 수거함 자리를 비켜 왼쪽으로 모임
  const hop = Math.sin(Math.PI * shift) * 24;
  const poses = {
    blister: pillPose(v, 0, "blister", BLISTER, -0.09, 0),
    pills: pillPose(v, 1, "pills", PILLS, 0.08, 0),
    syrup: syrupPose(v),
    oint: ointPose(v)
  };
  for (const k in poses) {
    const p = poses[k];
    if (shift > 0) { p.x = lerp(p.x, SPOT[k][2], shift); p.lift += hop; }
  }
  // 수거함으로 날아가기: 준비(움츠림) → 포물선(돌며) → 투입구 앞에서 작아지며 쏙
  ORDER.forEach(function (k, i) { fly(poses[k], bp, ENTER + i * GAP); });

  drawItem(ctx, img.blister, BLISTER, poses.blister);
  drawItem(ctx, img.pills, PILLS, poses.pills);
  drawCap(ctx, img, v, poses.syrup);
  drawItem(ctx, img.syrup, SYRUP, poses.syrup);
  if (v.liquid >= 1) capOnBottle(ctx, img, poses.syrup);
  drawItem(ctx, img.oint, OINT, poses.oint);

  // ── '그대로 OK' 표시: 1단계 끝에 알약 묶음 위, 2단계 끝에 물약 위 (수거함이 오면 사라짐) ──
  const gone = 1 - smooth(0, 0.08, bp);
  badge(ctx, 205, GY - BLISTER.h - 46, backOut(smooth(0.8, 1, v.pills)) * gone);
  badge(ctx, 640, GY - 370, backOut(smooth(0.88, 1, v.liquid)) * gone);
}

// 물건 하나의 모습: x(가운데), lift(바닥에서 띄운 높이), rot(기울기), k(눌림: 1보다 작으면 납작), s(크기), clip(투입구 아래 가림), gone(다 들어감)
function pose(x, rot) { return { x: x, lift: 0, rot: rot, k: 1, s: 1, clip: false, gone: false, fly: 0 }; }

// 1단계: 알약 포장·약통이 뜯지 않은 그대로 움츠렸다(준비) 폴짝 뛰어 가운데로 모이고 → 통통 내려앉아 흔들림
function pillPose(v, i, key, size, rot0, rot1) {
  const t = clamp01((v.pills - i * 0.25) / 0.6);
  const go = easeInOut(clamp01((t - 0.15) / 0.61));
  const p = pose(lerp(SPOT[key][0], SPOT[key][1], go), lerp(rot0, rot1, go));
  const H = 110;
  p.lift = t < 0.15 ? 0 : t < 0.4 ? Math.sin(Math.PI * 0.5 * (t - 0.15) / 0.25) * H : bounceDrop((t - 0.4) / 0.6) * H;
  let squash = t > 0 && t < 0.15 ? Math.sin(Math.PI * t / 0.15) * 0.12 : 0;
  squash += t > 0.74 && t < 0.86 ? Math.sin(Math.PI * (t - 0.74) / 0.12) * 0.1 : 0;
  p.k = 1 - squash;
  p.rot += wobble(clamp01((t - 0.76) / 0.24), 2) * 0.06 + (t > 0.15 && t < 0.76 ? Math.sin(Math.PI * (t - 0.15) / 0.61) * 0.1 : 0);
  return p;
}

// 시럽병: 마개가 닫힐 때 꾹 눌렸다 돌아옴
function syrupPose(v) {
  const p = pose(SPOT.syrup[0], 0);
  const lq = v.liquid;
  p.k = 1 - (lq > 0.82 && lq < 1 ? Math.sin(Math.PI * (lq - 0.82) / 0.18) * 0.06 : 0);
  return p;
}

// 2단계 연고: 잠깐 뒤로 젖혔다가 살짝 지나치며 벌떡 서고(파란 마개가 아래) 제자리에서 흔들림
function ointPose(v) {
  const lq = v.liquid;
  const tq = clamp01((lq - 0.15) / 0.55);
  const prep = lq > 0.05 && lq < 0.15 ? Math.sin(Math.PI * (lq - 0.05) / 0.1) : 0;
  const p = pose(lerp(SPOT.oint[0], SPOT.oint[1], tq), -Math.PI / 2 * backOut(tq) + prep * 0.12 + wobble(clamp01((lq - 0.7) / 0.3), 2) * 0.08);
  p.lift = Math.sin(Math.PI * tq) * 40;
  p.stand = easeInOut(tq); // 0 = 누움, 1 = 섬 (바닥에서 가운데까지 높이가 달라짐)
  return p;
}

// 3단계: 움찔(준비) → 포물선으로 투입구까지 날아가며 눕혀지고(+90도) → 작아지며 투입구 아래는 가려져 쏙
function fly(p, bp, start) {
  const pre = bp > start - 0.06 && bp < start ? Math.sin(Math.PI * (bp - start + 0.06) / 0.06) * 0.12 : 0;
  p.k *= 1 - pre;
  const raw = clamp01((bp - start) / FLY);
  if (raw <= 0) return;
  const q = easeInOut(raw);
  p.fly = q;
  p.rot = lerp(p.rot, p.rot + Math.PI / 2, q);
  p.s = q > 0.7 ? lerp(1, 0.18, smooth(0.7, 1, q)) : 1 + Math.sin(Math.PI * q / 0.7) * 0.05;
  p.clip = q > 0.78;
  p.gone = raw >= 1;
}

// 물건 그리기: 바닥에 있을 때는 아랫선이 바닥(GY), 날아갈 때는 가운데가 포물선을 따라 투입구로
function drawItem(ctx, im, size, p) {
  if (p.gone) return;
  const half = p.stand !== undefined ? lerp(size.h, size.w, p.stand) / 2 : size.h / 2; // 바닥에서 그림 가운데까지
  let cx = p.x, cy = GY - half * p.k - p.lift;
  if (p.fly > 0) {
    const q = p.fly;
    cx = lerp(p.x, SLOT[0], q);
    cy = lerp(cy, SLOT[1], q) - Math.sin(Math.PI * q) * 170;
  }
  // 바닥 그림자: 높이 뜰수록 옅게, 날아가면 사라짐
  shadow(ctx, p.x, (p.stand !== undefined ? lerp(size.w, size.h, p.stand) : size.w) * 1.15, (1 - p.fly) * (1 - clamp01(p.lift / 160)));
  ctx.save();
  if (p.clip) { ctx.beginPath(); ctx.rect(-500, -500, 2000, SLOT[1] + BIN.slot.h / 2 + 500); ctx.clip(); }
  put(ctx, im, cx, cy, size.w, size.h, { rot: p.rot, sx: p.s / Math.sqrt(p.k), sy: p.s * p.k, py: 0.5 });
  ctx.restore();
  p.cx = cx; p.cy = cy;
}

// 2단계 시럽 마개: 바닥에 있다가 움찔한 뒤 포물선으로 떠올라 돌며 병 입구 위에 → 틱틱 돌려 내려가며 닫힘
function drawCap(ctx, img, v, sp) {
  const lq = v.liquid;
  if (lq >= 1) return;
  const w = SYRUP.cap.w, h = SYRUP.cap.h;
  const fly = easeInOut(clamp01(lq / 0.7));
  const screw = easeInOut(clamp01((lq - 0.7) / 0.3));
  const jig = lq < 0.08 ? Math.sin(Math.PI * lq / 0.08) * 6 : 0;
  const topY = GY - SYRUP.h * sp.k + h;          // 마개 아랫선이 닫혔을 때 자리
  const x = lerp(CAP_GROUND, sp.x, fly);
  const y = lerp(GY, topY - 26, fly) - Math.sin(Math.PI * fly) * 150 + screw * 26 - jig;
  let rot = fly * Math.PI * 2;
  if (lq > 0.7) rot = Math.sin(((lq - 0.7) / 0.3) * Math.PI * 3) * 0.08;
  shadow(ctx, x, w * 1.1, 1 - fly);
  put(ctx, img.cap, x, y, w, h, { rot: rot });
}
// 다 닫힌 뒤: 마개가 병과 함께 움직임(눌림·비행·크기)
function capOnBottle(ctx, img, sp) {
  if (sp.gone) return;
  const w = SYRUP.cap.w, h = SYRUP.cap.h;
  // 병 가운데 기준으로 마개 가운데까지: 병 위쪽 끝에서 마개 높이 절반 아래
  const dy = -SYRUP.h / 2 + h / 2;
  ctx.save();
  if (sp.clip) { ctx.beginPath(); ctx.rect(-500, -500, 2000, SLOT[1] + BIN.slot.h / 2 + 500); ctx.clip(); }
  ctx.translate(sp.cx, sp.cy);
  ctx.rotate(sp.rot);
  ctx.scale(sp.s / Math.sqrt(sp.k), sp.s * sp.k);
  ctx.drawImage(img.cap, -w / 2, dy - h / 2, w, h);
  ctx.restore();
}

// 초록 동그라미 안 흰 체크(✓) — 글자 없이 '이대로 좋아요'
function badge(ctx, x, y, k) {
  if (k <= 0.01) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  ctx.shadowColor = "rgba(30,60,45,0.25)";
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = "#3f9d68";
  ctx.beginPath();
  ctx.arc(0, 0, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(-11, 1);
  ctx.lineTo(-3, 9);
  ctx.lineTo(12, -8);
  ctx.stroke();
  ctx.restore();
}

// 효과음 (3D 장면과 같은 순간)
function sounds(v) {
  if (hit(v, "pills", 0.46) || hit(v, "pills", 0.71)) sfx.play("tap");   // 알약 포장·약통 톡톡
  if (hit(v, "liquid", 0.78) || hit(v, "liquid", 0.88)) sfx.play("tick"); // 마개 돌려 닫는 틱틱
  if (hit(v, "liquid", 0.98)) sfx.play("click");                         // 다 잠기면 딸깍
  if (hit(v, "box", 0.15)) sfx.play("thud");                             // 수거함 쿵
  for (let i = 0; i < ORDER.length; i++) if (hit(v, "box", ENTER + i * GAP + FLY * 0.9)) sfx.play("slide"); // 투입구에 쏙
  if (hit(v, "box", 0.95)) sfx.play("chime");                            // 끝 띵동
}
