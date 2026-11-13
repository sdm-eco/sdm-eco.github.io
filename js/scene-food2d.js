// 음식물 쓰레기 장면 — 그림(2D)
// 배출 순서: 서대문구청 안내(물기 빼기 → 뼈·조개/달걀 껍데기·복숭아 씨는 일반쓰레기로 골라내기
//            → 노란 음식물 전용 봉투에 담아 음식물 수거용기에 넣기)
// 그림: img/scene/food/*.webp (food_assets.py가 물빠짐 바구니·수거함을 조각으로 나눔), 물은 canvas 도형
//       종량제 봉투(일반용·음식물용)는 구청 자료의 서대문구 봉투 사진 (scene-general2d.js drawBag)
// 단계 값은 3D 장면(scene-food.js)과 같아 효과음 순간도 같게 맞춤
import { clamp01, smooth, easeInOut, lerp, tiltCurve, bounceDrop, wobble } from "./eco3d-util.js?v=20261108r";
import { sfx, hit } from "./eco3d-sound.js?v=20261108r";
import { put, shadow as shade, dropsEmit, dropsDraw, t, fitText } from "./eco2d-util.js?v=20261108r";
import { drawBag, bagMouth, BAG_IMG } from "./scene-general2d.js?v=20261114a";

const D = "img/scene/food/";
// 그림 조각의 원래 크기와 그 안의 위치 (food_assets.py가 잰 값, meta.json)
const BASKET = { w: 394, h: 333, rim: { cx: 199, cy: 110, rx: 160, ry: 88 } };
const MOUND = { x: 105, y: 127, w: 194, h: 73 };
const SLOTS = { x: 63, y: 206, w: 260, h: 113 };
const BIN = { w: 280, h: 420, lid: { x: 3, w: 264, h: 91, hinge: 40 }, mouth: [[24, 50], [244, 36], [262, 74], [14, 88]], label: { x: 120, y: 154, w: 107, h: 61 } };
// 골라낼 일반쓰레기: 바구니 그림 안 자리(가운데), 크기 배율, 기울기 (집어 내는 차례대로)
const JUNK = [
  { im: "bone", w: 191, h: 150, x: 150, y: 140, k: 0.6, rot: -0.2 },
  { im: "egg", w: 227, h: 110, x: 252, y: 146, k: 0.5, rot: 0.1 },
  { im: "shell", w: 211, h: 120, x: 205, y: 170, k: 0.48, rot: 0 },
  { im: "pit", w: 91, h: 100, x: 292, y: 168, k: 0.56, rot: 0.3 }
];

// 장면 배치 (설계 크기 820×760 기준, eco2d.js)
const GY = 700;                 // 바닥선
const KB = 460 / BASKET.w;      // 바구니 크기 배율 (너비 460)
const B0 = 405, B1 = 470;       // 바구니 자리 (처음, 일반쓰레기 봉투가 나온 뒤)
const HOLD = [392, 250, 0.6];   // 음식물 봉투 위에서 쏟을 때 바구니 가운데·크기
const REST = [380, 0.62];       // 다 쏟고 내려놓는 자리·크기
const KN = 400 / BIN.h;         // 수거함 크기 배율 (높이 400)
const BIN_X = 655;
const BAG = [122, 210, 300];    // 일반쓰레기 봉투 자리·너비·높이
const FBAG = [392, 300];        // 노란 음식물 봉투 자리·높이

export default {
  kind: "2d",
  // water 1 = 물기 가득, pick 1 = 일반쓰레기를 골라냄, bin 1 = 전용 수거함에 넣음
  states: [
    { water: 1, pick: 0, bin: 0 },
    { water: 0, pick: 0, bin: 0 },
    { water: 0, pick: 1, bin: 0 },
    { water: 0, pick: 1, bin: 1 }
  ],
  moves: [null, [["water", 2.6]], [["pick", 3.4]], [["bin", 3.6]]],
  images: {
    back: D + "basket-back.webp", front: D + "basket-front.webp", slots: D + "basket-slots.webp", wet: D + "basket-water.webp",
    mound: D + "mound.webp", bone: D + "bone.webp", egg: D + "egg.webp", shell: D + "shell.webp", pit: D + "pit.webp",
    body: D + "bin-body.webp", lid: D + "bin-lid.webp", bagG: BAG_IMG.general, bagF: BAG_IMG.food
  },
  draw: draw
};

