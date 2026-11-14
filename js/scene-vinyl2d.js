// 비닐 장면 — 그림(2D)
// 서울시·서대문구 폐비닐 안내: 내용물 비우기 → 음식물이 묻었다면 헹구기 → 따로 모아 투명 봉투에 담아 배출
// 그림: img/scene/vinyl/*.webp (vinyl_assets.py가 실사풍 그림을 조각으로 나눔, 위치 값은 meta.json을 아래 숫자로 옮김)
//       수도꼭지는 공용 img/scene/common/faucet.webp (그림에 붙은 물줄기는 가리고 여기서 물줄기를 그림)
// 단계 값은 3D 장면(scene-vinyl.js)과 같아 효과음 순간도 같게 맞춤
import { clamp01, smooth, easeInOut, backOut, lerp, wobble, seeded } from "./eco3d-util.js?v=20261114b";
import { sfx, hit } from "./eco3d-sound.js?v=20261108r";
import { put, shadow as shade, dropsEmit, dropsDraw } from "./eco2d-util.js?v=20261114f";

const D = "img/scene/vinyl/";
// 그림 조각의 원래 크기와 그 안의 위치 (vinyl_assets.py가 잰 값)
const SNACK = { w: 375, h: 420, cut: 38 };                                  // 과자 봉지(cut 위 = 잘라 낼 톱니 띠)
const SACK = { w: 395, h: 430, knot: 99, mouth: 134, mouthX: [98, 296] };   // 투명 봉투(knot 위 = 매듭, mouth 아래 = 몸통)
const FAUCET = { w: 246, h: 300, spout: [23, 104], cut: 37 };               // 수도꼭지(spout = 물 나오는 끝, cut 왼쪽 아래 = 그림의 물줄기)

// 장면 배치 (설계 크기 820×760 기준, eco2d.js)
const GY = 700;                      // 바닥선
const BX = 260;                      // 과자 봉지 자리
const BODY_H = SNACK.h - SNACK.cut;  // 띠를 자른 봉지 몸통 높이
const SACK_X = 595;                  // 투명 봉투 자리
const STRIP_GROUND = [650, GY];      // 잘라 낸 톱니 띠가 놓이는 자리
const KF = 0.85;                     // 수도꼭지 배율
const SPOUT = [BX, 150];             // 수도꼭지 물 나오는 끝 자리(봉지 입구 바로 위)
const CRUMB = "rgba(226,170,72,0.95)";

// 부스러기 더미(바닥에 쌓인 모양): 매번 같은 모양이 되도록 미리 정해 둠
const PILE = (function () {
  const r = seeded(11), out = [];
  for (let i = 0; i < 48; i++) {
    const a = r() * 2 - 1;
    out.push({ x: a * 110 * (0.4 + 0.6 * r()), y: -r() * 18 * (1 - Math.abs(a)), w: 5 + r() * 8, h: 3.5 + r() * 4.5, rot: r() * 3, c: r() });
  }
  return out;
})();

// 헹군 뒤 봉지에 맺힌 물방울 (봉지 가운데 기준 자리)
const BEADS = (function () {
  const r = seeded(5), out = [];
  for (let i = 0; i < 16; i++) out.push({ x: (r() * 2 - 1) * 150, y: (r() * 2 - 1) * 160, r: 3.5 + r() * 5 });
  return out;
})();
const PUDDLE = [118, GY]; // 헹군 물을 쏟은 자리(물웅덩이)

export default {
  kind: "2d",
  // empty 1 = 부스러기를 털어 냄, rinse 1 = 물로 헹굼, bag 1 = 투명 봉투에 모아 묶음
  states: [
    { empty: 0, rinse: 0, bag: 0 },
    { empty: 1, rinse: 0, bag: 0 },
    { empty: 1, rinse: 1, bag: 0 },
    { empty: 1, rinse: 1, bag: 1 }
  ],
  moves: [null, [["empty", 2.4]], [["rinse", 3.6]], [["bag", 2.6]]],
  images: {
    body: D + "snack-body.webp", top: D + "snack-top.webp",
    sackBody: D + "sack-body.webp", sackTop: D + "sack-top.webp",
    faucet: "img/scene/common/faucet.webp"
  },
  draw: draw
};

// 바닥 그림자 (바닥선 GY 고정)
function shadow(ctx, x, w, a) { shade(ctx, x, GY, w, a); }

