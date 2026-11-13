// 대형 폐기물 장면 — 그림(2D)
// 서대문구청 안내: 구 홈페이지 인터넷 접수 또는 동별 대행업체 전화로 배출 신고 → 수수료 납부
// → "신고필증"을 출력해 배출 품목에 붙임 → 약속한 날 내놓으면 수거
// 그림: img/scene/bulky/chair.webp (나무 의자). 휴대폰·신고필증·집 앞·달력은 그림이 없어 도형으로 그림
// 단계 값은 3D 장면(scene-bulky.js)과 같아 효과음 순간도 같게 맞춤
// 휴대폰·필증·손가락 그리기는 폐가전 장면(scene-appliance2d.js)도 가져다 씀(export)
import { clamp01, smooth, easeInOut, backOut, lerp, bounceDrop, wobble } from "./eco3d-util.js?v=20261108r";
import { sfx, hit } from "./eco3d-sound.js?v=20261108r";
import { shadow as shade, t, fitText } from "./eco2d-util.js?v=20261108r";

const D = "img/scene/bulky/";
const TAU = Math.PI * 2;
// 의자 그림 원래 크기, tag = 등받이 윗살 가운데(신고필증이 붙는 자리, 그림 안 좌표)
const CHAIR = { w: 214, h: 337, tag: { x: 56, y: 52 } };

// 장면 배치 (설계 크기 820×760 기준, eco2d.js)
const GY = 700;              // 바닥선
const KC = 440 / CHAIR.h;    // 의자 크기 배율 (의자 높이 440)
const CX = 270;              // 의자 처음 자리
const OUT_X = 500;           // 집 앞에 내놓는 자리
const OUT_K = 0.88;          // 내놓은 뒤 크기(조금 뒤로 간 느낌)
const PX = 630, PY = 380;    // 휴대폰 가운데
const TAG = { w: 124, h: 82 };                 // 의자에 붙은 신고필증 크기
const HOUSE = { l: 370, r: 770, top: 168 };    // 윗선은 휴대폰 화면 오른쪽 위 효과음 단추에 닿지 않게    // 집 앞 벽 (왼쪽·오른쪽·윗선)

export default {
  kind: "2d",
  // report 1 = 배출 신고·수수료 납부, sticker 1 = 신고필증 붙임, out 1 = 약속한 날 집 앞에 내놓음
  states: [
    { report: 0, sticker: 0, out: 0 },
    { report: 1, sticker: 0, out: 0 },
    { report: 1, sticker: 1, out: 0 },
    { report: 1, sticker: 1, out: 1 }
  ],
  moves: [null, [["report", 2.8]], [["sticker", 2.8]], [["out", 3.4]]],
  images: { chair: D + "chair.webp" },
  draw: draw
};

