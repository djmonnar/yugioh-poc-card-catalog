# 콘텐츠 제작 파이프라인 v1

목표는 같은 자료에서 스토리, 상대 덱, 로그라이트 기믹, 카드와 그림을 제작하고,
Claude와 Codex가 동일한 검사·빌드·적용 경로를 쓰는 것이다.
이번 버전은 **작성 규격 → 참조/신원 검사 → 해시가 있는 검토 묶음**을 구현했다.
검사 도구는 콘텐츠 소스를 실행하거나 게임·세이브·골드를 수정하지 않는다.

## 현재 연결 범위

| 분야 | 현재 가능한 작업 | 다음 연결 |
|---|---|---|
| 상대 덱 | 도감 편집, 일반/스피드 구분, 온라인 저장, 다음 창모드 실행 때 적용 | 행동 메모를 실제 AI 정책으로 구현 |
| 카드 | 기존 신원 검사, 수정/교체/추가 후보 선언, 효과·AI 소스와 해시 묶기 | 기존 네이티브 후보 빌더와 도감 갱신 연결 |
| 스토리 | 대사·선택·듀얼·승패 분기 작성, 등장인물/덱 참조, 도달·종료 가능성 검사 | 게임 내 대사 UI와 스토리 진행 저장 |
| 로그라이트 | 모드별 상대 풀, run 이벤트와 기믹/구현 소스 선언 | 별도 run 상태, 지도/보상 UI, 듀얼 전후 이벤트 |
| 그림/음성 | 상대경로 파일, 타입·크기·해시 검사와 후보 묶기 | 실제 픽셀/음성 규격 검사, 변환기, 리소스 패킹 |

`check` 성공은 데이터 구조 검사다. 카드 효과의 정확성, AI 판단, 실행 화면,
듀얼링크스 전체 규칙이 구현됐다는 뜻이 아니다. `candidate`도 출시 인증이 아니다.
결과의 `capabilities`와 `engine_applied:false`가 실행 준비 상태를 표시한다.

## 작성과 실행

저장소의 `content-packs/<고정 ID>/pack.json`에 작성한다.
`content-packs/pipeline-demo/pack.json`은 첫 듀얼 대사 → 듀얼 → 승리/재도전 분기와
로그라이트 보상 기믹의 **미실행 예제**다. 상대 덱은 기존 `cpu_000.ydc`를 참조한다.
이 예제를 검사하거나 묶어도 게임에 새 스토리나 보상이 생기지 않는다.

프로젝트 최상위 PowerShell에서:

```powershell
.\KoreanPatch\Content-Pipeline.cmd check .\KoreanPatch\card_encyclopedia\content-packs\pipeline-demo\pack.json
.\KoreanPatch\Content-Pipeline.cmd stage .\KoreanPatch\card_encyclopedia\content-packs\pipeline-demo\pack.json --output .\KoreanPatch\content_staging
```

다른 PC/CI에서는 표준 Python 3.11 이상으로 `pipeline.py check <pack.json>`을 실행한다.
`stage`는 pack ID와 내용 해시를 디렉터리 이름으로 사용한다. 동일 결과를 덮어쓰지 않는다.
`bundle.json`에 선언과 기능별 상태, `manifest.json`에 묶음 내 파일 해시가 들어간다.
소스의 원래 위치는 `source`, 묶음 안 위치는 `bundle_path`다.
GitHub의 `Check content authoring`도 같은 검사기를 실행한다.
pack 내부의 그림·후보 소스는 `.gitattributes`에서 바이트를 보존한다.
Windows와 Linux의 자동 줄바꿈 변환으로 작성한 소스 해시가 달라지지 않게 하기 위한 규칙이다.

## 공통 규격

모든 컬렉션의 `id`는 영문 소문자·숫자·`_`·`-`로 된 고정 식별자다.
표시 이름을 바꿔도 참조용 ID는 바꾸지 않는다. 알 수 없는 필드와 중복 ID를 거부한다.
`catalog_dataset_id`는 도감의 현재 `meta.dataset_id`이며 오래된 신원을 그대로 적용하지 않는다.