function draw(ctx, v, s) {
  const img = s.img;
  sounds(v);
  const b = v.bag;
  const floorA = 1 - smooth(0, 0.2, b); // 투명 봉투 단계가 시작되면 바닥의 띠·부스러기는 치움

  // ── 바닥: 잘라 낸 톱니 띠, 털어 낸 부스러기 더미 ──
  if (v.empty >= 0.16 && floorA > 0.01) { // 뜯어 낸 띠가 바닥에 떨어진 뒤부터
    shadow(ctx, STRIP_GROUND[0], 200, floorA * 0.6);
    put(ctx, img.top, STRIP_GROUND[0], STRIP_GROUND[1], SNACK.w * 0.55, (SNACK.cut + 2) * 0.55, { rot: 0.08, alpha: floorA });
  }
  const pileA = smooth(0.4, 0.75, (v.empty - 0.16) / 0.84) * floorA;

  // ── 수도꼭지(헹구기 단계에만) ──
  faucet(ctx, img, s, v.rinse);

  // ── 투명 봉투 단계 ──
  if (b > 0) {
    drawSack(ctx, img, s, v);
    puddle(ctx, floorA);
    crumbPile(ctx, pileA);
    return;
  }

  // ── 과자 봉지 ──
  if (v.rinse > 0) drawRinse(ctx, img, s, v.rinse);
  else drawEmpty(ctx, img, s, v.empty);
  // 부스러기 더미·물웅덩이는 봉지 발치 앞쪽 바닥에 (봉지에 가리지 않게 봉지 다음에 그림)
  puddle(ctx, smooth(0.62, 0.8, v.rinse));
  crumbPile(ctx, pileA);
  // 털어 낸 부스러기 / 쏟는 물
  dropsDraw(ctx, s, GY, v.rinse > 0 ? undefined : CRUMB);
}

