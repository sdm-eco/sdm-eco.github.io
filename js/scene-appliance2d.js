// 폐가전 장면 — 그림(2D)
// 서대문구 폐금속자원 배출 안내: 냉장고·에어컨·세탁기·TV 등 대형폐가전(또는 소형 5개 이상)은 폐가전 무상방문수거 예약(☎1599-0903),
// 소형폐가전 5개 미만은 구청 홈페이지 "대형폐기물 신고"에서 무상 신고 → 접수증 부착 후 건물 밖 배출
// 그림: img/scene/appliance/*.webp (냉장고·전기 주전자·선풍기). 휴대폰·접수증·손수레·트럭은 그림이 없어 도형으로 그림
// 단계 값은 3D 장면(scene-appliance.js)과 같아 효과음 순간도 같게 맞춤
// 휴대폰·접수증·손가락 그리기는 대형 폐기물 장면(scene-bulky2d.js)의 것을 같이 씀
import { clamp01, smooth, easeInOut, backOut, lerp, bounceDrop, wobble } from "./eco3d-util.js?v=20261108r";
import { sfx, hit } from "./eco3d-sound.js?v=20261108r";
import { put, shadow as shade, fitText } from "./eco2d-util.js?v=20261108r";
import { rr, PHONE, drawPhone, screenTop, doneScreen, tapFinger, drawPermit } from "./scene-bulky2d.js?v=20261108r";

const D = "img/scene/appliance/";
const TAU = Math.PI * 2;
// 그림 조각 원래 크기, tag = 주전자 몸통 앞 가운데(접수증이 붙는 자리, 그림 안 좌표)
const FRIDGE = { w: 179, h: 337 };
const KETTLE = { w: 220, h: 260, tag: { x: 92, y: 126 } };
const FAN = { w: 203, h: 320 };

// 장면 배치 (설계 크기 820×760 기준, eco2d.js)
const GY = 700;                 // 바닥선
const KF = 460 / FRIDGE.h;      // 냉장고 크기 배율 (냉장고 높이 460)
const FX = 250;                 // 냉장고 자리
const PX = 630, PY = 380;       // 휴대폰 가운데
const PX3 = 700, P3K = 0.85;    // 3단계 휴대폰: 선풍기와 겹치지 않게 오른쪽에 조금 작게
const TRUCK_X = 470;            // 트럭 서는 자리(가운데) — 냉장고 바로 뒤(멀리)에 섬
const TGY = GY - 30;            // 트럭 바닥선: 조금 뒤(멀리) 세워 냉장고가 작아지며 실리게 함
const BED = { x: -70, y: -100 };  // 트럭 가운데에서 짐칸 바닥 가운데까지
const DOLLY_STOP = 320;         // 손수레가 짐칸 뒤끝에 서는 자리
const KK = 0.96, KN = 1;        // 주전자·선풍기 배율
const KET_X = 290, FAN_X = 520; // 작은 가전 자리
const TAG = { w: 104, h: 69 };  // 주전자에 붙은 접수증 크기
const CALL_BTN_Y = -PHONE.h / 2 + PHONE.sy + 236;  // 전화 화면 통화 버튼: 휴대폰 가운데에서 아래로

export default {
  kind: "2d",
  // book 1 = 무상방문수거 예약, pickup 1 = 냉장고를 실어 감, small 1 = 작은 가전에 접수증을 붙임
  states: [
    { book: 0, pickup: 0, small: 0 },
    { book: 1, pickup: 0, small: 0 },
    { book: 1, pickup: 1, small: 0 },
    { book: 1, pickup: 1, small: 1 }
  ],
  moves: [null, [["book", 2.4]], [["pickup", 3.0]], [["small", 2.8]]],
  images: { fridge: D + "fridge.webp", kettle: D + "kettle.webp", fan: D + "fan.webp" },
  draw: draw
};

