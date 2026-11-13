// 일반 쓰레기 장면 — 그림(2D)
// 배출 순서: 서대문구청 안내(재활용품은 따로 골라내기 → 타는 쓰레기는 종량제 봉투에 담아 묶기 → 저녁 6시부터 내 집 앞에 내놓기)
// 그림: img/scene/general/*.webp (general_assets.py가 만듦), 종량제 봉투·집 앞·달·안내판은 그림이 없어 canvas 도형으로 그림
// 단계 값은 3D 장면(scene-general.js)과 같아 효과음 순간도 같게 맞춤
import { clamp01, smooth, easeInOut, backOut, lerp, bounceDrop, wobble } from "./eco3d-util.js?v=20261108r";
import { sfx, hit } from "./eco3d-sound.js?v=20261108r";
import { put, shadow as shade, t, fitText, binLabel } from "./eco2d-util.js?v=20261108r";

const D = "img/scene/general/";
// 그림 조각의 원래 크기 (general_assets.py가 잰 값)
const SIZE = { tissue: [217, 180], sponge: [177, 130], leaves: [210, 150], can: [145, 236], glass: [131, 370] };
const BIN = { w: 329, h: 400, rim: 34, label: { x: 127, y: 126, w: 147, h: 79 } };

// 장면 배치 (설계 크기 820×760 기준, eco2d.js)
const GY = 700;              // 바닥선
const KN = 360 / BIN.h;      // 재활용품 수거함 크기 배율 (높이 360)
const BIN_X = 650;
const BAG_X = 600, BAG_W = 300, BAG_H = 420;   // 종량제 봉투 자리·크기 (손잡이 끝까지)
const OUT_X = 430;           // 집 앞에 내놓는 자리 (문 오른쪽)
const DOOR_SIGN = [155, 300]; // 배출 시간 안내판 자리 (문 위)
// 바닥에 섞여 있는 쓰레기 (back: 뒤쪽 줄이라 조금 위에 놓임)
const TRASH = [
  { im: "tissue", x: 380, h: 130, rot: 0.25, flip: true, back: 34 },
  { im: "tissue", x: 125, h: 175, rot: -0.06 },
  { im: "leaves", x: 300, h: 140, rot: 0.04 },
  { im: "sponge", x: 478, h: 118, rot: 0.06 }
];
// 봉투에 넣는 순서 (TRASH 번호)
const ORDER = [1, 2, 3, 0];
// 재활용품 (seq: 수거함에 들어가는 차례 — 캔 먼저, 유리병 다음. 그리는 순서는 뒤쪽 줄인 유리병 먼저)
const RECYC = [
  { im: "glass", x: 610, h: 360, back: 18, seq: 1 },
  { im: "can", x: 718, h: 228, seq: 0 }
];

export default {
  kind: "2d",
  // sort 1 = 재활용품을 골라냄, bag 1 = 종량제 봉투에 담아 묶음, out 1 = 저녁에 집 앞에 내놓음
  states: [
    { sort: 0, bag: 0, out: 0 },
    { sort: 1, bag: 0, out: 0 },
    { sort: 1, bag: 1, out: 0 },
    { sort: 1, bag: 1, out: 1 }
  ],
  moves: [null, [["sort", 2.8]], [["bag", 3.8]], [["out", 3.2]]],
  images: {
    tissue: D + "tissue.webp", sponge: D + "sponge.webp", leaves: D + "leaves.webp",
    can: D + "can.webp", glass: D + "glass.webp", bin: D + "bin.webp"
  },
  draw: draw
};

function shadow(ctx, x, w, a) { shade(ctx, x, GY, w, a); }

