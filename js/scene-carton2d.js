// 종이팩 장면 — 그림(2D)
// 배출 순서(기후에너지환경부 등): 내용물 비우기 → 물로 헹구기 → 펼쳐서 납작하게 → 종이팩 수거함에 따로
// 그림: img/scene/carton/*.webp (carton_assets.py가 만듦, 위치는 meta.json 값을 아래 숫자로 옮김), 수도꼭지는 공용 그림
// 단계 값은 3D 장면(scene-carton.js)과 같아 효과음 순간도 같게 맞춤
import { clamp01, smooth, easeInOut, backOut, lerp, tiltCurve, wobble } from "./eco3d-util.js?v=20261114b";
import { sfx, hit } from "./eco3d-sound.js?v=20261108r";
import { put, shadow as shade, dropsEmit, dropsDraw, binLabel as label } from "./eco2d-util.js?v=20261114f";

const D = "img/scene/carton/";
// 그림 조각의 원래 크기와 그 안의 위치
const CARTON = { w: 181, h: 337, mouth: { x: 40, y: 6 } };       // mouth: 지붕 꼭대기 왼쪽 끝(쏟는 자리)
const FLAT = { w: 368, h: 340 };
const BIN = { w: 361, h: 440, lip: 72, label: { x: 139, y: 140, w: 161, h: 86 } }; // lip: 입구 앞쪽 테두리 윗선
const FAUCET = { w: 246, h: 300, spout: { x: 22, y: 104 } };      // 수도꼭지 물 나오는 자리

// 장면 배치 (설계 크기 820×760 기준, eco2d.js)
const GY = 700;              // 바닥선
const CX = 260;              // 종이팩 자리(가운데)
const KC = 380 / CARTON.h;   // 종이팩 높이 380
const KL = 300 / FLAT.h;     // 펼친 종이팩 높이 300 (들어오는 수거함과 겹치지 않게)
const KN = 440 / BIN.h;      // 수거함 높이 440 (펼친 팩이 날아 들어갈 높이를 남김)
const KF = 2.1;            // 수도꼭지 배율 (꼭지 끝이 종이팩 지붕 바로 위에 오도록)
const BIN_X = 625;
const FX = CX + 8 + (FAUCET.w / 2 - FAUCET.spout.x) * KF; // 꼭지 끝이 종이팩 가운데보다 살짝 오른쪽(입구 쪽) 위에 오는 수도꼭지 자리
const MILK = "rgba(255,255,255,0.96)", WATER = "rgba(150,205,240,0.8)";

export default {
  kind: "2d",
  // empty 1 = 우유를 비움, rinse 1 = 물로 헹굼, flat 1 = 펼쳐 납작하게, bin 1 = 종이팩 수거함에 넣음
  states: [
    { empty: 0, rinse: 0, flat: 0, bin: 0 },
    { empty: 1, rinse: 0, flat: 0, bin: 0 },
    { empty: 1, rinse: 1, flat: 0, bin: 0 },
    { empty: 1, rinse: 1, flat: 1, bin: 0 },
    { empty: 1, rinse: 1, flat: 1, bin: 1 }
  ],
  moves: [null, [["empty", 2.2]], [["rinse", 3.6]], [["flat", 1.8]], [["bin", 1.8]]],
  images: { carton: D + "carton.webp", flat: D + "flat.webp", bin: D + "bin.webp?v=20261114d", faucet: "img/scene/common/faucet.webp" },
  draw: draw
};

function shadow(ctx, x, w, a) { shade(ctx, x, GY, w, a); }