function draw(ctx, v, s) {
  const img = s.img;
  const pp = v.pickup, sp = v.small;
  sounds(v);

  // ── 2단계 트럭: 오른쪽에서 들어와 서고, 3단계가 시작되면 냉장고를 싣고 오른쪽으로 떠남 ──
  const tin = clamp01((pp - 0.04) / 0.24);
  const tout = clamp01(sp / 0.14);  // 떨어지는 선풍기와 겹치지 않게 빨리 떠남
  const tx = lerp(1150, TRUCK_X, 1 - Math.pow(1 - tin, 3)) + 620 * tout * tout;
  const truckOn = pp > 0.04 && tx < 1120;
  if (truckOn) truckBack(ctx, tx, TGY);

  // ── 냉장고 + 손수레 ──
  // 0~0.25 손수레가 왼쪽에서 미끄러져 와 냉장고 뒤에 섬 → 0.25~0.33 냉장고 움찔(준비) → 0.3~0.48 뒤로 기울여 실음
  // → 0.5~0.68 트럭 뒤까지 굴려 감(멀어지며 작아짐) → 0.68~0.8 짐칸으로 쑥 올림 → 손수레는 사라지고 냉장고가 출렁
  const fw = FRIDGE.w * KF, fh = FRIDGE.h * KF;
  const inT = backOut(clamp01(pp / 0.25));
  const prep = pp > 0.25 && pp < 0.33 ? Math.sin(Math.PI * (pp - 0.25) / 0.08) : 0;
  const tiltT = backOut(clamp01((pp - 0.3) / 0.18));
  const move = easeInOut(clamp01((pp - 0.5) / 0.18));
  const up = easeInOut(clamp01((pp - 0.68) / 0.12));
  const settle = wobble(clamp01((pp - 0.8) / 0.2), 2);
  const bump = Math.abs(Math.sin(move * Math.PI * 4)) * 5 * (move > 0 && move < 1 ? 1 : 0);
  // 손수레 자리·크기·기울기
  const dx = pp > 0.5 ? lerp(FX, DOLLY_STOP, move) : lerp(FX - 330, FX, inT);
  const dk = lerp(1, 0.56, move);
  const dgy = lerp(GY, TGY, move);
  const lean = -0.12 * tiltT * (1 - up) + prep * 0.015;
  const dollyA = pp > 0 ? 1 - smooth(0.72, 0.84, pp) : 0;
  // 냉장고 자리: 손수레에 실려 가다가 짐칸으로 올라감, 3단계엔 트럭과 함께 떠남
  const onBed = [tx + BED.x, TGY + BED.y];
  let fx = FX, fgy = GY, fk = 1, frot = 0;
  if (pp > 0.68) {
    fx = lerp(DOLLY_STOP, onBed[0], up);
    fgy = lerp(TGY - 6 * dk, onBed[1], up) - 4 * up * (1 - up) * 70;
    fk = lerp(0.56, 0.5, up);
    frot = lean;
  } else if (pp > 0.3) {
    fx = dx; fgy = dgy - bump - 6 * dk * clamp01(tiltT); fk = dk; frot = lean;
  }
  const fsy = 1 - prep * 0.03 + settle * 0.03;
  const fridgeVisible = !(truckOn === false && pp >= 0.99);
  // 트럭은 냉장고보다 뒤(멀리)에 있으므로 짐칸 옆판·바퀴도 먼저 그림. 냉장고가 짐칸 위로 올라간 뒤에만 옆판이 냉장고 아래를 가림
  const loaded = fgy < TGY - 120;
  if (truckOn && !loaded) truckFront(ctx, tx, TGY);

  // 손수레 뒤쪽(손잡이·바퀴)은 냉장고 뒤에, 받침판은 냉장고 앞에
  if (dollyA > 0) {
    ctx.save();
    ctx.globalAlpha = dollyA;
    ctx.translate(dx, dgy - bump);
    ctx.rotate(pp > 0.3 ? lean : 0);
    ctx.scale(dk, dk);
    dollyBack(ctx, fw, fh, pp > 0.5 ? move * 6 : (1 - inT) * -8);
    ctx.restore();
  }
  if (fridgeVisible) {
    if (pp < 0.7) shade(ctx, fx, pp > 0.3 ? dgy : GY, fw * 1.15 * fk, 1);
    ctx.save();
    ctx.translate(fx, fgy);
    ctx.rotate(frot);
    ctx.scale(fk / Math.sqrt(fsy), fk * fsy);
    ctx.drawImage(img.fridge, -fw / 2, -fh, fw, fh);
    ctx.restore();
  }
  if (dollyA > 0) {
    ctx.save();
    ctx.globalAlpha = dollyA;
    ctx.translate(dx, dgy - bump);
    ctx.rotate(pp > 0.3 ? lean : 0);
    ctx.scale(dk, dk);
    ctx.fillStyle = "#9aa8ae";
    rr(ctx, -fw / 2 - 6, -9, fw + 12, 12, 3);
    ctx.fill();
    ctx.restore();
  }
  if (truckOn && loaded) truckFront(ctx, tx, TGY);

  // ── 3단계: 작은 가전(주전자·선풍기)이 위에서 떨어져 통통 내려앉음 ──
  if (sp > 0) {
    const kt = clamp01(sp / 0.3), nt = clamp01((sp - 0.06) / 0.3);
    const kLand = kt > 0.58 && kt < 0.8 ? Math.sin(Math.PI * (kt - 0.58) / 0.22) : 0;
    const nLand = nt > 0.58 && nt < 0.8 ? Math.sin(Math.PI * (nt - 0.58) / 0.22) : 0;
    const slap = clamp01((sp - 0.85) / 0.1);
    const jolt = wobble(clamp01((sp - 0.85) / 0.15), 2);
    // 선풍기
    if (nt > 0) {
      const ny = bounceDrop(nt) * 380, sy = 1 - nLand * 0.12;
      shade(ctx, FAN_X, GY, FAN.w * KN * 1.1 * (1 - ny / 600), smooth(0, 0.1, nt));
      put(ctx, img.fan, FAN_X, GY - ny, FAN.w * KN, FAN.h * KN, { sx: 1 / Math.sqrt(sy), sy: sy, alpha: smooth(0, 0.08, nt) });
    }
    // 주전자 (접수증이 붙으면 같이 움직임)
    const ky = bounceDrop(kt) * 380, ksy = 1 - kLand * 0.12 - jolt * 0.04;
    const kw = KETTLE.w * KK, kh = KETTLE.h * KK;
    shade(ctx, KET_X, GY, kw * 1.1 * (1 - ky / 600), smooth(0, 0.1, kt));
    ctx.save();
    ctx.globalAlpha = smooth(0, 0.08, kt);
    ctx.translate(KET_X, GY - ky);
    ctx.rotate(jolt * 0.05);
    ctx.scale(1 / Math.sqrt(ksy), ksy);
    ctx.drawImage(img.kettle, -kw / 2, -kh, kw, kh);
    if (sp >= 0.85) {
      drawPermit(ctx, -kw / 2 + KETTLE.tag.x * KK, -kh + KETTLE.tag.y * KK, TAG.w, TAG.h, "item.appliance",
        { rot: 0.05 + wobble(slap, 2) * 0.12, sx: 1 + 0.15 * Math.sin(slap * Math.PI), sy: 1 - 0.1 * Math.sin(slap * Math.PI) });
    }
    ctx.restore();
  }

  // ── 휴대폰 ──
  // 1단계: 위에서 톡 나타나 → 손가락으로 통화 버튼 톡 → 예약 완료 체크. 2단계 시작에 위로 사라짐
  // 3단계: 다시 나타나(인터넷 신고 완료 화면) 접수증을 내보내고, 주전자에 붙으면 위로 사라짐
  const bp = v.book;
  const tagHome = [KET_X - KETTLE.w * KK / 2 + KETTLE.tag.x * KK, GY - KETTLE.h * KK + KETTLE.tag.y * KK];
  if (sp > 0) {
    const show = backOut(clamp01((sp - 0.2) / 0.16));
    const away = Math.pow(clamp01((sp - 0.86) / 0.14), 2);
    if (sp > 0.36 && sp < 0.42) flyingTag(ctx, sp, tagHome);
    if (show > 0.001 && away < 1) {
      shade(ctx, PX3, GY, 170 * show * (1 - away), 0.55);
      drawPhone(ctx, PX3, PY - (1 - smooth(0.2, 0.36, sp)) * 60 - away * 50, P3K * show * (1 - away), 0, function (c, w, h) { doneScreen(c, w, h, 1); }, 1 - away);
    }
    if (sp >= 0.42 && sp < 0.85) flyingTag(ctx, sp, tagHome);
  } else if (bp > 0) {
    const away = Math.pow(clamp01(pp / 0.12), 2);
    if (away < 1) {
      const pk = backOut(clamp01(bp / 0.3)) * (1 - away);
      const py = PY - (1 - smooth(0, 0.3, bp)) * 60 - away * 50;
      const press = bp > 0.5 && bp < 0.6 ? Math.sin(Math.PI * (bp - 0.5) / 0.1) : 0;
      const wob = wobble(clamp01((bp - 0.6) / 0.4), 2);
      shade(ctx, PX, GY, 190 * pk, 0.55);
      drawPhone(ctx, PX, py, pk * (1 - press * 0.02), wob * 0.05, function (c, w, h) {
        if (bp > 0.6) doneScreen(c, w, h, smooth(0.6, 0.76, bp));
        else callScreen(c, w, h, press);
      }, 1 - away);
      tapFinger(ctx, PX, py + CALL_BTN_Y * pk, bp);
    }
  }
}