function draw(ctx, v, s) {
  const img = s.img;
  sounds(v);
  const sp = v.sort, bp = v.bag, op = v.out;

  // ── 3단계 배경: 집 앞 벽이 바닥에서 솟아오르고 달이 뜸 ──
  if (op > 0) drawHouse(ctx, op);

  // ── 재활용품 수거함: 1단계에 오른쪽에서 들어오고, 2단계 시작에 다시 나감 ──
  const binIn = 1 - Math.pow(1 - clamp01(sp / 0.13), 3);
  const binOut = easeInOut(clamp01(bp / 0.12));
  const binX = lerp(lerp(1120, BIN_X, binIn), 1150, binOut);
  let binShake = wobble(clamp01((sp - 0.13) / 0.2), 2) * 0.4;
  RECYC.forEach(function (r) { binShake += wobble(clamp01((sp - 0.52 - r.seq * 0.25) / 0.2), 2); });
  const nw = BIN.w * KN, nh = BIN.h * KN;
  const binTop = GY - nh;
  if (sp > 0 && binOut < 1) {
    shadow(ctx, binX, nw * 1.05, 1 - binOut);
    put(ctx, img.bin, binX, GY, nw, nh, { rot: binShake * 0.03 });
    binLabel(ctx, "cat.recycle", binX - nw / 2 + BIN.label.x * KN, binTop + BIN.label.y * KN, BIN.label.w * KN, BIN.label.h * KN);
  }

  // ── 종량제 봉투: 2단계에 위에서 떨어져 통통 튐 → 쓰레기가 들어가며 불룩 → 입구를 묶음, 3단계에 집 앞으로 폴짝 ──
  const tie = easeInOut(clamp01((bp - 0.78) / 0.18));
  let landed = 0, jiggle = 0;
  ORDER.forEach(function (n, i) {
    landed += smooth(0.3, 0.36, bp - i * 0.12);
    jiggle += wobble(clamp01((bp - 0.36 - i * 0.12) / 0.14), 1);
  });
  const tied = wobble(clamp01((bp - 0.92) / 0.08), 2);
  const crouch = op > 0.28 && op < 0.38 ? Math.sin(Math.PI * (op - 0.28) / 0.1) : 0;
  const carry = easeInOut(clamp01((op - 0.34) / 0.36));
  const land = wobble(clamp01((op - 0.7) / 0.25), 2);
  const bagX = lerp(BAG_X, OUT_X, carry);
  const bagLift = bounceDrop(clamp01(bp / 0.22)) * 520 + Math.sin(Math.PI * carry) * 120;
  const k = 1 - jiggle * 0.05 - crouch * 0.12 + (carry > 0 && carry < 0.5 ? Math.sin(Math.PI * carry / 0.5) * 0.07 : 0) - land * 0.06;
  const bag = { full: landed / ORDER.length, tie: tie, sx: 1 / Math.sqrt(k), sy: k, rot: Math.sin(Math.PI * carry) * -0.12 + tied * 0.04, label: "item.general" };
  const showBag = bp > 0;
  if (showBag) {
    shadow(ctx, bagX, BAG_W * 1.1, 1 - smooth(0, 300, bagLift));
    drawBag(ctx, bagX, GY - bagLift, BAG_W, BAG_H, Object.assign({ part: "back" }, bag));
  }
  const mouthY = GY - bagLift - (BAG_H * 0.82 - BAG_W * 0.04) * k;   // 입구 앞 테두리 (bagShape의 my + mr/2)

  // ── 바닥의 쓰레기 (뒤쪽 줄 먼저) ──
  TRASH.forEach(function (it, n) {
    const i = ORDER.indexOf(n);
    const q = clamp01((bp - 0.15 - i * 0.12) / 0.22);
    if (q >= 1) return;
    hop(ctx, img[it.im], it, q, BAG_X, mouthY, 160);
  });
  if (showBag) drawBag(ctx, bagX, GY - bagLift, BAG_W, BAG_H, Object.assign({ part: "front" }, bag));

  // ── 재활용품: 수거함 앞에 섞여 있다가 차례로 폴짝 뛰어 수거함 안으로 ──
  RECYC.forEach(function (it) {
    const q = clamp01((sp - 0.24 - it.seq * 0.25) / 0.28);
    if (q >= 1) return;
    hop(ctx, img[it.im], it, q, BIN_X, binTop + BIN.rim * KN, 200);
  });
}

