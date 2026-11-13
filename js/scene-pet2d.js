// 투명 페트병 장면 — 그림(2D) 시안
// 배출 순서: 서울시 안내(내용물 비우기 → 라벨 제거 → 압착 → 뚜껑 닫기 → 투명 페트병 전용 수거함)
// 그림: img/scene/pet/*.webp (실사풍 그림을 조각으로 나눈 것, 위치는 meta.json 값을 아래 숫자로 옮김)
// 단계 값은 3D 장면(scene-pet.js)과 같아 효과음 순간도 같게 맞춤
import { clamp01, smooth, easeInOut, backOut, lerp } from "./eco3d-util.js?v=20261114b";
import { sfx, hit } from "./eco3d-sound.js?v=20261108r";
import { put, shadow as shade, dropsEmit, dropsDraw, binLabel as label } from "./eco2d-util.js?v=20261108r";

const D = "img/scene/pet/";
// 그림 조각의 원래 크기와 그 안의 위치 (pet_assets.py가 잰 값)
const BOTTLE = { w: 155, h: 420, cap: { x: 38, y: 2, w: 75, h: 63 }, label: { y: 152, h: 101 } };
const CRUSHED = { w: 287, h: 300, cap: { x: 129, y: 2, w: 84, h: 67 } };
const BIN = { w: 362, h: 440, rim: 36, label: { x: 140, y: 139, w: 162, h: 87 } };
const CURL = { w: 205, h: 150 };

// 장면 배치 (설계 크기 820×760 기준, eco2d.js)
const GY = 700;            // 바닥선
const BX = 320;            // 병 자리(가운데)
const KB = 460 / BOTTLE.h; // 병 크기 배율 (병 높이 460)
const KC = 300 / CRUSHED.h;
const KN = 480 / BIN.h;
const BIN_X = 600;
const CAP_GROUND = [530, GY - 34];   // 뚜껑이 놓이는 바닥 자리
const CURL_GROUND = [115, GY - 60];  // 떼어 낸 라벨이 놓이는 자리

export default {
  kind: "2d",
  // 단계별 최종 모습 (cap 1 = 뚜껑 열림, liquid 1 = 음료 가득, label 1 = 라벨 떨어짐, crush 1 = 찌그러짐, bin 1 = 수거함에 넣음)
  states: [
    { cap: 0, liquid: 1, label: 0, crush: 0, bin: 0 },
    { cap: 1, liquid: 0, label: 0, crush: 0, bin: 0 },
    { cap: 1, liquid: 0, label: 1, crush: 0, bin: 0 },
    { cap: 1, liquid: 0, label: 1, crush: 1, bin: 0 },
    { cap: 0, liquid: 0, label: 1, crush: 1, bin: 0 },
    { cap: 0, liquid: 0, label: 1, crush: 1, bin: 1 }
  ],
  moves: [null, [["cap", 1.3], ["liquid", 2.4]], [["label", 1.6]], [["crush", 1.4]], [["cap", 1.1]], [["bin", 2.0]]],
  images: {
    full: D + "bottle-full.webp", empty: D + "bottle-empty.webp", bare: D + "bottle-bare.webp",
    cap: D + "cap.webp", band: D + "label-band.webp", curl: D + "label-curl.webp",
    crushed: D + "crushed.webp", crushedOpen: D + "crushed-open.webp", bin: D + "bin.webp"
  },
  draw: draw
};

// 바닥 그림자 (바닥선 GY 고정)
function shadow(ctx, x, w, a) { shade(ctx, x, GY, w, a); }