function shadow(ctx, x, w, a) { shade(ctx, x, GY, w, a); }

function draw(ctx, v, s) {
  const img = s.img;
  sounds(v);
  const q = 1 - v.water, pk = v.pick, bp = v.bin;

  // ── 바구니 위치·크기·기울기 (가운데 기준) ──
  let bx = lerp(B0, B1, easeInOut(smooth(0, 0.15, pk))), k = 1, rot = 0, lift = 0, sq = 1;
  // 1단계: 살짝 눌렀다가(준비) 들어 올려 흔들며 물을 빼고, 내려놓을 때 통통
  if (q > 0 && q < 1) {
    if (q < 0.08) sq = 1 - Math.sin(Math.PI * q / 0.08) * 0.05;
    else if (q < 0.8) lift = easeInOut(clamp01((q - 0.08) / 0.16)) * 120;
    else lift = bounceDrop(clamp01((q - 0.8) / 0.2)) * 120;
    const env = smooth(0.12, 0.3, q) * (1 - smooth(0.72, 0.84, q));
    bx += Math.sin(q * 52) * 12 * env;
    rot = Math.sin(q * 52 + 1.2) * 0.06 * env + wobble(clamp01((q - 0.9) / 0.1), 2) * 0.03;
  }
  // 3단계: 들썩(준비) → 들어 올려 음식물 봉투 위로 → 기울여 쏟음 → 봉투를 묶어 수거함에 넣은 뒤 그 자리에 통통 내려놓음
  let hx = 0, hy = 0;
  if (bp > 0) {
    const up = easeInOut(clamp01((bp - 0.02) / 0.2));
    const away = easeInOut(clamp01((bp - 0.82) / 0.14));
    const drop = bp >= 0.82 ? bounceDrop(clamp01((bp - 0.82) / 0.16)) : 1;
    if (bp < 0.06) sq = 1 - Math.sin(Math.PI * bp / 0.06) * 0.05;
    k = lerp(lerp(1, HOLD[2], up), REST[1], away);
    hx = lerp(lerp(B1, HOLD[0], up), REST[0], away);
    const restY = GY - BASKET.h * KB * k / 2;
    hy = lerp(lerp(GY - BASKET.h * KB / 2, HOLD[1], up), restY - (restY - HOLD[1]) * drop, away);
    const pp = clamp01((bp - 0.26) / 0.32);
    rot = (pp > 0 && pp < 1 ? tiltCurve(pp) : 0) * 1.75 + wobble(clamp01((bp - 0.84) / 0.14), 2) * 0.05;
  }
  const bw = BASKET.w * KB * k, bh = BASKET.h * KB * k;
  const cx = bp > 0 ? hx : bx;
  const cy = bp > 0 ? hy : GY - bh / 2 * sq - lift;

  // ── 일반쓰레기 봉투 (2단계에 위에서 떨어짐) ──
  const bagDrop = bounceDrop(clamp01(pk / 0.2)) * 480;
  let landed = 0, jig = 0;
  JUNK.forEach(function (j, i) {
    landed += smooth(0.37, 0.41, pk - i * 0.15);
    jig += wobble(clamp01((pk - 0.4 - i * 0.15) / 0.12), 1);
  });
  const bagK = 1 - jig * 0.05;
  const bag = { img: img.bagG, full: landed / JUNK.length, tie: easeInOut(clamp01((pk - 0.86) / 0.14)), sx: 1 / Math.sqrt(bagK), sy: bagK };
  if (pk > 0) {
    shadow(ctx, BAG[0], BAG[1] * 1.1, 1 - smooth(0, 300, bagDrop));
    drawBag(ctx, BAG[0], GY - bagDrop, BAG[1], BAG[2], Object.assign({ part: "back" }, bag));
  }

  // ── 음식물 수거함 (3단계에 오른쪽에서 들어옴): 열린 뚜껑은 몸통 뒤, 닫힌 뚜껑은 몸통 앞 ──
  const binX = lerp(1150, BIN_X, 1 - Math.pow(1 - clamp01((bp - 0.04) / 0.18), 3));
  const nw = BIN.w * KN, nh = BIN.h * KN;
  const left = binX - nw / 2, top = GY - nh;
  const lidT = bp < 0.75 ? 1.85 * easeInOut(clamp01((bp - 0.56) / 0.1)) : 1.85 * bounceDrop(clamp01((bp - 0.84) / 0.09));
  const lidExt = Math.cos(lidT) - 3 * Math.sin(lidT); // 뚜껑 앞쪽이 보이는 높이 비율 (음수면 경첩 위로 세워짐)
  const binWob = wobble(clamp01((bp - 0.89) / 0.1), 2) * 0.025;
  if (bp > 0) {
    shadow(ctx, binX, nw * 1.1, 1);
    ctx.save();
    ctx.translate(binX, GY);
    ctx.rotate(binWob);
    ctx.translate(-binX, -GY);
    if (lidExt < 0) lidStanding(ctx, left, top, -lidExt);
    put(ctx, img.body, binX, GY, nw, nh);
    fitText(ctx, t("cat.food"), left + (BIN.label.x + BIN.label.w / 2) * KN, top + (BIN.label.y + BIN.label.h / 2) * KN, BIN.label.w * KN * 0.9, BIN.label.h * KN * 0.34, 800, "#2f6b3a");
    if (lidExt >= 0) {
      const hy2 = top + BIN.lid.hinge * KN;
      ctx.save();
      ctx.translate(0, hy2);
      ctx.scale(1, Math.max(lidExt, 0.02));
      ctx.translate(0, -hy2);
      ctx.drawImage(img.lid, left + BIN.lid.x * KN, top, BIN.lid.w * KN, BIN.lid.h * KN);
      ctx.restore();
    }
    ctx.restore();
  }

  // ── 노란 음식물 봉투: 위에서 떨어져 통통 → 음식이 담기면 출렁 → 묶음 → 포물선으로 수거함 안으로 ──
  const fDrop = bounceDrop(clamp01((bp - 0.06) / 0.2)) * 520;
  const fu = clamp01((bp - 0.68) / 0.14);              // 수거함으로 날아가는 정도
  const fe = easeInOut(fu);
  const fK = 1 - wobble(clamp01((bp - 0.45) / 0.12), 1) * 0.06;
  const fbag = { img: img.bagF, kind: "food", full: smooth(0.4, 0.5, bp), tie: easeInOut(clamp01((bp - 0.56) / 0.12)),
    sx: 1 / Math.sqrt(fK) * lerp(1, 0.72, fe), sy: fK * lerp(1, 0.72, fe), rot: fe * 0.5 };
  const fx = lerp(FBAG[0], binX, fe);
  const fy = lerp(GY - fDrop, top + 82 * KN + FBAG[1] * 0.8, fe) - Math.sin(Math.PI * Math.min(fe / 0.8, 1)) * 230;
  const showF = bp > 0.06 && fu < 1;
  if (showF) {
    shadow(ctx, FBAG[0], 230, (1 - smooth(0, 300, fDrop)) * (1 - smooth(0, 0.3, fu)));
    // 떨어지는 동안은 바구니 뒤로 지나가도록 통째로 먼저, 내려앉은 뒤에는 뒤판만 먼저(음식이 앞판 뒤로 들어가게)
    if (fu <= 0) drawBag(ctx, fx, fy, 0, FBAG[1], Object.assign({ part: fDrop > 1 ? "all" : "back" }, fbag));
  }

  // ── 바구니 그림자 + 바구니 ──
  shadow(ctx, cx, bw * 1.05, 1 - smooth(0, 160, GY - (cy + bh / 2)));
  const pourOut = smooth(0.36, 0.43, bp);   // 음식이 바구니에서 빠져나간 정도
  drawBasket(ctx, img, v, cx, cy, KB * k, rot, sq, pourOut);

  // 2단계: 일반쓰레기가 하나씩 들썩 → 포물선 → 봉투 속으로
  JUNK.forEach(function (j, i) {
    const u = clamp01((pk - 0.1 - i * 0.15) / 0.3);
    if (u <= 0 || u >= 1) return;
    const w0 = j.w * j.k * KB, h0 = j.h * j.k * KB;
    const sx = bx + (j.x - BASKET.w / 2) * KB, sy = GY - bh / 2 + (j.y - BASKET.h / 2) * KB;
    const tx = BAG[0], ty = GY - bagDrop - bagMouth(BAG[2]);
    const f = clamp01((u - 0.1) / 0.9), e = easeInOut(f);
    let x = lerp(sx, tx, e), y = lerp(sy, ty + h0 * 0.8, e) - Math.sin(Math.PI * Math.min(e / 0.85, 1)) * 170;
    if (u < 0.1) y -= Math.sin(Math.PI * u / 0.1) * 12;
    ctx.save();
    if (f > 0.5) {
      ctx.beginPath();
      ctx.rect(-500, -500, 2000, ty + 500);
      ctx.clip();
    }
    put(ctx, img[j.im], x, y, w0 * lerp(1, 0.85, e), h0 * lerp(1, 0.85, e), { py: 0.5, rot: j.rot + e * 3.2 });
    ctx.restore();
  });
  if (pk > 0) drawBag(ctx, BAG[0], GY - bagDrop, BAG[1], BAG[2], Object.assign({ part: "front" }, bag));

  // 3단계: 음식 더미가 기운 바구니에서 미끄러져 수거함 입구로 떨어짐 (입구 앞 테두리 아래는 가림)
  const fq = clamp01((bp - 0.36) / 0.1);
  if (fq > 0 && fq < 1) {
    const kk = KB * k;
    const lx = (MOUND.x + MOUND.w / 2 - BASKET.w / 2) * kk, ly = (MOUND.y + MOUND.h / 2 - BASKET.h / 2) * kk;
    const sx = cx + lx * Math.cos(rot) - ly * Math.sin(rot), sy = cy + lx * Math.sin(rot) + ly * Math.cos(rot);
    const mx = FBAG[0], my = GY - fDrop - bagMouth(FBAG[1]) - 10;
    const frontY = my + 14;
    ctx.save();
    ctx.beginPath();
    ctx.rect(-500, -500, 2000, frontY + 500);
    ctx.clip();
    for (let i = 0; i < 3; i++) {
      // 한 덩이로 떨어지지 않게 세 조각이 조금씩 늦게
      const g = clamp01(fq * 1.25 - i * 0.12);
      if (g <= 0 || g >= 1) continue;
      const x = lerp(sx, mx, g) + (i - 1) * 18, y = lerp(sy, my + 40, g * g);
      put(ctx, img.mound, x, y, MOUND.w * kk * 0.9, MOUND.h * kk * 0.9, { py: 0.5, rot: rot * (1 - g) + i * 0.4 * g, alpha: i ? 0.85 : 1 });
    }
    ctx.restore();
  }

  if (showF && (fDrop <= 1 || fu > 0)) {
    ctx.save();
    if (fu > 0.5) {
      ctx.beginPath();
      ctx.rect(-500, -500, 2000, top + 82 * KN + 500);
      ctx.clip();
    }
    drawBag(ctx, fx, fy, 0, FBAG[1], Object.assign({ part: fu > 0 ? "all" : "front" }, fbag));
    ctx.restore();
  }

  // 물기 빼는 물방울
  dropsDraw(ctx, s, GY);
  if (q > 0.15 && q < 0.8) {
    const kk = KB * k;
    dropsEmit(s, cx + Math.sin(q * 30) * 60 * kk, cy + (BASKET.h * 0.47) * kk, { spread: 200 * kk, vx: 0, vy: 30, every: 0.008 });
  }
}