- `assets`: `id`, `kind`(portrait/card_art/background/icon/audio), `source`, `sha256`.
  pack 내부의 PNG/JPEG/WebP/WAV/OGG 파일만 묶는다. 이 단계는 실제 디코딩 검사 전이다.
- `implementations`: `id`, `kind`(card_effect/ai_policy/story_event/roguelite_rule), `source`, `sha256`.
  C/H/INC/Python 후보 소스를 묶으며 import·컴파일·실행하지 않는다. EXE/DLL/세이브는 제외한다.
- `cards`: `id`, `operation`(edit/replace/add), `target`, `fields`, `effect_adapter`, `ai_adapter`.
  기존 target은 `slot/internal_id/identity_key` 모두 일치해야 한다. 새 카드는 미사용 slot/ID를
  명시한다. ID는 `fields`에서 수정할 수 없다. 효과 수정은 AI 구현과 부모 EXE 해시를 요구한다.
  `fields`는 `name_ko/description_ko/official_cid/rarity/limit/level/atk/def/race/attribute/card_type`만 사용한다.
  새 카드와 교체 카드는 최소 `name_ko/description_ko/card_type`을 선언한다.
  효과 없는 카드의 두 adapter는 null로 둔다. 카드 포함 묶음에는 도감 갱신 필요 표시가 붙는다.
- `decks`: `id`, `ruleset`(classic/duel_links_plan), `source_recipe`, 선택적인 `name/packet`.
  `source_recipe`는 도감의 감사된 상대 파일이다. `packet`에는 온라인 저장 요청 원문을 넣을 수
  있으며 AI 온라인 연동의 **동일 검사기**를 재사용한다. 단순 source 참조는 현재 덱 구성을 유지한다.
- `actors`: `id`, `name`, `portrait`(asset ID 또는 null), `decks`(덱 ID 배열).
- `story`: `id`, `title`, `start`, `nodes`.
  dialogue는 actor/text/next, duel은 actor/deck/on_win/on_loss, choice는 text/choices,
  end는 text를 가진다. choice는 `{text,next}` 배열이다. 모든 분기가 존재하고
  시작점에서 도달 가능하며 끝으로 가는 경로가 있어야 한다. 재도전 순환은 허용한다.
- `roguelite`: `id`, `ruleset`, `encounters`(같은 모드 덱 ID 배열), `rules`, `permanent_progress:false`.
  rule은 `id/description/trigger/implementation`. trigger는
  run_start/before_duel/after_win/after_loss/run_end다.
  미구현 기믹은 draft에서 implementation:null, candidate에서는 구현 소스 ID를 요구한다.

이 v1은 단일 pack의 참조를 검사한다. 여러 pack 병합·편집 웹 UI·게임 실행 어댑터는 다음 단계다.
현재 story_event 소스를 묶을 수는 있지만 스토리 노드에 연결하거나 실행하지 않는다.

## Claude/Codex 작업 계약

1. 현재 엔진 프로필과 최신 인계 문서를 먼저 읽는다. 후보 소스는 별도 작업 폴더에 작성한다.
2. 선언은 변경할 카드/덱/기믹을 명시하고 부모 빌드 해시와 파일 해시를 남긴다.
3. 카드 효과는 양측 공통 legality → 선택 → 비용 → 해결을 사용하고 AI는 판단만 별도로 만든다.
4. 묶음을 검사하고 별도 후보 빌드를 만든다. 단위/네이티브 검사 결과와 남은 기능을 기록한다.
5. 통합 담당자 하나가 후크·슬롯·ID 충돌을 확인해 합친다. 각 에이전트가 실제 게임을 따로 덮어쓰지 않는다.
6. 검증한 후보를 적용할 때 백업한다. 도감·레어도·상점·팩도 같은 카드 신원으로 갱신한다.
7. 스토리 진행과 로그라이트 run 상태는 플레이어 덱·세이브·상점 장부와 분리한다.

다음 구현 순서는 스토리 실행 어댑터의 짧은 대사 → 지정 덱 듀얼 → 승패 분기,
이어 별도 진행 저장, 로그라이트 encounter/보상 선택, 마지막으로 제작용 편집 UI다.
게임에서 검증한 경로부터 공통 어댑터로 확장한다.
