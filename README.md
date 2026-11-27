# 웹 DB 공개 변경 기록

이 브랜치는 제작소 DB의 공개 게임 자료를 항목별 파일로 나눠 보관한다.
GitHub Actions(`Record web DB history`)가 한 시간마다 앱과 같은 최신 공개 조회(지금은 `poc_bootstrap216`, view=game)를 읽고,
바뀐 것이 있을 때만 커밋한다. DB는 바꾸지 않고, 공개 키 외의 비밀은 쓰지 않는다.

- 최근 변경 요약: [LATEST.md](LATEST.md)
- 개정 사이 비교: 커밋 기록, 또는 `compare/<이전 커밋>...<다음 커밋>`
- 폴더: `game/catalog` 카드, `game/characters` 캐릭터, `game/opponents` 상대 편성·챕터,
  `game/deck_rules035` 덱 금제, `game/content022` 유물·이벤트, `practice-decks` 연습 덱, `map-rules.json` 지도 규칙

한계: 한 시간 안의 여러 수정은 한 커밋으로 합쳐진다. 누가 고쳤는지는 공개 자료에 없어서 기록하지 않는다.