// 바구니: 뒤쪽 → (음식·일반쓰레기·물) → 앞 테두리 순서로 그려 안에 든 것처럼 보이게 함
//   (cx, cy) 그림 가운데, kk 배율, rot 기울기, sq 눌림(아래 기준), out 음식이 빠져나간 정도
function drawBasket(ctx, img, v, cx, cy, kk, rot, sq, out) {
  const W = BASKET.w, H = BASKET.h;
  const level = v.water;   // 물 높이 (1 가득 → 0)
  ctx.save();
  ctx.translate(cx, cy + H * kk / 2);
  ctx.scale(1, sq);
  ctx.translate(0, -H * kk / 2);
  ctx.rotate(rot);
  ctx.scale(kk, kk);
  ctx.translate(-W / 2, -H / 2);
  ctx.drawImage(img.back, 0, 0, W, H);
  if (out < 1) {
    ctx.globalAlpha = 1 - out;
    ctx.drawImage(img.slots, SLOTS.x, SLOTS.y, SLOTS.w, SLOTS.h);
    ctx.drawImage(img.mound, MOUND.x, MOUND.y, MOUND.w, MOUND.h);
    ctx.globalAlpha = 1;
  }
  // 물: 바구니 안 수면 (내려갈수록 작아짐)
  if (level > 0.01) {
    const wy = lerp(212, 150, level), rx = lerp(95, 140, level), ry = rx * 0.5;
    ctx.save();
    ctx.globalAlpha = smooth(0, 0.15, level);
    const g = ctx.createLinearGradient(0, wy - ry, 0, wy + ry);
    g.addColorStop(0, "rgba(150,205,240,0.55)");
    g.addColorStop(1, "rgba(95,170,225,0.6)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(BASKET.rim.cx, wy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(BASKET.rim.cx, wy, rx * 0.92, ry * 0.88, 0, Math.PI * 1.1, Math.PI * 1.6);
    ctx.stroke();
    ctx.restore();
  }
  // 아직 골라내지 않은 일반쓰레기
  JUNK.forEach(function (j, i) {
    if (v.pick > 0.1 + i * 0.15) return;
    put(ctx, img[j.im], j.x, j.y, j.w * j.k, j.h * j.k, { py: 0.5, rot: j.rot });
  });
  ctx.drawImage(img.front, 0, 0, W, H);
  // 물이 찬 동안 앞쪽 벽도 물빛 (수면 아래만)
  if (level > 0.01) {
    const line = lerp(250, 185, level);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, line, W, H);
    ctx.clip();
    ctx.globalAlpha = smooth(0, 0.15, level) * 0.9;
    ctx.drawImage(img.wet, 0, 0, W, H);
    ctx.restore();
  }
  ctx.restore();
}