function draw(ctx, v, s) {
  const img = s.img;
  const bw = BOTTLE.w * KB, bh = BOTTLE.h * KB;
  const cw = CRUSHED.w * KC, ch = CRUSHED.h * KC;
  sounds(v);

  // ── 수거함 단계: 수거함이 오른쪽에서 들어오고, 병이 포물선으로 날아 들어감 ──
  const b = v.bin;
  const binIn = easeInOut(smooth(0, 0.3, b));
  const binX = lerp(1180, BIN_X, binIn);
  const nw = BIN.w * KN, nh = BIN.h * KN;
  const binBounce = b > 0.82 ? 1 - 0.05 * Math.sin(Math.PI * clamp01((b - 0.82) / 0.18)) : 1;

  // 바닥에 놓인 것: 떼어 낸 라벨(수거함이 들어올 때 사라짐)
  const curlA = smooth(0.62, 0.8, v.label) * (1 - smooth(0, 0.25, b));
  if (curlA > 0.01 && v.label >= 0.999) {
    shadow(ctx, CURL_GROUND[0], 150, curlA);
    put(ctx, img.curl, CURL_GROUND[0], GY, CURL.w * 0.82, CURL.h * 0.82, { alpha: curlA });
  }
  if (b > 0) {
    shadow(ctx, binX, nw * 1.05, binIn);
    put(ctx, img.bin, binX, GY, nw, nh, { sy: binBounce });
    binLabel(ctx, binX, nw, nh, binBounce);
  }

  // ── 병 ──
  ctx.save();
  let bx = BX, by = GY, rot = 0, scale = 1;
  if (b > 0.3) {
    // 포물선: 병 자리 → 수거함 입구 위 → 안으로
    const u = clamp01((b - 0.3) / 0.52);
    const top = GY - nh - 170;
    bx = lerp(BX, binX, easeInOut(u));
    const arc = 4 * u * (1 - u);
    by = lerp(GY, GY - nh * 0.35, u) - arc * (GY - top) * 0.75;
    rot = u * Math.PI * 1.2;
    scale = lerp(1, 0.8, u);
    if (u > 0.5) {
      // 입구 테두리 아래로 내려간 부분은 가려서 '들어가는' 모습
      const rim = GY - nh * binBounce + BIN.rim * KN;
      ctx.beginPath();
      ctx.rect(-500, -500, 2000, rim + 500);
      ctx.clip();
    }
    if (u >= 1) { ctx.restore(); return; }
  }
  shadow(ctx, BX, (v.crush > 0.5 ? cw : bw) * 1.15, 1 - smooth(0.3, 0.4, b));

  if (v.crush > 0) {
    drawCrush(ctx, img, v, bx, by, rot, scale, bw, bh, cw, ch);
  } else if (v.label > 0) {
    // 라벨 떼기: 병은 라벨 없는 모습, 라벨 띠가 위로 벗겨져 왼쪽 바닥으로 떨어짐
    put(ctx, img.bare, bx, by, bw, bh);
    const l = v.label;
    const lw = bw, lh = BOTTLE.label.h * KB;
    const ly = by - bh + (BOTTLE.label.y + BOTTLE.label.h) * KB;  // 라벨 아랫선
    const slide = easeInOut(smooth(0.05, 0.45, l));
    const fall = smooth(0.45, 0.8, l);
    const lx = lerp(bx, CURL_GROUND[0], fall);
    const lyy = lerp(ly - slide * 70, GY, fall * fall);
    const bandA = 1 - smooth(0.6, 0.75, l);
    put(ctx, img.band, lx, lyy, lw, lh, { rot: -0.5 * slide - 0.6 * fall, alpha: bandA, sx: 1 + 0.15 * slide });
    if (l < 0.999) put(ctx, img.curl, lx, lyy, CURL.w * 0.82, CURL.h * 0.82, { alpha: smooth(0.6, 0.78, l) });
    capOnGround(ctx, img, v);
  } else {
    drawPour(ctx, img, v, s, bx, by, bw, bh);
  }
  ctx.restore();
  // 쏟는 물방울
  dropsDraw(ctx, s, GY);
}

