// 영상·게임 연결 설정
// 값이 비어 있으면 "준비 중" 화면이 보이고, 값을 넣으면 그 자리에 바로 연결됩니다.
// 주소는 이 사이트(sdm-eco.github.io) 안의 파일만 씁니다(보안 정책상 다른 사이트의 영상·자막은 막힘).
//   예) 별도 저장소 sdm-eco/media 를 GitHub Pages로 열면 그 안의 파일 주소는 "/media/파일 이름"
window.SITE_CONFIG = {
  videos: [
    // src: 영상 파일(mp4). 파일 하나 100MB 미만(GitHub 한도), 3~5분·720p로 압축
    // poster: 누르기 전에 보이는 대표 그림(jpg·webp). 비우면 "영상 보기" 단색 화면
    // captions: 언어별 자막 파일(WebVTT, .vtt). 사이트 언어에 맞는 자막이 자동으로 켜지고, 영상 아래 '자막' 단추로 다른 언어를 고르거나 끌 수 있음
    // 영상은 재생 버튼을 누를 때만 받음(누르기 전에는 대표 그림만)
    // 1편 기초편(3분 판): 720p · 3분 00초 · 29MB. 화면 글자는 한국어이고 자막은 영상에 넣지 않고 파일로 따로 붙임
    //   자막 4개 언어(media/ep1.*.vtt): 한국어는 내레이션만, 중국어 · 영어 · 베트남어는 내레이션 + 화면 글자 설명([On screen] …)
    // 소리는 완성본의 70%로 줄여 넣음(-3.1dB, 예전 파일과 같게). 파일을 바꾸면 ?v= 값을 올릴 것(브라우저가 예전 파일을 쓰지 않게)
    { src: "media/ep1.mp4?v=20261123a", poster: "",
      captions: { ko: "media/ep1.ko.vtt?v=20261123b", zh: "media/ep1.zh.vtt?v=20261123b", en: "media/ep1.en.vtt?v=20261123b", vi: "media/ep1.vi.vtt?v=20261123b" } },
    { src: "", poster: "", captions: { ko: "", zh: "", en: "", vi: "" } }
  ],
  game: {
    // 게임 주소: 지금은 팀원이 올려 둔 시연판(다른 사이트). 이 사이트 안(/game/)으로 옮기면 "/game/"으로 바꿀 것
    // 이 사이트 안 주소일 때만 페이지를 열 때 있는지 확인하고, 없으면 "준비 중"으로 보임
    url: "https://sdm-eco.vercel.app/game/",
    // true: 이 페이지 안에 띄우기(다른 사이트 주소면 index.html의 frame-src에도 그 주소를 넣어야 함), false: 새 창으로 열기
    embed: false
  }
};