// 날아가는 접수증: 휴대폰 윗변에서 쏙 나옴(0.36~0.42) → 흔들리며 포물선으로 주전자까지(0.42~0.85)
function flyingTag(ctx, sp, home) {
  const out = easeInOut(smooth(0.36, 0.42, sp));
  const fly = easeInOut(clamp01((sp - 0.42) / 0.43));
  const x = lerp(PX3, home[0], fly);
  const y = lerp(PY - PHONE.h * P3K / 2 + 26 - out * 60, home[1], fly) - 4 * fly * (1 - fly) * 170;
  const k = lerp(0.7, 1, fly);
  drawPermit(ctx, x, y, TAG.w * k, TAG.h * k, "item.appliance", { rot: 0.05 * fly + Math.sin(fly * Math.PI * 2) * 0.35 });
}

// 전화 화면: 작은 냉장고 그림, 1599-0903, 초록 통화 버튼(press = 눌린 정도)
function callScreen(c, w, h, press) {
  screenTop(c, w, h);
  c.fillStyle = "#e5f4ea";
  c.beginPath();
  c.arc(w / 2, 96, 38, 0, TAU);
  c.fill();
  c.fillStyle = "#6cc596";
  rr(c, w / 2 - 16, 70, 32, 52, 6);
  c.fill();
  c.fillStyle = "#e5f4ea";
  c.fillRect(w / 2 - 16, 88, 32, 3);
  c.fillRect(w / 2 + 8, 76, 3, 8);
  c.fillRect(w / 2 + 8, 96, 3, 14);
  fitText(c, "1599-0903", w / 2, 160, w - 24, 25, 800, "#3f5a4c");
  const r = 36 - press * 3;
  c.fillStyle = press > 0 ? "#3aa368" : "#4cc07f";
  c.beginPath();
  c.arc(w / 2, 236, r, 0, TAU);
  c.fill();
  // 흰 수화기
  c.save();
  c.translate(w / 2, 236);
  c.rotate(-0.75);
  c.fillStyle = "#ffffff";
  rr(c, -19, -6, 38, 12, 6);
  c.fill();
  rr(c, -21, -6, 12, 20, 5);
  c.fill();
  rr(c, 9, -6, 12, 20, 5);
  c.fill();
  c.restore();
}