// 비우기: 뚜껑을 돌려 열어 바닥에 두고, 병을 들어 기울여 쏟음
function drawPour(ctx, img, v, s, bx, by, bw, bh) {
  const q = 1 - v.liquid;                                     // 쏟은 정도
  const tiltK = smooth(0, 0.25, q) * (1 - smooth(0.78, 1, q)); // 기울였다가 다시 세움
  const ang = -2.05 * tiltK;                                  // 왼쪽으로 약 117도
  const lift = 90 * tiltK;
  const cx = bx - 30 * tiltK, cy = by - bh / 2 - lift;        // 병 가운데(회전축)
  const emptyA = smooth(0.35, 0.72, q);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(ang);
  ctx.drawImage(img.full, -bw / 2, -bh / 2, bw, bh);
  if (emptyA > 0) { ctx.globalAlpha = emptyA; ctx.drawImage(img.empty, -bw / 2, -bh / 2, bw, bh); ctx.globalAlpha = 1; }
  ctx.restore();
  // 물방울: 병 입구에서 기울어진 방향으로
  if (q > 0.3 && q < 0.74) {
    // 병 입구 = 가운데에서 병 위쪽으로 bh/2 떨어진 점을 기운 각도만큼 돌린 자리
    dropsEmit(s, cx + Math.sin(ang) * (bh / 2), cy - Math.cos(ang) * (bh / 2), { vx: -25, vy: 55 });
  }
  // 뚜껑
  const c = v.cap;
  if (c < 1e-3) {
    put(ctx, img.cap, bx - bw / 2 + (BOTTLE.cap.x + BOTTLE.cap.w / 2) * KB, by - bh + BOTTLE.cap.y * KB, BOTTLE.cap.w * KB, BOTTLE.cap.h * KB, { py: 0 });
  } else {
    capOpen(ctx, img, c, bx, by, bw, bh);
  }
}

// 뚜껑 여는 움직임: 틱틱 돌리기(0~0.3) → 쏙 빠짐(0.3~0.45) → 포물선으로 오른쪽 바닥에 톡(0.45~1)
function capOpen(ctx, img, c, bx, by, bw, bh) {
  const w = BOTTLE.cap.w * KB, h = BOTTLE.cap.h * KB;
  const sx = bx - bw / 2 + (BOTTLE.cap.x + BOTTLE.cap.w / 2) * KB, sy = by - bh + BOTTLE.cap.y * KB + h;
  let x = sx, y = sy, rot = 0;
  if (c < 0.3) rot = Math.sin((c / 0.3) * Math.PI * 3) * 0.12;
  else if (c < 0.45) y = sy - 34 * easeInOut((c - 0.3) / 0.15);
  else {
    const u = (c - 0.45) / 0.55;
    x = lerp(sx, CAP_GROUND[0], u);
    y = lerp(sy - 34, CAP_GROUND[1] + h / 2, u) - 4 * u * (1 - u) * 120;
    rot = u * Math.PI * 2.2;
    if (u > 0.85) y -= Math.sin((u - 0.85) / 0.15 * Math.PI) * 10;
  }
  shadow(ctx, x, w * 1.2, smooth(0.6, 1, c));
  put(ctx, img.cap, x, y, w, h, { rot: rot, py: 1 });
}
function capOnGround(ctx, img, v) {
  const w = BOTTLE.cap.w * KB, h = BOTTLE.cap.h * KB;
  shadow(ctx, CAP_GROUND[0], w * 1.2, 1);
  put(ctx, img.cap, CAP_GROUND[0], CAP_GROUND[1] + h / 2, w, h, { rot: Math.PI * 2.2 });
}

