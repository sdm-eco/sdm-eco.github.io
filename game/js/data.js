// 품목 · 받는 곳 · 도구 — 기준: 시놉시스 + 홈페이지 배출방법 안내
// 그림은 홈페이지 저장소(sdm-eco.github.io/img)의 그림을 그대로 쓰고, 없는 품목만 같은 그림체로 더 그림(img/item/new)
(function () {
  // 수거함 그림의 이름표 자리(원본 픽셀, 홈페이지 meta.json 값): [x, y, w, h, 원본 폭, 원본 높이]
  // 공식 분리배출 표시가 있는 통은 표시만, 없는 통은 이름만 씀(홈페이지 수거함 이름표와 같은 원칙)
  const DEST = {
    general:   { img: "item/common/bag-general.webp", grp: "general" },
    food:      { img: "item/common/bag-food.webp", grp: "food" },
    other:     { img: "item/new/bag-other.webp", grp: "general" },
    pet:       { img: "item/pet/bin.webp", grp: "recycle", mark: "pet", plate: [140, 139, 162, 87, 362, 440] },
    can:       { img: "item/can/bin.webp", grp: "recycle", mark: "can", plate: [140, 141, 162, 86, 365, 440] },
    carton:    { img: "item/carton/bin.webp", grp: "recycle", mark: "carton", plate: [139, 140, 161, 86, 361, 440] },
    glass:     { img: "item/glass/bin.webp", grp: "recycle", mark: "glass", plate: [140, 140, 159, 86, 361, 440] },
    sack:      { img: "item/new/ppsack.webp", grp: "special", text: "plate.sack", plate: [80, 170, 190, 110, 343, 440] },
    medicine:  { img: "item/medicine/bin.webp", grp: "special", text: "plate.medicine", plate: [113, 198, 146, 78, 300, 480] },
    battery:   { img: "item/battery/bin.webp", grp: "special" },
    clothes:   { img: "item/new/clothesbin.webp", grp: "special", text: "plate.clothes", plate: [101, 179, 130, 89, 271, 440] },
    bulky:     { img: "cat/bulky.webp", grp: "special", sticker: true },
    appliance: { phone: true, grp: "special" }
  };

  // 품목: dest = 맞는 곳, prep = 손질 순서(도구 이름), states = 손질 단계마다 바뀌는 그림, w = 놀이판 크기(설계 px)
  const ITEMS = {
    banana:      { img: "item/new/banana.webp", dest: "food", w: 120 },
    tangerine:   { img: "item/new/tangerine.webp", dest: "food", w: 120 },
    leftover:    { img: "item/food/mound.webp", dest: "food", w: 120 },
    bone:        { img: "item/food/bone.webp", dest: "general", w: 116 },
    pit:         { img: "item/food/pit.webp", dest: "general", w: 84 },
    egg:         { img: "item/food/egg.webp", dest: "general", w: 104 },
    shell:       { img: "item/food/shell.webp", dest: "general", w: 110 },
    pineapple:   { img: "item/new/pineapple.webp", dest: "general", w: 126 },
    tissue:      { img: "item/general/tissue.webp", dest: "general", w: 104 },
    receipt:     { img: "item/confuse/receipt.webp", dest: "general", w: 96 },
    chopsticks:  { img: "item/confuse/chopsticks.webp", dest: "general", w: 116 },
    toothbrush:  { img: "item/confuse/toothbrush.webp", dest: "general", w: 110 },
    // 페트병: 뚜껑은 마지막 '뚜껑 닫기'에서만 생김 (찌그러뜨린 뒤 = 뚜껑 없는 crushed-open, 뚜껑 닫은 뒤 = crushed)
    pet:         { img: "item/pet/bottle-full.webp", dest: "pet", prep: ["empty", "label", "crush", "cap"], w: 130,
                   states: ["item/pet/bottle-full.webp", "item/pet/bottle-empty.webp", "item/pet/bottle-bare.webp", "item/pet/crushed-open.webp", "item/pet/crushed.webp"] },
    can:         { img: "item/can/can.webp", dest: "can", prep: ["empty", "rinse", "crush"], w: 104,
                   states: ["item/can/can.webp", "item/can/can.webp", "item/can/can.webp", "item/can/crushed.webp"] },
    carton:      { img: "item/carton/carton.webp", dest: "carton", prep: ["empty", "rinse", "flatten"], w: 112,
                   states: ["item/carton/carton.webp", "item/carton/carton.webp", "item/carton/carton.webp", "item/carton/flat.webp"] },
    brokenglass: { img: "item/new/brokenglass.webp", dest: "sack", prep: ["wrap"], w: 138,
                   states: ["item/new/brokenglass.webp", "item/new/wrapped.webp"] },
    butane:      { img: "item/new/butane.webp", dest: "can", prep: ["gas"], trapTool: "punch", w: 116 },
    pills:       { img: "item/medicine/blister.webp", dest: "medicine", w: 96 },
    syrup:       { img: "item/medicine/syrup.webp", dest: "medicine", w: 96 },
    battery:     { img: "item/battery/cell.webp", dest: "battery", w: 70 },
    clothes:     { img: "item/new/clothes.webp", dest: "clothes", w: 140 },
    blanket:     { img: "item/new/blanket.webp", dest: "bulky", prep: ["report"], w: 150 },
    chair:       { img: "item/bulky/chair.webp", dest: "bulky", prep: ["report"], w: 130 },
    fridge:      { img: "item/appliance/fridge.webp", dest: "appliance", w: 150 },
    fan:         { img: "item/appliance/fan.webp", dest: "appliance", w: 130 },
    // 이야기 전용
    trash:       { img: "item/general/tissue.webp", dest: "general", w: 130, name: "item.trash" },
    bagfull:     { img: "item/common/bag-general.webp", dest: null, w: 150, name: "item.bagfull" },
    bagmixed:    { img: "item/common/bag-general.webp", dest: null, w: 150, name: "item.bagmixed" }
  };

  // 도구 아이콘: 그림이 있는 것은 홈페이지 그림, 없는 것은 선 그림(SVG)
  const S = (d) => `<svg viewBox="0 0 48 48" fill="none" stroke="#1d7a43" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const TOOLS = {
    empty:   { svg: S('<path d="M14 10h16l-3 30H17z"/><path d="M30 14l8-4"/><path d="M36 24c0 3-2 5-4 5s-4-2-4-5 4-8 4-8 4 5 4 8z" fill="#cde1f9"/>') },
    rinse:   { img: "item/common/faucet.webp" },
    label:   { svg: S('<rect x="12" y="16" width="20" height="18" rx="3"/><path d="M32 18l8-6"/><path d="M32 30c4 0 7 2 9 5" /><path d="M16 22h10M16 28h8"/>') },
    crush:   { svg: S('<path d="M10 14h28"/><path d="M24 6v8"/><path d="M14 22l4 18h12l4-18"/><path d="M17 26l6 4 6-4"/>') },
    cap:     { svg: S('<rect x="15" y="8" width="18" height="8" rx="2" fill="#cde1f9"/><path d="M17 16v4h14v-4"/><path d="M19 20l-3 20h16l-3-20"/><path d="M24 26v8M20 30l4 4 4-4"/>') },
    flatten: { svg: S('<path d="M8 36l16-6 16 6-16 6z" fill="#e3f4e8"/><path d="M16 24l8-14 8 14"/><path d="M24 22v6"/>') },
    wrap:    { img: "item/new/paper.webp" },
    gas:     { svg: S('<rect x="16" y="14" width="14" height="28" rx="4"/><path d="M20 14V9h6v5"/><path d="M30 10c4 0 6-2 8-4M30 14c5 0 8 1 10 3M29 18c4 1 6 3 7 6" stroke="#9fcf7a"/>') },
    punch:   { svg: S('<path d="M8 40l14-14"/><path d="M22 26l6-6 8 8-6 6z" fill="#fde0dc"/><path d="M34 14l4-4"/><circle cx="36" cy="36" r="6" stroke="#b42318"/><path d="M32 32l8 8" stroke="#b42318"/>') },
    report:  { svg: S('<rect x="10" y="10" width="28" height="28" rx="4" fill="#ffd34d" stroke="#8a5a00"/><path d="M16 20h16M16 26h10" stroke="#8a5a00"/><path d="M28 32l3 3 6-7" stroke="#8a5a00"/>') }
  };

  // 국제 공용 재활용 표시(돌아가는 화살표 세 개) — 공식 분리배출 표시가 정해지지 않은 자리에 씀
  const RECYCLE_SVG = (color) => `<svg viewBox="0 0 100 100" aria-hidden="true"><g fill="${color || "currentColor"}">${[0, 120, 240].map(r =>
    `<g transform="rotate(${r} 50 54)"><path d="M41 18c4-6 14-6 18 0l11 19-9 5 17 7 2-19-8 5-11-19c-6-11-24-11-30 0l-2 3 10 6z"/></g>`).join("")}</g></svg>`;

  window.GAMEDATA = { DEST, ITEMS, TOOLS, RECYCLE_SVG };
})();