function draw(ctx, v, s) {
  const img = s.img;
  sounds(v);
  const cw = CARTON.w * KC, ch = CARTON.h * KC;
  const fw = FLAT.w * KL, fh = FLAT.h * KL;

  // ── 헹구기 단계의 수도꼭지 (종이팩 뒤에 그림) ──
  const r = v.$key === "rinse" ? v.$p : 0;
  if (r > 0) drawFaucet(ctx, img, s, r, ch);

  // ── 수거함 단계: 수거함이 오른쪽에서 들어오고, 펼친 종이팩이 포물선으로 날아 들어감 ──
  const b = v.bin;
  const binIn = easeInOut(smooth(0, 0.3, b));
  const binX = lerp(1180, BIN_X, binIn);
  const nw = BIN.w * KN, nh = BIN.h * KN;
  const land = clamp01((b - 0.78) / 0.22);
  const binSy = 1 - wobble(land, 2) * 0.05;
  if (b > 0) {
    shadow(ctx, binX, nw * 1.05, binIn);
    put(ctx, img.bin, binX, GY, nw, nh, { sy: binSy });
    label(ctx, "item.carton", binX - nw / 2 + BIN.label.x * KN, GY - nh * binSy + BIN.label.y * KN * binSy, BIN.label.w * KN, BIN.label.h * KN * binSy);
  }

  if (v.flat > 0) {
    drawFlat(ctx, img, v, b, binX, nh, binSy, cw, ch, fw, fh);
  } else {
    // ── 비우기·헹군 물 쏟기: 들어서 왼쪽으로 기울여 쏟고 다시 세움 ──
    const pour = v.$key === "empty" ? v.$p : 0;
    const rq = clamp01((r - 0.55) / 0.45);
    const tp = pour > 0 ? tiltCurve(pour) : rq > 0 ? tiltCurve(rq) : 0;
    // 헹굴 때 물을 받는 동안 좌우로 살랑 흔들어 안쪽을 씻음
    const swish = r > 0.22 && r < 0.46 ? Math.sin((r - 0.22) / 0.24 * Math.PI * 4) * 0.06 * Math.sin((r - 0.22) / 0.24 * Math.PI) : 0;
    const ang = -2.0 * tp;
    const lift = 90 * Math.max(tp, 0);
    const px = CX - 30 * tp, py = GY - ch / 2 - lift;   // 회전축(종이팩 가운데)
    shadow(ctx, CX, cw * 1.25, 1 - 0.4 * Math.max(tp, 0));
    ctx.save();
    if (swish) { ctx.translate(CX, GY); ctx.rotate(swish); ctx.translate(-CX, -GY); }
    ctx.translate(px, py);
    ctx.rotate(ang);
    ctx.drawImage(img.carton, -cw / 2, -ch / 2, cw, ch);
    ctx.restore();
    // 쏟는 자리 = 지붕 꼭대기 왼쪽 끝을 기운 각도만큼 돌린 자리
    const mx = -cw / 2 + CARTON.mouth.x * KC, my = -ch / 2 + CARTON.mouth.y * KC;
    const ox = px + mx * Math.cos(ang) - my * Math.sin(ang), oy = py + mx * Math.sin(ang) + my * Math.cos(ang);
    if (pour > 0.36 && pour < 0.72) milkEmit(s, ox, oy);
    if (rq > 0.36 && rq < 0.72) dropsEmit(s, ox, oy, { vx: -30, vy: 60, spread: 10 });
  }
  dropsDraw(ctx, s, GY, WATER);
  milkDraw(ctx, s);
}

// 수도꼭지: 오른쪽에서 들어옴(0~0.12) → 물이 나와 종이팩 지붕 위로 떨어짐(0.12~0.42) → 잠그고 나감(0.45~0.55)
function drawFaucet(ctx, img, s, r, ch) {
  const inK = easeInOut(smooth(0, 0.12, r)), outK = easeInOut(smooth(0.45, 0.55, r));
  if (outK >= 1) return;
  const x = FX + (1 - inK) * 600 + outK * 600;
  const w = FAUCET.w * KF, h = FAUCET.h * KF;
  const left = x - w / 2, top = GY - h;
  shadow(ctx, x + 40 * KF, 120 * KF, inK * (1 - outK));
  // 그림에 들어 있는 물줄기는 가려 두고(꼭지 아래 왼쪽 칸), 물줄기는 아래에서 따로 그림
  ctx.save();
  ctx.beginPath();
  ctx.rect(left + 60 * KF, -100, 2000, 2000);
  ctx.rect(left - 400, -100, 400 + 60 * KF, top + (FAUCET.spout.y + 2) * KF + 100);
  ctx.clip();
  ctx.drawImage(img.faucet, left, top, w, h);
  ctx.restore();
  // 물줄기: 위에서부터 내려와 지붕에 닿고, 잠그면 위쪽부터 끊겨 떨어짐
  const sx = left + FAUCET.spout.x * KF, sy = top + FAUCET.spout.y * KF;
  const bottom = GY - ch + 6;
  const on = smooth(0.12, 0.16, r), off = smooth(0.42, 0.46, r);
  if (on > off) {
    const y0 = lerp(sy, bottom, off), y1 = lerp(sy, bottom, on);
    const g = ctx.createLinearGradient(sx - 9, 0, sx + 9, 0);
    g.addColorStop(0, "rgba(140,200,240,0.55)");
    g.addColorStop(0.45, "rgba(235,248,255,0.9)");
    g.addColorStop(1, "rgba(120,185,230,0.6)");
    ctx.fillStyle = g;
    const wob = Math.sin(s.t * 40) * 0.8;
    ctx.beginPath();
    ctx.moveTo(sx - 8, y0);
    ctx.lineTo(sx + 8, y0);
    ctx.lineTo(sx + 6 + wob, y1);
    ctx.lineTo(sx - 6 + wob, y1);
    ctx.fill();
    // 지붕에 튀는 물방울
    if (on >= 1 && off <= 0) dropsEmit(s, sx, bottom, { vx: 0, vy: -120, spread: 16, every: 0.06, r: 2 });
  }
}