function draw(ctx, v, s) {
  const img = s.img;
  const cw = CHAIR.w * KC, ch = CHAIR.h * KC;
  sounds(v);

  // ── 3단계 배경: 집 앞 벽이 바닥에서 솟아오르고, 약속한 날에 동그라미 친 달력이 톡 나타남 ──
  const op = v.out;
  if (op > 0) {
    drawHouse(ctx, backOut(clamp01(op / 0.3)));
    drawCalendar(ctx, OUT_X, 250, 0.92 * backOut(clamp01((op - 0.15) / 0.2)), easeInOut(smooth(0.3, 0.48, op)));
  }

  // ── 의자: 2단계에 필증이 붙으면 출렁, 3단계에 움츠렸다 폴짝 들려 집 앞으로 옮겨져 통통 내려앉음 ──
  const sp = v.sticker;
  const crouch = op > 0.22 && op < 0.34 ? Math.sin(Math.PI * (op - 0.22) / 0.12) : 0;
  const carry = easeInOut(clamp01((op - 0.3) / 0.42));
  // 들어 올릴 때는 쭉, 내려앉을 때는 bounceDrop으로 통통 (옮기기가 끝나는 0.72에 바닥에 닿음)
  const hop = (op < 0.48 ? Math.sin(Math.PI * 0.5 * clamp01((op - 0.3) / 0.18)) : bounceDrop((op - 0.48) / 0.4)) * 80;
  const jolt = wobble(clamp01((sp - 0.62) / 0.38), 2);
  const sway = wobble(clamp01((op - 0.8) / 0.2), 2);
  const land = op > 0.71 && op < 0.83 ? Math.sin(Math.PI * (op - 0.71) / 0.12) : 0;
  const sy = 1 - crouch * 0.08 - land * 0.07 + jolt * 0.03;
  const x = lerp(CX, OUT_X, carry), k = lerp(1, OUT_K, carry);
  const slap = clamp01((sp - 0.62) / 0.18);
  const tag = sp >= 0.62 ? { rot: -0.07 + wobble(slap, 2) * 0.12, sx: 1 + 0.16 * Math.sin(slap * Math.PI), sy: 1 - 0.1 * Math.sin(slap * Math.PI) } : null;
  shade(ctx, x, GY, cw * 1.05 * k * (1 - hop / 260), 1);
  ctx.save();
  ctx.translate(x, GY - hop);
  ctx.rotate(Math.sin(Math.PI * carry) * 0.1 + jolt * 0.03 + sway * 0.04);
  ctx.scale(k / Math.sqrt(sy), k * sy);
  ctx.drawImage(img.chair, -cw / 2, -ch, cw, ch);
  if (tag) drawPermit(ctx, -cw / 2 + CHAIR.tag.x * KC, -ch + CHAIR.tag.y * KC, TAG.w, TAG.h, "item.bulky", tag);
  ctx.restore();

  // ── 1·2단계: 휴대폰 (신고 화면 → 손가락으로 ₩ 결제 톡 → 완료 체크), 필증을 내보낸 뒤 위로 사라짐 ──
  const rp = v.report;
  const away = Math.pow(clamp01((sp - 0.75) / 0.25), 2);
  const tagHome = [CX - cw / 2 + CHAIR.tag.x * KC, GY - ch + CHAIR.tag.y * KC];
  // 필증이 휴대폰 윗변에서 쏙 나옴: 휴대폰보다 먼저 그려 아랫부분이 휴대폰에 가려짐
  if (sp > 0.03 && sp < 0.14) flyingPermit(ctx, sp, tagHome);
  if (rp > 0 && away < 1) {
    const pk = backOut(clamp01(rp / 0.3)) * (1 - away);
    const py = PY - (1 - smooth(0, 0.3, rp)) * 60 - away * 50;
    const press = rp > 0.5 && rp < 0.6 ? Math.sin(Math.PI * (rp - 0.5) / 0.1) : 0;
    const settle = wobble(clamp01((rp - 0.6) / 0.4), 2);
    shade(ctx, PX, GY, 190 * pk, 0.55);
    drawPhone(ctx, PX, py, pk * (1 - press * 0.02), settle * 0.05, function (c, w, h) {
      if (rp > 0.6) doneScreen(c, w, h, smooth(0.6, 0.76, rp));
      else formScreen(c, w, h, press, chairIcon);
    }, 1 - away);
    tapFinger(ctx, PX, py + FORM_BTN_Y * pk, rp);
  }
  if (sp >= 0.14 && sp < 0.62) flyingPermit(ctx, sp, tagHome);
}

// 날아가는 신고필증: 휴대폰 위로 나옴(0.03~0.14) → 흔들리며 포물선으로 등받이까지(0.14~0.62)
function flyingPermit(ctx, sp, home) {
  const out = easeInOut(smooth(0.03, 0.14, sp));
  const fly = easeInOut(clamp01((sp - 0.14) / 0.48));
  const x0 = PX, y0 = PY - PHONE.h / 2 + 30 - out * 70;
  const x = lerp(x0, home[0], fly);
  const y = lerp(y0, home[1], fly) - 4 * fly * (1 - fly) * 150;
  const k = lerp(0.62, 1, fly);
  drawPermit(ctx, x, y, TAG.w * k, TAG.h * k, "item.bulky", { rot: -0.07 * fly + Math.sin(fly * Math.PI * 2) * 0.35 });
}