// 찌그러뜨리기·뚜껑 닫기
function drawCrush(ctx, img, v, bx, by, rot, scale, bw, bh, cw, ch) {
  const c = v.crush;
  ctx.save();
  ctx.translate(bx, by);
  ctx.rotate(rot);
  ctx.scale(scale, scale);
  if (c < 0.55) {
    // 위에서 눌러 납작해짐 (빈 병을 눌러 줄이고 옆으로 퍼짐)
    const k = easeInOut(clamp01(c / 0.45));
    ctx.save();
    ctx.scale(1 + 0.18 * k, 1 - 0.36 * k);
    ctx.drawImage(img.bare, -bw / 2, -bh, bw, bh);
    ctx.restore();
  }
  const ca = smooth(0.45, 0.6, c);
  if (ca > 0) {
    const settle = c < 1 ? 1 + 0.06 * Math.sin(clamp01((c - 0.55) / 0.45) * Math.PI * 2) * (1 - c) : 1;
    ctx.globalAlpha = ca;
    const closed = v.cap < 0.02;
    ctx.save();
    ctx.scale(1, settle);
    ctx.drawImage(closed ? img.crushed : img.crushedOpen, -cw / 2, -ch, cw, ch);
    ctx.restore();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  if (v.cap >= 0.02 && c >= 1 && rot === 0) capClose(ctx, img, v, bx, by, cw, ch);
  else if (v.cap >= 0.98 && c < 1) capOnGround(ctx, img, v);
}
// 뚜껑 닫기: 바닥의 뚜껑이 포물선으로 날아와 찌그러진 병 입구에 얹히고 틱틱 돌려 잠김
function capClose(ctx, img, v, bx, by, cw, ch) {
  const u = 1 - v.cap;   // 0 → 1
  const w = BOTTLE.cap.w * KB * 1.06, h = BOTTLE.cap.h * KB * 1.06;
  const tx = bx - cw / 2 + (CRUSHED.cap.x + CRUSHED.cap.w / 2) * KC, ty = by - ch + (CRUSHED.cap.y + CRUSHED.cap.h) * KC;
  let x = tx, y = ty, rot = 0;
  if (u < 0.6) {
    const k = easeInOut(u / 0.6);
    x = lerp(CAP_GROUND[0], tx, k);
    y = lerp(CAP_GROUND[1] + h / 2, ty, k) - 4 * k * (1 - k) * 110;
    rot = (1 - k) * Math.PI * 2.2;
    shadow(ctx, x, w * 1.2, 1 - k);
  } else rot = Math.sin(((u - 0.6) / 0.4) * Math.PI * 3) * 0.1;
  put(ctx, img.cap, x, y, w, h, { rot: rot });
}

// 수거함 앞 이름표: 사이트 언어로 '투명 페트병' + ♻ (그림에는 글자를 넣지 않고 여기서 씀)
function binLabel(ctx, x, nw, nh, sy) {
  label(ctx, "item.pet", x - nw / 2 + BIN.label.x * KN, GY - nh * sy + BIN.label.y * KN * sy, BIN.label.w * KN, BIN.label.h * KN * sy);
}

// 효과음 (3D 장면과 같은 순간)
function sounds(v) {
  if (v.crush < 0.5) {
    if (hit(v, "cap", 0.08) || hit(v, "cap", 0.18) || hit(v, "cap", 0.28)) sfx.play("tick"); // 돌려 여는 틱틱
    if (hit(v, "cap", 0.4)) sfx.play("pop");                                                  // 빠질 때 퐁
    if (hit(v, "cap", 0.9)) sfx.play("tap");                                                  // 바닥에 톡
  } else {
    if (hit(v, "cap", 0.68) || hit(v, "cap", 0.8) || hit(v, "cap", 0.9)) sfx.play("tick");   // 돌려 닫는 틱틱
    if (hit(v, "cap", 0.98)) sfx.play("click");                                               // 다 잠기면 딸깍
  }
  if (hit(v, "liquid", 0.36)) sfx.play("pour", 0.86);
  if (hit(v, "label", 0.05)) sfx.play("peel");
  if (hit(v, "crush", 0.15)) sfx.play("crunch", 0.8);
  if (hit(v, "bin", 0.4)) sfx.play("whoosh");
  if (hit(v, "bin", 0.82)) sfx.play("thud");
  if (hit(v, "bin", 0.95)) sfx.play("chime");
}
