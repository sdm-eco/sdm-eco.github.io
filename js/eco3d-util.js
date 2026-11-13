// 체험 장면(그림 2D)들이 함께 쓰는 움직임 계산 도우미
// (파일 이름은 3D 장면 시절 그대로. 3D 장면을 없애면서 그림 장면이 쓰는 것만 남김)

// 오래된 브라우저(Safari 16·Firefox 112 이전)에는 둥근 사각형 그리기(roundRect)가 없음
// → 없을 때만 같은 모양을 arcTo로 그리는 대체 함수를 붙임. 반지름은 숫자 하나 또는 [왼위, 오위, 오아래, 왼아래](이 사이트가 쓰는 형태)
if (typeof CanvasRenderingContext2D !== "undefined" && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    const a = Array.isArray(r) ? r : [r, r, r, r];
    const k = function (v) { return Math.max(0, Math.min(v || 0, Math.abs(w) / 2, Math.abs(h) / 2)); };
    this.moveTo(x + k(a[0]), y);
    this.arcTo(x + w, y, x + w, y + h, k(a[1]));
    this.arcTo(x + w, y + h, x, y + h, k(a[2]));
    this.arcTo(x, y + h, x, y, k(a[3]));
    this.arcTo(x, y, x + w, y, k(a[0]));
    this.closePath();
  };
}

export function clamp01(x) { return Math.min(1, Math.max(0, x)); }
export function smooth(a, b, x) { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); }
export function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
export function backOut(t) { const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }
export function lerp(a, b, t) { return a + (b - a) * t; }

// 정해진 순서로 나오는 난수 (매번 같은 배치를 만들 때)
export function seeded(seed) {
  return function () {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
}

// 부드러운 움직임 곡선
// 기울여 쏟기(p 0~1): 살짝 뒤로 젖혔다가(준비) → 기울여 머묾 → 바로 세울 때 살짝 지나쳤다 돌아옴
export function tiltCurve(p) {
  const prep = p < 0.12 ? -0.06 * Math.sin(Math.PI * p / 0.12) : 0;
  const up = easeInOut(clamp01((p - 0.1) / 0.25));
  const back = backOut(clamp01((p - 0.72) / 0.28));
  return up * (1 - back) + prep;
}
// 통통 튀며 내려앉기: 0→1로 갈 때 바닥에 닿고 두 번 작게 튐 (높이 비율 반환, 0이 바닥)
export function bounceDrop(t) {
  t = clamp01(t);
  if (t < 0.6) return 1 - Math.pow(t / 0.6, 2);
  if (t < 0.85) return 0.18 * Math.sin(Math.PI * (t - 0.6) / 0.25);
  return 0.05 * Math.sin(Math.PI * (t - 0.85) / 0.15);
}
// 내려앉은 뒤 흔들림이 잦아듦 (t 0~1, 진폭 1에서 0으로)
export function wobble(t, times) {
  t = clamp01(t);
  return Math.sin(t * Math.PI * 2 * (times || 3)) * Math.pow(1 - t, 2);
}
