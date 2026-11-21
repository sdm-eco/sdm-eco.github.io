// 영상·게임 연결 설정
// 값이 비어 있으면 "준비 중" 화면이 보이고, 값을 넣으면 그 자리에 바로 연결됩니다.
// 주소는 이 사이트(sdm-eco.github.io) 안의 파일만 씁니다(보안 정책상 다른 사이트의 영상·자막은 막힘).
//   예) 별도 저장소 sdm-eco/media 를 GitHub Pages로 열면 그 안의 파일 주소는 "/media/파일 이름"
window.SITE_CONFIG = {
  videos: [
    // src: 영상 파일(mp4). 파일 하나 100MB 미만(GitHub 한도), 3~5분·720p로 압축
    // poster: 누르기 전에 보이는 대표 그림(jpg·webp). 비우면 "영상 보기" 단색 화면
    // captions: 언어별 자막 파일(WebVTT, .vtt). 사이트 언어에 맞는 자막이 자동으로 켜짐
    // 영상은 재생 버튼을 누를 때만 받음(누르기 전에는 대표 그림만)
    // 1편 기초편: 480p · 2분 27초 · 16MB. 한국어 · 영어 자막이 영상에 들어 있어 자막 파일은 비움
    // 소리는 받은 원본의 70%로 줄여 넣음(-3.1dB). 파일을 바꾸면 ?v= 값을 올릴 것(브라우저가 예전 파일을 쓰지 않게)
    { src: "media/ep1.mp4?v=20261121b", poster: "", captions: { ko: "", zh: "", en: "", vi: "" } },
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
