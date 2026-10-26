// 영상·게임 연결 설정
// 값이 비어 있으면 "준비 중" 화면이 보이고, 값을 넣으면 그 자리에 바로 연결됩니다.
window.SITE_CONFIG = {
  videos: [
    // 유튜브 주소의 영상 ID (예: https://youtu.be/AbCdEf12345 → "AbCdEf12345")
    { youtubeId: "" },
    { youtubeId: "" }
  ],
  game: {
    // 게임 주소 (예: "https://sdm-eco.github.io/sorting-game/")
    url: "",
    // true: 이 페이지 안에 띄우기, false: 새 창으로 열기
    embed: true
  }
};