// ── 손수레(앞에서 본 모습): 냉장고 뒤로 손잡이가 위에, 바퀴가 양옆에 보임. (0,0) = 받침판 가운데 바닥 ──
function dollyBack(ctx, fw, fh, spin) {
  const rx = fw / 2 - 26;
  ctx.fillStyle = "#5b8fc9";
  rr(ctx, -rx - 7, -fh - 46, 14, fh + 40, 7);
  ctx.fill();
  rr(ctx, rx - 7, -fh - 46, 14, fh + 40, 7);
  ctx.fill();
  ctx.strokeStyle = "#f2c84b";
  ctx.lineWidth = 14;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-rx, -fh - 40);
  ctx.lineTo(rx, -fh - 40);
  ctx.stroke();
  [-1, 1].forEach(function (side) { wheel(ctx, side * (fw / 2 + 14), -24, 24, spin); });
}

// ── 트럭(옆모습, 운전석이 오른쪽): 뒤쪽(차대·짐칸 바닥·운전석)과 앞쪽(짐칸 옆판·바퀴)을 나눠 그려 짐이 사이에 들어감 ──
function truckBack(ctx, x, gy) {
  shade(ctx, x, gy, 470, 1);
  // 차대
  ctx.fillStyle = "#4b5654";
  rr(ctx, x - 205, gy - 80, 408, 24, 6);
  ctx.fill();
  // 짐칸 바닥·앞 칸막이
  ctx.fillStyle = "#a3b3ba";
  rr(ctx, x - 212, gy - 104, 288, 26, 4);
  ctx.fill();
  ctx.fillStyle = "#8d9fa8";
  rr(ctx, x + 64, gy - 196, 12, 104, 3);
  ctx.fill();
  // 운전석: 흰 몸통 + 민트 띠
  ctx.save();
  ctx.shadowColor = "rgba(30,50,40,0.2)";
  ctx.shadowBlur = 12;
  const g = ctx.createLinearGradient(0, gy - 250, 0, gy - 60);
  g.addColorStop(0, "#fbfcfc");
  g.addColorStop(1, "#dce4e8");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x + 80, gy - 62);
  ctx.lineTo(x + 80, gy - 236);
  ctx.quadraticCurveTo(x + 80, gy - 250, x + 94, gy - 250);
  ctx.lineTo(x + 160, gy - 250);
  ctx.quadraticCurveTo(x + 176, gy - 250, x + 184, gy - 236);
  ctx.lineTo(x + 208, gy - 178);
  ctx.quadraticCurveTo(x + 214, gy - 166, x + 214, gy - 150);
  ctx.lineTo(x + 214, gy - 74);
  ctx.quadraticCurveTo(x + 214, gy - 62, x + 202, gy - 62);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // 창문
  const wg = ctx.createLinearGradient(x + 96, gy - 236, x + 200, gy - 176);
  wg.addColorStop(0, "#d6ecf7");
  wg.addColorStop(1, "#8fc2de");
  ctx.fillStyle = wg;
  ctx.beginPath();
  ctx.moveTo(x + 96, gy - 236);
  ctx.lineTo(x + 166, gy - 236);
  ctx.lineTo(x + 194, gy - 178);
  ctx.lineTo(x + 96, gy - 178);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#6cc596";
  ctx.fillRect(x + 80, gy - 152, 134, 18);
  // 문 이음선·손잡이, 전조등, 범퍼
  ctx.strokeStyle = "rgba(90,110,115,0.35)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + 176, gy - 176);
  ctx.lineTo(x + 176, gy - 74);
  ctx.stroke();
  ctx.fillStyle = "#8d9ca2";
  rr(ctx, x + 154, gy - 126, 16, 6, 3);
  ctx.fill();
  ctx.fillStyle = "#ffd36b";
  rr(ctx, x + 204, gy - 112, 12, 20, 5);
  ctx.fill();
  ctx.fillStyle = "#59645f";
  rr(ctx, x + 186, gy - 72, 34, 14, 5);
  ctx.fill();
}
function truckFront(ctx, x, gy) {
  // 짐칸 옆판(낮은 난간): 실린 짐의 아랫부분을 가림
  const pg = ctx.createLinearGradient(0, gy - 132, 0, gy - 96);
  pg.addColorStop(0, "#c6d3d8");
  pg.addColorStop(1, "#aebec5");
  ctx.fillStyle = pg;
  rr(ctx, x - 214, gy - 132, 292, 36, 4);
  ctx.fill();
  ctx.strokeStyle = "rgba(80,100,108,0.35)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  [-140, -68, 4].forEach(function (o) { ctx.moveTo(x + o, gy - 128); ctx.lineTo(x + o, gy - 100); });
  ctx.stroke();
  // 바퀴: 지나온 거리만큼 굴러감
  const spin = (x - TRUCK_X) / 34;
  wheel(ctx, x - 132, gy - 34, 34, spin);
  wheel(ctx, x + 140, gy - 34, 34, spin);
}