// 바닥에서 움츠렸다(준비) → 포물선으로 날아 → 입구(tx, ty) 안으로 쏙 (입구선 아래는 가림)
function hop(ctx, im, it, q, tx, ty, arc) {
  const w = SIZE[it.im][0] * it.h / SIZE[it.im][1], h = it.h;
  const gy = GY - (it.back || 0);
  const crouch = q > 0 && q < 0.16 ? Math.sin(Math.PI * q / 0.16) : 0;
  const f = clamp01((q - 0.12) / 0.88);
  const e = easeInOut(f);
  const x = lerp(it.x, tx, e);
  // 아래 가운데 기준 → 날 때는 가운데 기준으로 돌림
  const endY = ty + h * 0.75;
  const cy = lerp(gy - h / 2, endY, e) - Math.sin(Math.PI * Math.min(e / 0.85, 1)) * arc;
  if (f === 0) shadow(ctx, it.x, w * 1.05, 1);
  else shadow(ctx, it.x, w * 1.05, 1 - smooth(0, 0.3, f));
  ctx.save();
  if (f > 0.5) {
    ctx.beginPath();
    ctx.rect(-500, -500, 2000, ty + 500);
    ctx.clip();
  }
  const sc = lerp(1, 0.78, e);
  put(ctx, im, x, cy, w * sc, h * sc, {
    py: 0.5, rot: (it.rot || 0) + e * (it.im === "glass" ? -2.4 : 2.2),
    sx: (it.flip ? -1 : 1) * (1 + crouch * 0.06), sy: 1 - crouch * 0.12 + (f > 0 && f < 0.3 ? Math.sin(Math.PI * f / 0.3) * 0.06 : 0)
  });
  ctx.restore();
}

