// 3D 체험 효과음: 소리 파일 없이 Web Audio로 그 자리에서 만들어 냄 (용량 0, 짧고 부드럽게, 작은 소리)
// 기본은 꺼짐. 체험 창의 [data-eco-sound] 버튼으로 켜고 끄며, 켠 상태는 이 브라우저에 기억함(localStorage)
// 장면은 hit(v, 값 이름, 진행률)로 "이번 그림에서 그 순간을 지났는지" 확인한 뒤 sfx.play(소리 이름)를 부름
//  - v.$sound: 체험 창의 3D만 true (카드 미리보기 3D는 소리 없음, eco3d.js createView가 정함)
//  - v.$k0·v.$p0: 이번 그림 직전의 움직이는 값과 진행률 (eco3d.js가 기록)
const KEY = "eco-sound";
let on = false;
try { on = localStorage.getItem(KEY) === "1"; } catch (e) { /* 저장소를 못 쓰면 꺼짐으로 */ }
let ctx = null, master = null, noiseBuf = null;

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.32;
    master.connect(ctx.destination);
    // 흰 소음 1초 (물·비닐·찌그럭 소리의 재료)
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

// 소리 조각: 소음(필터 거침) / 음(주파수가 미끄러짐), 둘 다 짧게 커졌다 사라짐
function noise(t, dur, type, freq, q, gain, sweepTo) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, t);
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.02, dur / 4));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.05);
  return g;
}
function tone(t, dur, wave, from, to, gain) {
  const o = ctx.createOscillator();
  o.type = wave;
  o.frequency.setValueAtTime(from, t);
  o.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

const SOUNDS = {
  // 뚜껑 돌릴 때 틱
  tick: function (t) { noise(t, 0.03, "bandpass", 3200, 6, 0.35); },
  // 뚜껑이 빠질 때 퐁
  pop: function (t) { tone(t, 0.09, "sine", 900, 320, 0.4); },
  // 작은 물건이 바닥에 톡
  tap: function (t) { tone(t, 0.06, "triangle", 520, 220, 0.3); noise(t, 0.03, "lowpass", 1800, 1, 0.15); },
  // 뚜껑을 다 잠갔을 때 딸깍
  click: function (t) { noise(t, 0.025, "bandpass", 4200, 8, 0.4); tone(t + 0.01, 0.04, "square", 1800, 1400, 0.06); },
  // 쪼르륵 쏟기: 물소리 대역 소음을 빠르게 출렁이게
  pour: function (t, dur) {
    const g = noise(t, dur, "bandpass", 900, 2.5, 0.5, 1300);
    const lfo = ctx.createOscillator(), depth = ctx.createGain();
    lfo.frequency.value = 9;
    depth.gain.value = 0.25;
    lfo.connect(depth).connect(g.gain);
    lfo.start(t);
    lfo.stop(t + dur);
  },
  // 수도꼭지 물줄기 (조금 더 높고 고른 소리)
  water: function (t, dur) { noise(t, dur, "bandpass", 2400, 1.2, 0.3); },
  // 라벨 떼는 슥
  peel: function (t) { noise(t, 0.45, "highpass", 1200, 0.8, 0.25, 4000); },
  // 찌그럭: 짧은 소음이 불규칙하게 이어짐 (metal이면 금속 울림을 섞음)
  crunch: function (t, dur, metal) {
    const n = Math.round(dur / 0.06);
    for (let i = 0; i < n; i++) {
      const at = t + (i / n) * dur + Math.random() * 0.03;
      noise(at, 0.05, "bandpass", metal ? 2600 + Math.random() * 1500 : 1500 + Math.random() * 1500, 3, 0.35 + Math.random() * 0.2);
    }
    if (metal) tone(t, dur, "sine", 1900, 1500, 0.05);
  },
  // 수거함에 통
  thud: function (t) { tone(t, 0.22, "sine", 150, 70, 0.6); noise(t, 0.08, "lowpass", 600, 1, 0.3); },
  // 비닐 바스락: 높은 소음이 잘게 불규칙하게
  rustle: function (t, dur) {
    const n = Math.round(dur / 0.045);
    for (let i = 0; i < n; i++) noise(t + (i / n) * dur + Math.random() * 0.02, 0.04, "bandpass", 3500 + Math.random() * 2500, 2, 0.12 + Math.random() * 0.12);
  },
  // 종이 사각사각 (바스락보다 낮고 성기게)
  paper: function (t, dur) {
    const n = Math.round(dur / 0.08);
    for (let i = 0; i < n; i++) noise(t + (i / n) * dur + Math.random() * 0.03, 0.06, "bandpass", 1800 + Math.random() * 1200, 1.5, 0.12 + Math.random() * 0.1);
  },
  // 테이프 찌익: 올라가는 소음에 빠른 떨림
  rip: function (t) {
    const g = noise(t, 0.35, "bandpass", 1600, 3, 0.35, 4800);
    const lfo = ctx.createOscillator(), depth = ctx.createGain();
    lfo.type = "sawtooth";
    lfo.frequency.value = 45;
    depth.gain.value = 0.2;
    lfo.connect(depth).connect(g.gain);
    lfo.start(t);
    lfo.stop(t + 0.35);
  },
  // 유리 쨍 (병이 닿거나 들어갈 때)
  clink: function (t) { tone(t, 0.35, "sine", 2600, 2550, 0.12); tone(t, 0.25, "sine", 3900, 3850, 0.06); },
  // 뚜껑·덮개 탁 닫힘
  lid: function (t) { tone(t, 0.12, "triangle", 300, 120, 0.4); noise(t, 0.05, "lowpass", 900, 1, 0.25); },
  // 휴대폰 확인음 띠링
  beep: function (t) { tone(t, 0.09, "square", 1200, 1200, 0.05); tone(t + 0.11, 0.12, "square", 1600, 1600, 0.05); },
  // 손수레 바퀴 구르는 소리 (낮게 웅웅)
  roll: function (t, dur) {
    const g = noise(t, dur, "lowpass", 320, 1, 0.35);
    const lfo = ctx.createOscillator(), depth = ctx.createGain();
    lfo.frequency.value = 7;
    depth.gain.value = 0.12;
    lfo.connect(depth).connect(g.gain);
    lfo.start(t);
    lfo.stop(t + dur);
  },
  // 휙 (물건이 날아갈 때)
  whoosh: function (t) { noise(t, 0.32, "bandpass", 500, 1.5, 0.22, 1800); },
  // 쏙 (봉투·투입구로 들어갈 때)
  slide: function (t) { noise(t, 0.18, "bandpass", 1600, 2, 0.22, 700); },
  // 건전지 달그락
  rattle: function (t) { for (let i = 0; i < 3; i++) tone(t + i * 0.05 + Math.random() * 0.02, 0.05, "triangle", 2000 + Math.random() * 800, 1400, 0.12); },
  // 스티커·필증 착 붙음
  stick: function (t) { noise(t, 0.05, "lowpass", 2500, 1, 0.3); tone(t, 0.05, "sine", 420, 300, 0.15); },
  // 끈 묶기 슥슥
  tie: function (t) { noise(t, 0.12, "bandpass", 2200, 2, 0.2, 3200); noise(t + 0.16, 0.12, "bandpass", 2200, 2, 0.2, 3200); },
  // 끝까지 봤을 때 띵동
  chime: function (t) { tone(t, 0.5, "sine", 880, 880, 0.18); tone(t + 0.16, 0.7, "sine", 1318, 1318, 0.16); }
};

export const sfx = {
  isOn: function () { return on; },
  set: function (value) {
    on = !!value;
    try { localStorage.setItem(KEY, on ? "1" : "0"); } catch (e) { /* 기억 못 해도 동작은 함 */ }
    if (on) audio();
  },
  play: function (name, dur, opt) {
    if (!on || document.hidden || !audio()) return;
    if (window.__ecoSoundLog) window.__ecoSoundLog.push(name); // 점검용 기록 (평소엔 없음)
    SOUNDS[name](ctx.currentTime + 0.005, dur || 0.3, opt);
  }
};

// 이번 그림에서 key 값의 진행률이 at을 지났는지 (체험 창 3D이고 효과음이 켜졌을 때만)
export function hit(v, key, at) {
  if (!on || !v.$sound) return false;
  const p0 = v.$k0 === key ? v.$p0 : v.$key === key ? 0 : -1;
  if (p0 < 0) return false;
  const p1 = v.$key === key ? v.$p : 1;
  return p0 < at && p1 >= at;
}