// 바퀴: 검은 타이어 + 은색 휠 + 바퀴살(a = 돈 각도)
function wheel(ctx, x, y, r, a) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "#2f3533";
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#cfd6d9";
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.55, 0, TAU);
  ctx.fill();
  ctx.rotate(a);
  ctx.strokeStyle = "#8e999d";
  ctx.lineWidth = Math.max(2, r * 0.1);
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const t = i * TAU / 5;
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(t) * r * 0.5, Math.sin(t) * r * 0.5);
  }
  ctx.stroke();
  ctx.fillStyle = "#6f7b7f";
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.15, 0, TAU);
  ctx.fill();
  ctx.restore();
}

// 효과음 (3D 장면과 같은 순간)
function sounds(v) {
  if (hit(v, "book", 0.05)) sfx.play("pop");          // 휴대폰 퐁 등장
  if (hit(v, "book", 0.53)) sfx.play("tap");          // 화면 톡
  if (hit(v, "book", 0.6)) sfx.play("beep");          // 예약 완료 띠링
  if (hit(v, "pickup", 0.01)) sfx.play("roll", 0.75); // 손수레 들어옴
  if (hit(v, "pickup", 0.42)) sfx.play("tap");        // 냉장고가 기울어 실림
  if (hit(v, "pickup", 0.5)) sfx.play("roll", 1.5);   // 실어 나감
  if (hit(v, "small", 0.18) || hit(v, "small", 0.24)) sfx.play("tap"); // 주전자·선풍기 톡톡
  if (hit(v, "small", 0.85)) sfx.play("stick");       // 접수증 착
  if (hit(v, "small", 0.95)) sfx.play("chime");       // 끝 띵동
}