// 뒤로 젖혀 세운 뚜껑 (뒤판 쪽이 보임): 경첩 선에서 위로 선 주황 판
function lidStanding(ctx, left, top, ext) {
  const m = BIN.mouth;
  const x0 = left + (m[0][0] - 6) * KN, y0 = top + (m[0][1] - 4) * KN;
  const x1 = left + (m[1][0] + 8) * KN, y1 = top + (m[1][1] - 4) * KN;
  const hgt = (BIN.lid.h - BIN.lid.hinge) * KN * ext;
  ctx.save();
  ctx.lineJoin = "round";
  const g = ctx.createLinearGradient(0, y0 - hgt, 0, y0);
  g.addColorStop(0, "#f08a3c");
  g.addColorStop(1, "#c8581c");
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.lineTo(x1 + 6, y1 - hgt);
  ctx.lineTo(x0 - 6, y0 - hgt);
  ctx.closePath();
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = "#e9783a";
  ctx.lineWidth = 8;
  ctx.stroke();
  // 안쪽 오목한 면
  if (hgt > 30) {
    ctx.beginPath();
    ctx.moveTo(x0 + 22, y0 - 14);
    ctx.lineTo(x1 - 22, y1 - 14);
    ctx.lineTo(x1 - 18, y1 - hgt + 18);
    ctx.lineTo(x0 + 18, y0 - hgt + 18);
    ctx.closePath();
    ctx.fillStyle = "rgba(120,45,10,0.18)";
    ctx.fill();
  }
  ctx.restore();
}