// 봉지 몸통을 가운데(cx, cy) 기준으로 돌려 그림 (띠를 자른 뒤)
// wet: 헹군 물방울이 맺힌 정도(0~1)
function bagAt(ctx, img, cx, cy, ang, wet) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(ang);
  ctx.drawImage(img.body, -SNACK.w / 2, -BODY_H / 2, SNACK.w, BODY_H);
  beads(ctx, wet);
  ctx.restore();
}
// 봉지 겉의 물방울 (봉지 가운데 기준 좌표계에서 그림)
function beads(ctx, wet) {
  const n = Math.round(BEADS.length * (wet || 0));
  for (let i = 0; i < n; i++) {
    const d = BEADS[i];
    ctx.fillStyle = "rgba(205,232,250,0.55)";
    ctx.strokeStyle = "rgba(255,255,255,0.75)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(d.x, d.y, d.r * 0.85, d.r, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.beginPath();
    ctx.arc(d.x - d.r * 0.3, d.y - d.r * 0.35, d.r * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
}
// 헹군 물을 쏟은 바닥의 물웅덩이 (a: 보이는 정도)
function puddle(ctx, a) {
  if (a <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = "rgba(120,190,235,0.55)";
  ctx.beginPath();
  ctx.ellipse(PUDDLE[0], PUDDLE[1] - 2, 95 * (0.6 + 0.4 * a), 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.beginPath();
  ctx.ellipse(PUDDLE[0] - 25, PUDDLE[1] - 5, 30, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
// 봉지 입구 자리: 가운데에서 봉지 위쪽으로 BODY_H/2 떨어진 점을 기운 각도만큼 돌린 자리
function mouthOf(cx, cy, ang) {
  return [cx + Math.sin(ang) * (BODY_H / 2), cy - Math.cos(ang) * (BODY_H / 2)];
}

// 1단계 비우기: 위쪽 톱니 띠를 뜯어 내고(0~0.16) → 봉지를 들어 거꾸로 뒤집어 탈탈 털고 → 다시 세워 내려놓음
function drawEmpty(ctx, img, s, e) {
  const tear = clamp01(e / 0.16);
  const u = clamp01((e - 0.16) / 0.84);
  // 뒤집기: 먼저 들어 올린 뒤(모서리가 바닥에 닿지 않게) 오른쪽으로 반 바퀴, 털고 나서 되돌려 세움
  const lift = 140 * smooth(0, 0.1, u) * (1 - smooth(0.9, 1, u));
  const flip = easeInOut(smooth(0.04, 0.2, u)) - easeInOut(smooth(0.72, 0.9, u));
  const hold = smooth(0.2, 0.24, u) * (1 - smooth(0.64, 0.7, u));
  const shake = Math.sin(u * 95) * hold;
  const ang = Math.PI * flip + shake * 0.07;
  const cx = BX + 70 * smooth(0, 0.1, u) * (1 - smooth(0.9, 1, u)) + shake * 10;
  const cy = GY - BODY_H / 2 - lift - Math.abs(shake) * 6;
  shadow(ctx, cx, SNACK.w * lerp(1.1, 0.8, smooth(0, 0.1, u) * (1 - smooth(0.9, 1, u))), 1);
  bagAt(ctx, img, cx, cy, ang);
  // 부스러기: 거꾸로 든 동안 입구에서 쏟아짐
  if (u > 0.22 && u < 0.66) {
    const m = mouthOf(cx, cy, ang);
    dropsEmit(s, m[0], m[1] - 4, { spread: 230, vx: 0, vy: 30, r: 2.6, every: 0.006 });
  }
  // 톱니 띠: 살짝 들썩이다 뜯겨 포물선으로 오른쪽 바닥에 떨어짐
  if (tear < 1) {
    const top = GY - BODY_H;
    let x = BX, y = top + 2, rot = 0, k = 1;
    if (tear < 0.35) { rot = Math.sin(tear / 0.35 * Math.PI * 3) * 0.03; y -= 6 * (tear / 0.35); }
    else {
      const q = (tear - 0.35) / 0.65;
      x = lerp(BX, STRIP_GROUND[0], q);
      y = lerp(top - 6, STRIP_GROUND[1], q) - 4 * q * (1 - q) * 160;
      rot = q * (Math.PI * 2 + 0.08);
      k = lerp(1, 0.55, q);
    }
    put(ctx, img.top, x, y, SNACK.w * k, (SNACK.cut + 2) * k, { rot: rot });
  }
}

// 2단계 헹구기: 수도꼭지 물을 봉지 입구로 받고(0.12~0.42) → 출렁출렁 흔들어 → 들어서 왼쪽으로 기울여 물을 쏟고 다시 세움
function drawRinse(ctx, img, s, r) {
  const fill = smooth(0.14, 0.42, r);
  const swish = Math.sin(clamp01((r - 0.44) / 0.1) * Math.PI * 4) * (r > 0.44 && r < 0.54 ? 1 : 0);
  const rq = clamp01((r - 0.55) / 0.45);
  const lift = 120 * smooth(0, 0.15, rq) * (1 - smooth(0.85, 1, rq));
  const tilt = easeInOut(smooth(0.1, 0.3, rq)) * (1 - easeInOut(smooth(0.7, 0.88, rq)));
  const ang = -1.95 * tilt + swish * 0.06;
  const cx = BX + 60 * smooth(0, 0.15, rq) * (1 - smooth(0.85, 1, rq));
  const cy = GY - BODY_H / 2 - lift;
  // 물이 차면 아래쪽이 조금 불룩해짐 (쏟으면 돌아옴)
  const full = fill * (1 - smooth(0.36, 0.72, rq));
  shadow(ctx, cx, SNACK.w * lerp(1.1, 0.85, smooth(0, 0.15, rq) * (1 - smooth(0.85, 1, rq))), 1);
  ctx.save();
  // 바닥 기준으로 늘였다 줄이기 위해 바닥선에서 키움
  if (lift < 0.5) {
    ctx.translate(cx, GY);
    ctx.scale(1 + 0.04 * full, 1 - 0.02 * full);
    ctx.translate(-cx, -GY);
  }
  bagAt(ctx, img, cx, cy, ang, smooth(0.2, 0.5, r)); // 물을 받는 동안 겉에도 물방울이 맺힘 (헹군 표시로 남음)
  ctx.restore();
  // 입구 안쪽 물(봉지가 서 있는 동안 위로 살짝 보이는 물빛)
  if (full > 0.02 && tilt < 0.05) {
    const m = mouthOf(cx, cy, ang);
    ctx.save();
    ctx.globalAlpha = full * 0.8;
    const g = ctx.createLinearGradient(m[0] - 160, 0, m[0] + 160, 0);
    g.addColorStop(0, "rgba(150,205,240,0.2)");
    g.addColorStop(0.5, "rgba(190,228,250,0.9)");
    g.addColorStop(1, "rgba(150,205,240,0.2)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(m[0], m[1] + 4, 160, 9 + swish * 3, swish * 0.04, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // 쏟는 물방울: 기운 입구에서
  if (rq > 0.36 && rq < 0.72) {
    const m = mouthOf(cx, cy, ang);
    dropsEmit(s, m[0], m[1], { spread: 60, vx: -40, vy: 40, r: 4, every: 0.012 });
  }
}

// 수도꼭지: 위에서 살짝 내려오며 나타나 물을 틀고(0.12~0.42), 다 쓰면 위로 사라짐
function faucet(ctx, img, s, r) {
  if (r <= 0 || r >= 1) return;
  const a = smooth(0, 0.1, r) * (1 - smooth(0.5, 0.6, r));
  if (a <= 0.01) return;
  const dy = -30 * (1 - smooth(0, 0.1, r)) - 30 * smooth(0.5, 0.6, r); // 휴대폰에서 위가 잘리지 않을 만큼만 움직임
  const left = SPOUT[0] - FAUCET.spout[0] * KF, top = SPOUT[1] - FAUCET.spout[1] * KF + dy;
  const cy = FAUCET.spout[1] + 2, cx = FAUCET.cut;
  ctx.save();
  ctx.globalAlpha = a;
  // 그림에 붙은 물줄기(왼쪽 아래)는 빼고 그림
  ctx.drawImage(img.faucet, 0, 0, FAUCET.w, cy, left, top, FAUCET.w * KF, cy * KF);
  ctx.drawImage(img.faucet, cx, cy, FAUCET.w - cx, FAUCET.h - cy, left + cx * KF, top + cy * KF, (FAUCET.w - cx) * KF, (FAUCET.h - cy) * KF);
  ctx.restore();
  // 물줄기: 틀면 위에서 아래로 뻗고, 잠그면 끝이 떨어져 내려감
  const on = smooth(0.12, 0.16, r), off = smooth(0.42, 0.46, r);
  if (on > 0 && off < 1) {
    const y0 = SPOUT[1] + dy, y1 = GY - BODY_H + 6;
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

// 바닥의 부스러기 더미 (a: 보이는 정도 0~1, 점점 쌓임)
function crumbPile(ctx, a) {
  if (a <= 0.01) return;
  ctx.save();
  const n = Math.round(PILE.length * a);
  for (let i = 0; i < n; i++) {
    const p = PILE[i];
    ctx.fillStyle = p.c > 0.5 ? "#e6b25a" : p.c > 0.2 ? "#f2cd7a" : "#c98f3e";
    ctx.beginPath();
    ctx.ellipse(BX + 70 + p.x, GY - 3 + p.y, p.w, p.h, p.rot, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// 3단계: 봉지가 움츠렸다 뛰어오르며 구겨지고 → 오른쪽에 투명 봉투가 통통 나타남 → 열린 입구로 쏙
// → 봉투가 출렁이고 입구를 모아 묶음(매듭이 톡)
function drawSack(ctx, img, s, v) {
  const b = v.bag;
  const pop = backOut(clamp01((b - 0.22) / 0.2));
  const land = clamp01((b - 0.65) / 0.3);
  const sy = Math.max(pop, 0.001) * (1 - wobble(land, 2) * 0.05);
  const sx = Math.max(pop, 0.001) * (1 + wobble(land, 2) * 0.03);
  const bodyH = SACK.h - SACK.mouth;
  const mouthY = GY - bodyH * sy;            // 몸통 윗선(열린 입구)
  const mx = SACK_X - SACK.w / 2 + (SACK.mouthX[0] + SACK.mouthX[1]) / 2;
  const mw = (SACK.mouthX[1] - SACK.mouthX[0]) * sx;
  const cinch = easeInOut(clamp01((b - 0.7) / 0.15));
  const knot = backOut(clamp01((b - 0.82) / 0.16));

  // 투명 봉투 몸통 (먼저 모아 둔 비닐이 들어 있음)
  if (b > 0.22) {
    shadow(ctx, SACK_X, SACK.w * 1.05 * pop, pop);
    put(ctx, img.sackBody, SACK_X, GY, SACK.w * sx, bodyH * sy);
    // 열린 입구: 반투명 타원 테두리 + 위로 벌어진 비닐 자락 (묶을수록 오므라듦)
    const open = 1 - cinch;
    if (open > 0.01) {
      ctx.save();
      ctx.globalAlpha = open * Math.min(1, pop);
      const rx = mw / 2 * lerp(1.12, 0.3, cinch), ry = 16 * sy;
      ctx.fillStyle = "rgba(225,236,232,0.35)";
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.lineWidth = 3;
      // 비닐 자락 두 장
      [-1, 1].forEach(function (sd) {
        ctx.beginPath();
        ctx.moveTo(mx + sd * rx, mouthY);
        ctx.quadraticCurveTo(mx + sd * (rx + 22), mouthY - 40 * sy, mx + sd * (rx - 10), mouthY - 62 * sy);
        ctx.quadraticCurveTo(mx + sd * rx * 0.4, mouthY - 30 * sy, mx, mouthY - ry);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      });
      ctx.beginPath();
      ctx.ellipse(mx, mouthY, rx, ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(205,222,216,0.45)";
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    // 묶기: 목이 위로 모이고(cinch), 매듭이 톡 생김(knot)
    const neckH = SACK.mouth - SACK.knot;
    if (cinch > 0.01) {
      ctx.drawImage(img.sackTop, 0, SACK.knot, SACK.w, neckH, SACK_X - SACK.w * sx / 2, mouthY - neckH * cinch, SACK.w * sx, neckH * cinch + 1);
    }
    if (knot > 0.01) {
      const ky = mouthY - neckH * cinch + 2;
      ctx.save();
      ctx.translate(mx, ky);
      ctx.scale(knot, knot);
      ctx.drawImage(img.sackTop, 0, 0, SACK.w, SACK.knot, -SACK.w / 2 - (mx - SACK_X), -SACK.knot, SACK.w, SACK.knot);
      ctx.restore();
    }
  }

  // 과자 봉지: 움츠렸다(0~0.12) 뛰어올라 구겨지며 작아지고, 포물선으로 투명 봉투 입구에 쏙(0.1~0.65)
  const j = clamp01((b - 0.1) / 0.55);
  if (j >= 1) return;
  const crouch = b < 0.12 ? Math.sin(Math.PI * b / 0.12) : 0;
  const crumple = lerp(1, 0.36, smooth(0.05, 0.45, j));
  const x = lerp(BX, mx, easeInOut(j));
  const h = BODY_H * crumple;
  const yb = lerp(GY, mouthY + 160, j) - 4 * j * (1 - j) * 360; // 봉지 아랫선 (끝에는 입구 아래로 다 들어감)
  const w = SNACK.w * crumple * lerp(1, 0.78, smooth(0.05, 0.45, j));
  shadow(ctx, BX, SNACK.w * 1.1 * (1 - smooth(0, 0.25, j)), 1 - smooth(0, 0.25, j));
  ctx.save();
  if (j > 0.55) {
    // 입구 아래로 내려간 부분은 가려서 '들어가는' 모습
    ctx.beginPath();
    ctx.rect(-500, -500, 2000, mouthY + 500);
    ctx.clip();
  }
  const rot = j * Math.PI * 0.9 + Math.sin(j * 20) * 0.08 * smooth(0.05, 0.3, j);
  ctx.translate(x, yb - h / 2);
  ctx.rotate(rot);
  ctx.scale(1 + crouch * 0.06, 1 - crouch * 0.12);
  ctx.translate(0, crouch * h * 0.06);
  ctx.scale(w / SNACK.w, h / BODY_H);
  ctx.drawImage(img.body, -SNACK.w / 2, -BODY_H / 2, SNACK.w, BODY_H);
  beads(ctx, 1 - smooth(0.05, 0.3, j)); // 헹군 물방울은 구겨지며 사라짐
  ctx.restore();
}

// 효과음 (3D 장면과 같은 순간)
function sounds(v) {
  if (hit(v, "empty", 0.32)) sfx.play("rustle", 0.96); // 거꾸로 들고 탈탈 터는 바스락
  if (hit(v, "rinse", 0.12)) sfx.play("water", 1.08);  // 수도꼭지 물줄기
  if (hit(v, "rinse", 0.71)) sfx.play("pour", 0.58);   // 헹군 물 쏟기
  if (hit(v, "bag", 0.13)) sfx.play("rustle", 0.5);    // 뛰어오르며 구겨지는 바스락
  if (hit(v, "bag", 0.62)) sfx.play("slide");          // 투명 봉투에 쏙
  if (hit(v, "bag", 0.72)) sfx.play("tie");            // 입구 묶기 슥슥
  if (hit(v, "bag", 0.95)) sfx.play("chime");          // 끝 띵동
}