// 펼쳐서 납작하게(꾹 눌려 옆으로 퍼지며 펼친 모습으로 바뀜) → 수거함으로
function drawFlat(ctx, img, v, b, binX, nh, binSy, cw, ch, fw, fh) {
  const fl = v.flat;
  const swell = fl < 0.15 ? Math.sin(Math.PI * fl / 0.15) : 0;
  const f = fl >= 1 ? 1 : easeInOut(clamp01((fl - 0.12) / 0.55));
  const jig = fl < 1 ? wobble(clamp01((fl - 0.67) / 0.33), 2) : 0;
  const morph = smooth(0.3, 0.7, f);   // 세운 종이팩 → 펼친 종이팩 그림으로 바뀌는 정도

  let x = CX, y = GY, rot = 0, sc = 1;
  let clipY = null;
  if (b > 0.3) {
    // 포물선: 제자리 → 수거함 입구 위 → 안쪽 벽에 비스듬히 기대어 멈춤 (윗부분만 입구 위로 보임)
    // 펼친 팩이 커서 날아오르기 전에 먼저 줄여 꼭대기에서도 화면 위로 넘지 않게 함
    const u = clamp01((b - 0.3) / 0.48);
    const k = easeInOut(u);
    const lip = GY - nh * binSy + BIN.lip * KN;     // 입구 앞쪽 테두리 윗선
    const endY = lip + fh * 0.55 - 85;               // 멈춘 자리: 위쪽 85px만 입구 위로 보임
    const peak = GY - nh - 20;                      // 가장 높이 뜬 자리(팩 아랫선)
    x = lerp(CX, binX - 10, k);
    y = lerp(GY, endY, k) - 4 * u * (1 - u) * (lerp(GY, endY, 0.5) - peak);
    rot = Math.sin(Math.PI * u) * -0.25 + k * 0.14 + wobble(clamp01((b - 0.78) / 0.22), 2) * 0.05;
    sc = lerp(1, 0.55, smooth(0, 0.45, u));
    if (u > 0.55) clipY = lip;
  }
  shadow(ctx, CX, lerp(cw * 1.25, fw * 1.05, morph), 1 - smooth(0.3, 0.42, b));
  ctx.save();
  if (clipY !== null) {
    ctx.beginPath();
    ctx.rect(-500, -500, 2000, clipY + 500);
    ctx.clip();
  }
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(sc, sc);
  // 크기: 세운 팩(cw×ch)에서 펼친 팩(fw×fh)으로, 처음엔 살짝 부풀고 끝에 한 번 출렁
  const sy = 1 + swell * 0.04 - jig * 0.06;
  const w = lerp(cw, fw, f) * (1 + swell * 0.05) / Math.sqrt(sy), h = lerp(ch, fh, f) * sy;
  if (morph < 1) { ctx.globalAlpha = 1 - morph; ctx.drawImage(img.carton, -w / 2, -h, w, h); }
  if (morph > 0) { ctx.globalAlpha = morph; ctx.drawImage(img.flat, -w / 2, -h, w, h); }
  ctx.restore();
}

// 우유 방울: 흰 바탕에서도 보이도록 옅은 회색 테두리를 두른 흰 방울 (물방울과 같은 움직임)
function milkEmit(s, x, y) {
  const m = s.mem;
  m.milk = m.milk || [];
  m.milkAcc = (m.milkAcc || 0) + s.dt;
  while (m.milkAcc > 0.022) {
    m.milkAcc -= 0.022;
    m.milk.push({ x: x + (Math.random() - 0.5) * 10, y: y, vx: -30 + (Math.random() - 0.5) * 30, vy: 60 + (Math.random() - 0.5) * 30, r: 3.5 + Math.random() * 3 });
  }
}
function milkDraw(ctx, s) {
  const list = s.mem.milk;
  if (!list || !list.length) return;
  ctx.save();
  ctx.fillStyle = MILK;
  ctx.strokeStyle = "rgba(150,165,180,0.55)";
  ctx.lineWidth = 1.2;
  for (let i = list.length - 1; i >= 0; i--) {
    const d = list[i];
    d.vy += 900 * s.dt;
    d.x += d.vx * s.dt;
    d.y += d.vy * s.dt;
    if (d.y > GY) { list.splice(i, 1); continue; }
    ctx.beginPath();
    ctx.ellipse(d.x, d.y, d.r * 0.8, d.r * 1.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

// 효과음 (3D 장면과 같은 순간)
function sounds(v) {
  if (hit(v, "empty", 0.36)) sfx.play("pour", 0.79);  // 쪼르륵 비우기
  if (hit(v, "rinse", 0.12)) sfx.play("water", 1.08); // 수도꼭지 물줄기
  if (hit(v, "rinse", 0.71)) sfx.play("pour", 0.58);  // 헹군 물 쏟기
  if (hit(v, "flat", 0.14)) sfx.play("paper", 0.99);  // 꾹 눌러 펴는 사각사각
  if (hit(v, "bin", 0.78)) sfx.play("thud");          // 수거함에 통
  if (hit(v, "bin", 0.95)) sfx.play("chime");         // 끝 띵동
}