// 종량제 봉투 (canvas 도형): 아래가 불룩한 크림색 비닐 자루 + 초록 띠에 이름, 열린 입구 양옆에 손잡이 고리
//   묶으면 입구가 오므라들고 손잡이 끝이 두 귀처럼 매듭 위로 삐져나옴
//   x, gy: 바닥 가운데, w·h: 크기, o = { full 0~1(불룩), tie 0~1(묶음), sx, sy(눌림), rot, label(i18n 키), part }
//   part "back": 뒤판(입구 안쪽·손잡이), "front": 앞판(몸통·띠·이름), "all": 둘 다
//   열린 봉투에 물건을 넣을 때는 "back" → 물건 → "front" 순서로 그리면 물건이 앞판 뒤로 들어감
// 음식물 장면(scene-food2d.js)에서도 일반쓰레기를 담는 봉투로 씀
export function drawBag(ctx, x, gy, w, h, o) {
  o = o || {};
  const tie = o.tie || 0, part = o.part || "all";
  ctx.save();
  ctx.translate(x, gy);
  if (o.rot) ctx.rotate(o.rot);
  ctx.scale(o.sx || 1, o.sy || 1);
  if (part !== "front" && tie < 0.999) bagPanel(ctx, w, h, o, true);
  if (part !== "back") bagPanel(ctx, w, h, o, false);
  ctx.restore();
}
// 봉투 윤곽 (오른쪽 절반을 곡선으로 잘게 나눈 뒤 왼쪽은 거울처럼)
//   앞판의 윗선은 입구 타원의 아래쪽 반, 뒤판의 윗선은 위쪽 반 → 둘 사이로 봉투 속이 보임
function bagShape(w, h, full, tie, back) {
  const hw = w / 2;
  const bw = hw * 0.9, bul = hw * (0.03 + 0.09 * full);
  const sw = lerp(hw * 0.94, hw * 0.6, tie);
  const mw = lerp(hw * 0.7, hw * 0.06, tie), my = lerp(-h * 0.82, -h * 0.86, tie), mr = mw * 0.24;
  const pts = [[0, 0]];
  function seg(p0, c1, c2, p1) {
    for (let i = 1; i <= 12; i++) {
      const s = i / 12, u = 1 - s;
      pts.push([u * u * u * p0[0] + 3 * u * u * s * c1[0] + 3 * u * s * s * c2[0] + s * s * s * p1[0],
        u * u * u * p0[1] + 3 * u * u * s * c1[1] + 3 * u * s * s * c2[1] + s * s * s * p1[1]]);
    }
  }
  const c = hw * 0.1;
  pts.push([bw - c, 0]);
  seg([bw - c, 0], [bw, 0], [bw, 0], [bw, -c]);
  seg([bw, -c], [bw + bul, -h * 0.22], [sw + bul * 0.6, -h * 0.42], [sw, -h * 0.56]);
  seg([sw, -h * 0.56], [sw, -h * 0.68], [mw + hw * 0.06 * (1 - tie), my + h * 0.08], [mw, my]);
  // 입구 테두리 (가운데까지 타원 반쪽)
  for (let i = 1; i <= 16; i++) {
    const a = (i / 16) * Math.PI / 2;
    pts.push([mw * Math.cos(a), my + (back ? -1 : 1) * mr * Math.sin(a)]);
  }
  const left = pts.slice(0, -1).reverse().map(function (p) { return [-p[0], p[1]]; });
  return { pts: pts.concat(left), mw: mw, my: my, mr: mr };
}
function bagPanel(ctx, w, h, o, back) {
  const tie = o.tie || 0, hw = w / 2;
  const sh = bagShape(w, h, o.full || 0, tie, back);
  function path() {
    ctx.beginPath();
    sh.pts.forEach(function (p, i) { if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); });
    ctx.closePath();
  }
  ctx.lineJoin = "round";
  if (back) {
    // 손잡이 고리 (입구 양옆에서 위로 둥글게, 묶으면 사라짐)
    const ha = 1 - smooth(0.15, 0.45, tie);
    if (ha > 0.01) {
      ctx.save();
      ctx.globalAlpha = ha;
      ctx.lineCap = "round";
      [-1, 1].forEach(function (sg) {
        ctx.beginPath();
        ctx.ellipse(sg * sh.mw * 0.66, sh.my + h * 0.01, sh.mw * 0.3, h * 0.13, sg * 0.12, Math.PI * 1.05, Math.PI * 1.95);
        ctx.strokeStyle = "rgba(120,125,105,0.55)";
        ctx.lineWidth = w * 0.075 + 4;
        ctx.stroke();
        ctx.strokeStyle = "#f3f1e8";
        ctx.lineWidth = w * 0.075;
        ctx.stroke();
      });
      ctx.restore();
    }
    // 뒤판 안쪽: 입구 아래로 갈수록 어두운 봉투 속
    const g = ctx.createLinearGradient(0, sh.my - sh.mr, 0, sh.my + sh.mr);
    g.addColorStop(0, "#d7d4c7");
    g.addColorStop(1, "#7d847a");
    path();
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = "rgba(120,125,105,0.5)";
    ctx.lineWidth = 2;
    ctx.stroke();
    return;
  }
  // 앞판: 가장자리는 조금 어둡고 가운데 왼쪽이 밝은 크림색 비닐
  const g = ctx.createLinearGradient(-hw, 0, hw, 0);
  g.addColorStop(0, "#d4d1c2");
  g.addColorStop(0.3, "#fbfaf3");
  g.addColorStop(0.6, "#f2f0e6");
  g.addColorStop(1, "#c8c5b5");
  path();
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  path();
  ctx.clip();
  // 바닥 쪽 그늘
  const gb = ctx.createLinearGradient(0, 0, 0, -h * 0.25);
  gb.addColorStop(0, "rgba(90,95,80,0.22)");
  gb.addColorStop(1, "rgba(90,95,80,0)");
  ctx.fillStyle = gb;
  ctx.fillRect(-w, -h * 0.25, w * 2, h * 0.27);
  // 초록 띠 두 줄 (가운데가 살짝 처져 둥근 몸통처럼)
  function band(y0, y1) {
    ctx.beginPath();
    ctx.moveTo(-w, y0);
    ctx.quadraticCurveTo(0, y0 + h * 0.02, w, y0);
    ctx.lineTo(w, y1);
    ctx.quadraticCurveTo(0, y1 + h * 0.02, -w, y1);
    ctx.closePath();
    ctx.fillStyle = "#52b183";
    ctx.fill();
  }
  band(-h * 0.46, -h * 0.34);
  band(-h * 0.31, -h * 0.295);
  // 비닐 주름 (입구 쪽에서 아래로, 묶으면 목 쪽으로 모임)
  ctx.strokeStyle = "rgba(80,85,70,0.12)";
  ctx.lineWidth = Math.max(2, w * 0.012);
  ctx.lineCap = "round";
  [-0.6, -0.25, 0.15, 0.5].forEach(function (k, i) {
    ctx.beginPath();
    ctx.moveTo(k * sh.mw * 1.1, sh.my + sh.mr * 0.8);
    ctx.quadraticCurveTo(k * hw * 1.1 + (i % 2 ? 10 : -10), -h * 0.6, k * hw * 1.05, -h * (0.5 - (i % 2) * 0.06));
    ctx.stroke();
  });
  // 왼쪽 반짝임
  const gl = ctx.createRadialGradient(-hw * 0.45, -h * 0.58, 2, -hw * 0.45, -h * 0.58, hw * 0.5);
  gl.addColorStop(0, "rgba(255,255,255,0.75)");
  gl.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gl;
  ctx.fillRect(-w, -h, w * 2, h);
  ctx.restore();
  path();
  ctx.strokeStyle = "rgba(120,125,105,0.5)";
  ctx.lineWidth = 2;
  ctx.stroke();
  // 입구 앞 테두리를 조금 두툼하게
  if (tie < 0.5) {
    ctx.beginPath();
    ctx.ellipse(0, sh.my + 2, sh.mw, sh.mr, 0, 0.05, Math.PI - 0.05);
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 4;
    ctx.stroke();
  }
  if (o.label) fitText(ctx, t(o.label), 0, -h * 0.392, w * 0.72, h * 0.07, 800, "#ffffff");
  if (tie > 0.5) {
    // 매듭: 모은 손잡이 끝이 두 귀처럼 삐져나옴
    const kk = Math.max(backOut(clamp01((tie - 0.5) / 0.5)), 0.001);
    ctx.save();
    ctx.translate(0, sh.my - 4);
    ctx.scale(kk, kk);
    ctx.fillStyle = "#f6f4ec";
    ctx.strokeStyle = "rgba(120,125,105,0.55)";
    ctx.lineWidth = 2;
    [-1, 1].forEach(function (sg) {
      ctx.beginPath();
      ctx.ellipse(sg * w * 0.1, -h * 0.035, w * 0.115, w * 0.05, sg * -0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
    ctx.beginPath();
    ctx.ellipse(0, 0, w * 0.05, w * 0.045, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

// 집 앞 (canvas 도형): 처마·벽·초록 문·불 켜진 창·현관등, 배출 시간 안내판(달 + 18:00 ~), 하늘의 달
function drawHouse(ctx, op) {
  const rise = Math.max(backOut(clamp01(op / 0.3)), 0.001);
  ctx.save();
  ctx.translate(0, GY);
  ctx.scale(1, rise);
  ctx.translate(0, -GY);
  // 벽
  const L = 30, Rr = 790, TOP = 190;
  const wg = ctx.createLinearGradient(0, TOP, 0, GY);
  wg.addColorStop(0, "#f1e2c9");
  wg.addColorStop(1, "#e8d5b6");
  ctx.fillStyle = wg;
  rr(ctx, L, TOP, Rr - L, GY - TOP, 10);
  ctx.fill();
  // 벽돌 느낌의 옅은 가로줄
  ctx.strokeStyle = "rgba(170,140,100,0.12)";
  ctx.lineWidth = 2;
  for (let y = TOP + 50; y < GY - 40; y += 46) {
    ctx.beginPath();
    ctx.moveTo(L + 6, y);
    ctx.lineTo(Rr - 6, y);
    ctx.stroke();
  }
  // 아래 받침
  ctx.fillStyle = "#cdb48f";
  ctx.fillRect(L, GY - 34, Rr - L, 34);
  // 처마
  ctx.fillStyle = "rgba(60,40,20,0.18)";
  ctx.fillRect(L, TOP + 22, Rr - L, 14);
  ctx.fillStyle = "#b98a5e";
  rr(ctx, L - 16, TOP - 12, Rr - L + 32, 34, 8);
  ctx.fill();
  ctx.fillStyle = "#a07247";
  ctx.fillRect(L - 16, TOP + 12, Rr - L + 32, 10);
  // 문 + 문틀 + 손잡이
  const DX = 75, DW = 160, DT = 372;
  ctx.fillStyle = "#4f7f58";
  rr(ctx, DX - 12, DT - 12, DW + 24, GY - 34 - DT + 12, 8);
  ctx.fill();
  const dg = ctx.createLinearGradient(DX, 0, DX + DW, 0);
  dg.addColorStop(0, "#6aa778");
  dg.addColorStop(1, "#5b9568");
  ctx.fillStyle = dg;
  rr(ctx, DX, DT, DW, GY - 34 - DT, 6);
  ctx.fill();
  ctx.strokeStyle = "rgba(30,70,40,0.25)";
  ctx.lineWidth = 3;
  rr(ctx, DX + 20, DT + 24, DW - 40, 120, 6);
  ctx.stroke();
  rr(ctx, DX + 20, DT + 168, DW - 40, 110, 6);
  ctx.stroke();
  ctx.fillStyle = "#e9c46a";
  ctx.beginPath();
  ctx.arc(DX + DW - 24, DT + 160, 8, 0, Math.PI * 2);
  ctx.fill();
  // 현관등 (따뜻한 불빛)
  const lx = DX + DW + 36, ly = DT + 40;
  const lg = ctx.createRadialGradient(lx, ly, 4, lx, ly, 120);
  lg.addColorStop(0, "rgba(255,214,120,0.55)");
  lg.addColorStop(1, "rgba(255,214,120,0)");
  ctx.fillStyle = lg;
  ctx.fillRect(lx - 120, ly - 120, 240, 240);
  ctx.fillStyle = "#6b5a46";
  ctx.fillRect(lx - 4, ly - 26, 8, 12);
  ctx.fillStyle = "#ffe39a";
  rr(ctx, lx - 14, ly - 16, 28, 30, 8);
  ctx.fill();
  // 불 켜진 창
  const WX = 605, WY = 320, WW = 165, WH = 140;
  ctx.fillStyle = "#f7f1e6";
  rr(ctx, WX - 12, WY - 12, WW + 24, WH + 24, 8);
  ctx.fill();
  const gw = ctx.createLinearGradient(0, WY, 0, WY + WH);
  gw.addColorStop(0, "#ffe8a3");
  gw.addColorStop(1, "#f6c96b");
  ctx.fillStyle = gw;
  ctx.fillRect(WX, WY, WW, WH);
  ctx.fillStyle = "#f7f1e6";
  ctx.fillRect(WX + WW / 2 - 5, WY, 10, WH);
  ctx.fillRect(WX, WY + WH / 2 - 5, WW, 10);
  ctx.fillStyle = "#d9c3a0";
  ctx.fillRect(WX - 18, WY + WH + 12, WW + 36, 12);
  ctx.restore();

  // 배출 시간 안내판: 통통 튀며 나타남 (달 + 18:00 ~)
  const sk = backOut(clamp01((op - 0.75) / 0.22));
  if (sk > 0.001) {
    ctx.save();
    ctx.translate(DOOR_SIGN[0], DOOR_SIGN[1]);
    ctx.scale(sk * 0.95, sk * 0.95);
    ctx.fillStyle = "rgba(40,50,80,0.18)";
    rr(ctx, -84, -46, 172, 100, 18);
    ctx.fill();
    ctx.fillStyle = "#6f8fd8";
    rr(ctx, -88, -52, 176, 100, 18);
    ctx.fill();
    ctx.strokeStyle = "#fff6e6";
    ctx.lineWidth = 4;
    ctx.stroke();
    moon(ctx, -50, -2, 22, "#6f8fd8");
    fitText(ctx, "18:00 ~", 22, -2, 104, 30, 800, "#fff6e6");
    ctx.restore();
  }
  // 하늘의 달 (떠오름) + 반짝이는 별
  const mk = clamp01((op - 0.15) / 0.25), MX = 560;
  if (mk > 0) {
    const my = 108 + (1 - easeInOut(clamp01((op - 0.15) / 0.35))) * 40;   // 오른쪽 위 구석(효과음 버튼 자리)은 피함
    ctx.save();
    ctx.globalAlpha = smooth(0, 0.5, mk);
    const mg = ctx.createRadialGradient(MX, my, 10, MX, my, 90);
    mg.addColorStop(0, "rgba(255,236,160,0.5)");
    mg.addColorStop(1, "rgba(255,236,160,0)");
    ctx.fillStyle = mg;
    ctx.fillRect(MX - 90, my - 90, 180, 180);
    crescent(ctx, MX, my, 36 * backOut(mk), "#ffe39a");
    [[440, 92, 6], [630, 76, 5], [690, 150, 4]].forEach(function (st, i) {
      star(ctx, st[0], st[1], st[2] * (0.8 + 0.2 * Math.sin(op * 20 + i * 2)), "#f7d36e");
    });
    ctx.restore();
  }
}
// 하늘의 초승달: 큰 원에서 비껴 놓인 작은 원을 뺀 모양을 두 호로 그림 (바탕색과 상관없이)
function crescent(ctx, x, y, r, col) {
  const x2 = x + r * 0.45, y2 = y - r * 0.3, r2 = r * 0.85;
  const d = Math.hypot(x2 - x, y2 - y), a = (r * r - r2 * r2 + d * d) / (2 * d), hh = Math.sqrt(r * r - a * a);
  const px = x + a * (x2 - x) / d, py = y + a * (y2 - y) / d, nx = -(y2 - y) / d, ny = (x2 - x) / d;
  const i1 = [px + hh * nx, py + hh * ny], i2 = [px - hh * nx, py - hh * ny];
  const far = Math.atan2(y - y2, x - x2);
  ctx.fillStyle = col;
  ctx.beginPath();
  arcThrough(ctx, x, y, r, Math.atan2(i1[1] - y, i1[0] - x), Math.atan2(i2[1] - y, i2[0] - x), far);
  arcThrough(ctx, x2, y2, r2, Math.atan2(i2[1] - y2, i2[0] - x2), Math.atan2(i1[1] - y2, i1[0] - x2), far);
  ctx.closePath();
  ctx.fill();
}
// from에서 to까지 through 각도를 지나는 쪽으로 호를 그림
function arcThrough(ctx, x, y, r, from, to, through) {
  const T = Math.PI * 2, n = function (a) { return ((a % T) + T) % T; };
  ctx.arc(x, y, r, from, to, !(n(through - from) < n(to - from)));
}
// 안내판의 초승달: 노란 원에서 바탕색 원을 겹쳐 지움
function moon(ctx, x, y, r, bg) {
  ctx.fillStyle = "#f7d36e";
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.arc(x + r * 0.5, y - r * 0.35, r * 0.85, 0, Math.PI * 2);
  ctx.fill();
}
function star(ctx, x, y, r, col) {
  ctx.fillStyle = col;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4, rr2 = i % 2 ? r * 0.35 : r;
    ctx.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2);
  }
  ctx.closePath();
  ctx.fill();
}
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

// 효과음 (3D 장면과 같은 순간)
function sounds(v) {
  if (hit(v, "sort", 0.132)) sfx.play("tap");           // 수거함이 멈춰 설 때 톡
  if (hit(v, "sort", 0.52)) sfx.play("slide");          // 캔이 수거함에 쏙
  if (hit(v, "sort", 0.77)) sfx.play("clink");          // 유리병이 수거함에 쨍
  if (hit(v, "bag", 0.132)) sfx.play("rustle", 0.25);   // 봉투가 떨어질 때 바스락
  if (hit(v, "bag", 0.33)) sfx.play("rustle", 1.6);     // 쓰레기가 하나씩 들어가는 동안 바스락
  if (hit(v, "bag", 0.82)) sfx.play("tie");             // 입구 묶기 슥슥
  if (hit(v, "out", 0.7)) sfx.play("thud");             // 집 앞에 털썩
  if (hit(v, "out", 0.95)) sfx.play("chime");           // 끝 띵동
}