// ── 집 앞 벽: 크림색 벽 + 처마 + 나무 문 (k = 바닥에서 솟아오른 정도) ──
function drawHouse(ctx, k) {
  if (k <= 0.001) return;
  const l = HOUSE.l, r = HOUSE.r, top = HOUSE.top, w = r - l;
  ctx.save();
  ctx.translate(0, GY);
  ctx.scale(1, k);
  ctx.translate(0, -GY);
  // 벽
  ctx.shadowColor = "rgba(30,50,40,0.18)";
  ctx.shadowBlur = 22;
  const g = ctx.createLinearGradient(l, 0, r, 0);
  g.addColorStop(0, "#e8ddc9");
  g.addColorStop(1, "#f6efe2");
  ctx.fillStyle = g;
  ctx.fillRect(l, top, w, GY - top);
  ctx.shadowColor = "transparent";
  // 벽돌 결(옅은 가로줄)
  ctx.strokeStyle = "rgba(150,128,96,0.16)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let y = top + 48; y < GY - 50; y += 36) { ctx.moveTo(l, y); ctx.lineTo(r, y); }
  ctx.stroke();
  // 아래 굽
  ctx.fillStyle = "#d3c5ab";
  ctx.fillRect(l, GY - 44, w, 44);
  // 처마와 그 그늘
  ctx.fillStyle = "rgba(90,55,35,0.16)";
  ctx.fillRect(l, top, w, 14);
  const rg = ctx.createLinearGradient(0, top - 28, 0, top + 4);
  rg.addColorStop(0, "#d98a6d");
  rg.addColorStop(1, "#b9654b");
  ctx.fillStyle = rg;
  rr(ctx, l - 14, top - 28, w + 28, 32, 7);
  ctx.fill();
  // 문: 문틀 → 나무 문(판 두 칸) → 손잡이 → 문턱 돌
  const dx = 628, dw = 118, dt = GY - 330;
  ctx.fillStyle = "#8e6c4c";
  ctx.fillRect(dx - 9, dt - 9, dw + 18, GY - dt + 9);
  const dg = ctx.createLinearGradient(dx, 0, dx + dw, 0);
  dg.addColorStop(0, "#c49770");
  dg.addColorStop(1, "#a87a52");
  ctx.fillStyle = dg;
  ctx.fillRect(dx, dt, dw, GY - dt);
  ctx.strokeStyle = "rgba(80,48,24,0.28)";
  ctx.lineWidth = 3;
  rr(ctx, dx + 16, dt + 20, dw - 32, 120, 6);
  ctx.stroke();
  rr(ctx, dx + 16, dt + 160, dw - 32, 130, 6);
  ctx.stroke();
  ctx.fillStyle = "#e7c35a";
  ctx.beginPath();
  ctx.arc(dx + dw - 20, dt + 178, 7, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#c2b9ab";
  rr(ctx, dx - 22, GY - 12, dw + 44, 14, 4);
  ctx.fill();
  ctx.restore();
}

// ── 달력: 산호색 머리띠 + 날짜 점, 약속한 날에 민트 동그라미 (k = 톡 나타난 크기, ring = 동그라미 그린 정도) ──
function drawCalendar(ctx, x, y, k, ring) {
  if (k <= 0.001) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  ctx.shadowColor = "rgba(30,50,40,0.22)";
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 5;
  ctx.fillStyle = "#ffffff";
  rr(ctx, -92, -64, 184, 128, 14);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.fillStyle = "#f29a86";
  rr(ctx, -92, -64, 184, 30, [14, 14, 0, 0]);
  ctx.fill();
  ctx.fillStyle = "#5d6b66";
  [-52, 52].forEach(function (bx) { rr(ctx, bx - 4, -74, 8, 22, 4); ctx.fill(); });
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 7; c++) {
      ctx.fillStyle = r === 1 && c === 4 && ring > 0 ? "#6cc596" : "#e6ddcd";
      ctx.beginPath();
      ctx.arc(-72 + c * 24, -10 + r * 25, 6.5, 0, TAU);
      ctx.fill();
    }
  }
  if (ring > 0) {
    ctx.strokeStyle = "#3fae74";
    ctx.lineWidth = 4.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(-72 + 4 * 24, -10 + 25, 15, -Math.PI / 2, -Math.PI / 2 + TAU * ring);
    ctx.stroke();
  }
  ctx.restore();
}

// ════════ 아래는 폐가전 장면도 함께 쓰는 그리기 도구 ════════

// 둥근 사각형 경로
export function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

// 휴대폰 크기와 화면 안쪽 여백(옆·위·아래). 화면 크기 = 172×306
export const PHONE = { w: 196, h: 380, r: 32, sx: 12, sy: 40, sb: 34 };
// 신고 화면의 결제 버튼 가운데: 휴대폰 가운데에서 아래로 떨어진 거리(크기 1 기준)
export const FORM_BTN_Y = -PHONE.h / 2 + PHONE.sy + 245;