// 효과음 (3D 장면과 같은 순간)
function sounds(v) {
  if (hit(v, "water", 0.15)) sfx.play("water", 1.69); // 흔드는 동안 물 빠지는 소리
  if (hit(v, "water", 0.92)) sfx.play("tap");         // 바구니를 내려놓을 때 톡
  if (hit(v, "pick", 0.4) || hit(v, "pick", 0.55) || hit(v, "pick", 0.7) || hit(v, "pick", 0.85)) sfx.play("slide"); // 일반쓰레기가 봉투에 하나씩 쏙
  if (hit(v, "pick", 0.87)) sfx.play("tie");         // 일반쓰레기 봉투 묶기
  if (hit(v, "bin", 0.12)) sfx.play("rustle", 0.25);  // 노란 봉투가 떨어질 때 바스락
  if (hit(v, "bin", 0.45)) sfx.play("thud");          // 음식물이 봉투에 툭
  if (hit(v, "bin", 0.57)) sfx.play("tie");           // 노란 봉투 묶기
  if (hit(v, "bin", 0.69)) sfx.play("whoosh");        // 봉투가 수거함으로 휙
  if (hit(v, "bin", 0.82)) sfx.play("thud");          // 수거함 안에 툭
  if (hit(v, "bin", 0.885)) sfx.play("lid");          // 뚜껑이 탁 닫힘
  if (hit(v, "bin", 0.915)) sfx.play("tap");          // 바구니를 내려놓을 때 톡
  if (hit(v, "bin", 0.97)) sfx.play("chime");         // 끝 띵동
}
