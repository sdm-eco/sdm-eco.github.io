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
    { src: "", poster: "", captions: { ko: "", zh: "", en: "", vi: "" } },
    { src: "", poster: "", captions: { ko: "", zh: "", en: "", vi: "" } }
  ],
  game: {
    // 게임 주소: 별도 저장소 sdm-eco/game 을 GitHub Pages로 열면 "/game/"
    // 아직 올리지 않았으면 "게임 시작"을 눌러도 "준비 중"으로 보임 (페이지를 열 때 있는지 확인함)
    url: "/game/",
    // true: 이 페이지 안에 띄우기, false: 새 창으로 열기
    embed: true
  }
};