// 휴대폰: (x, y) 가운데, k 크기, rot 기울기, screen(ctx, w, h) = 화면 안 그리기(화면 왼쪽 위가 0,0)
export function drawPhone(ctx, x, y, k, rot, screen, alpha) {
  if (k <= 0.001 || (alpha ?? 1) <= 0.001) return;
  const w = PHONE.w, h = PHONE.h;
  ctx.save();
  ctx.globalAlpha = alpha ?? 1;
  ctx.translate(x, y);
  ctx.rotate(rot || 0);
  ctx.scale(k, k);
  // 몸체: 짙은 회녹색, 부드러운 그림자
  ctx.shadowColor = "rgba(30,50,40,0.3)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 10;
  const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
  g.addColorStop(0, "#5f6e69");
  g.addColorStop(0.5, "#45524e");
  g.addColorStop(1, "#36423e");
  ctx.fillStyle = g;
  rr(ctx, -w / 2, -h / 2, w, h, PHONE.r);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.strokeStyle = "rgba(255,255,255,0.2)";
  ctx.lineWidth = 2;
  rr(ctx, -w / 2 + 2, -h / 2 + 2, w - 4, h - 4, PHONE.r - 2);
  ctx.stroke();
  // 스피커·카메라
  ctx.fillStyle = "#28322f";
  rr(ctx, -22, -h / 2 + 16, 44, 7, 3.5);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(36, -h / 2 + 19.5, 4, 0, TAU);
  ctx.fill();
  // 화면
  const sw = w - PHONE.sx * 2, sh = h - PHONE.sy - PHONE.sb;
  ctx.save();
  ctx.translate(-w / 2 + PHONE.sx, -h / 2 + PHONE.sy);
  rr(ctx, 0, 0, sw, sh, 14);
  ctx.clip();
  screen(ctx, sw, sh);
  ctx.restore();
  // 아래 홈 막대
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  rr(ctx, -26, h / 2 - 20, 52, 6, 3);
  ctx.fill();
  ctx.restore();
}

// 화면 윗부분: 크림 바탕 + 민트 머리띠
export function screenTop(c, w, h) {
  c.fillStyle = "#fffaf0";
  c.fillRect(0, 0, w, h);
  c.fillStyle = "#6cc596";
  c.fillRect(0, 0, w, 44);
  c.fillStyle = "#ffffff";
  rr(c, 16, 17, 52, 10, 5);
  c.fill();
}

// 신고 화면: 물건 그림(icon), 입력 칸 두 줄, ₩ 결제 버튼(press = 눌린 정도)
export function formScreen(c, w, h, press, icon) {
  screenTop(c, w, h);
  c.fillStyle = "#e5f4ea";
  c.beginPath();
  c.arc(w / 2, 104, 44, 0, TAU);
  c.fill();
  icon(c, w / 2, 104);
  c.fillStyle = "#ece6da";
  rr(c, 20, 162, w - 40, 15, 7.5);
  c.fill();
  rr(c, 20, 188, w - 64, 15, 7.5);
  c.fill();
  c.fillStyle = press > 0 ? "#4fae7c" : "#6cc596";
  rr(c, 20 + press * 3, 222 + press * 2, w - 40 - press * 6, 46 - press * 4, 23);
  c.fill();
  fitText(c, "₩", w / 2, 246, 60, 30, 800, "#ffffff");
}

// 완료 화면: 민트 동그라미 + 흰 체크 (k 0~1 = 체크가 그려지는 정도)
export function doneScreen(c, w, h, k) {
  screenTop(c, w, h);
  const r = 50 * (k < 1 ? 0.7 + 0.3 * backOut(clamp01(k * 1.6)) : 1);
  c.fillStyle = "#6cc596";
  c.beginPath();
  c.arc(w / 2, 130, r, 0, TAU);
  c.fill();
  // 체크 표시: 선 길이의 k만큼만 그림
  c.strokeStyle = "#ffffff";
  c.lineWidth = 12;
  c.lineCap = "round";
  c.lineJoin = "round";
  c.setLineDash([96 * k, 200]);
  c.beginPath();
  c.moveTo(w / 2 - 24, 132);
  c.lineTo(w / 2 - 6, 150);
  c.lineTo(w / 2 + 26, 112);
  c.stroke();
  c.setLineDash([]);
  c.fillStyle = "#ece6da";
  rr(c, 28, 212, w - 56, 14, 7);
  c.fill();
  rr(c, 44, 236, w - 88, 14, 7);
  c.fill();
}

// 화면 속 의자 그림(민트)
function chairIcon(c, x, y) {
  c.fillStyle = "#6cc596";
  rr(c, x - 21, y - 34, 42, 30, 8);
  c.fill();
  rr(c, x - 28, y - 2, 56, 13, 6);
  c.fill();
  rr(c, x - 24, y + 9, 9, 26, 4);
  c.fill();
  rr(c, x + 15, y + 9, 9, 26, 4);
  c.fill();
}

// 손가락으로 화면 톡: (tx, ty) 누를 자리, p = 그 단계 진행값
// 0.36~0.5 다가옴 → 0.5~0.6 꾹(0.53에 톡 소리) → 0.6~0.74 물러남, 누른 자리에 동그라미가 퍼짐
export function tapFinger(ctx, tx, ty, p) {
  if (p < 0.36 || p > 0.74) return;
  const come = easeInOut(smooth(0.36, 0.5, p)), back = smooth(0.6, 0.74, p);
  const press = p > 0.5 && p < 0.6 ? Math.sin(Math.PI * (p - 0.5) / 0.1) : 0;
  const d = 110 * (1 - come) + 110 * back - press * 5;
  const a = Math.min(smooth(0.36, 0.44, p), 1 - smooth(0.66, 0.74, p));
  if (p > 0.53 && p < 0.7) {
    const u = (p - 0.53) / 0.17;
    ctx.save();
    ctx.strokeStyle = `rgba(255,255,255,${0.9 * (1 - u)})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(tx, ty, 14 + u * 34, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
  // 손가락: 끝이 (tx, ty)에 오고 오른쪽 아래로 뻗음
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(tx + d * 0.55, ty + d * 0.8);
  ctx.rotate(-0.6);
  ctx.shadowColor = "rgba(40,30,20,0.25)";
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 4;
  const g = ctx.createLinearGradient(-18, 0, 18, 0);
  g.addColorStop(0, "#f6cfae");
  g.addColorStop(1, "#e2a885");
  ctx.fillStyle = g;
  rr(ctx, -17, -4, 34, 170, 17);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.fillStyle = "rgba(255,240,230,0.85)";
  rr(ctx, -10, 2, 20, 24, 9);
  ctx.fill();
  ctx.restore();
}

// 신고필증·접수증 스티커: (x, y) 가운데, w×h 크기, key = 맨 위에 쓸 품목 이름(i18n 키)
// 노랑 바탕 + 품목 이름 띠 + 번호 + 바코드. o: { rot, sx, sy, alpha }
export function drawPermit(ctx, x, y, w, h, key, o) {
  o = o || {};
  ctx.save();
  ctx.globalAlpha = o.alpha ?? 1;
  ctx.translate(x, y);
  ctx.rotate(o.rot || 0);
  ctx.scale((o.sx ?? 1) * w / 150, (o.sy ?? 1) * h / 100);  // 150×100 기준으로 그리고 크기만 맞춤
  ctx.shadowColor = "rgba(50,40,10,0.28)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = "#f9dd88";
  rr(ctx, -75, -50, 150, 100, 12);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.strokeStyle = "#e2a93a";
  ctx.lineWidth = 3.5;
  rr(ctx, -72, -47, 144, 94, 10);
  ctx.stroke();
  ctx.fillStyle = "#edbd4f";
  rr(ctx, -64, -40, 128, 26, 6);
  ctx.fill();
  fitText(ctx, t(key), 0, -26.5, 120, 17, 800, "#5a3f0c");
  fitText(ctx, "No. 1376", 0, 2, 120, 15, 800, "#7a5a1c");
  ctx.fillStyle = "#6b4f18";
  let bx = -54;
  for (let i = 0; bx < 54; i++) {
    const bw = [2, 4, 1.5, 5][i % 4];
    ctx.fillRect(bx, 15, bw, 24);
    bx += bw + 3;
  }
  ctx.restore();
}

// 효과음 (3D 장면과 같은 순간)
function sounds(v) {
  if (hit(v, "report", 0.05)) sfx.play("pop");     // 휴대폰 퐁 등장
  if (hit(v, "report", 0.53)) sfx.play("tap");     // 화면 톡
  if (hit(v, "report", 0.6)) sfx.play("beep");     // 납부 완료 띠링
  if (hit(v, "sticker", 0.06)) sfx.play("slide");  // 필증이 쏙 나옴
  if (hit(v, "sticker", 0.63)) sfx.play("stick");  // 등받이에 착
  if (hit(v, "out", 0.72)) sfx.play("thud");       // 집 앞에 쿵
  if (hit(v, "out", 0.82)) sfx.play("tap");        // 한 번 더 통
  if (hit(v, "out", 0.95)) sfx.play("chime");      // 끝 띵동
}
