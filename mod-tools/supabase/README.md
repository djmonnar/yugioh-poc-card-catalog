# Supabase AI 덱 저장

웹 편집기: 이메일 로그인 → 적용 상대 선택 → 저장. GitHub 이슈를 제출하지 않는다.
도감 카드 상세: `게임 설정 바로 저장`에서 등급과 `상점에서 이 카드 판매`를 고르고 저장한다. 등급에 맞춘 구매·판매 가격도 함께 반영된다. 기존 검토 의견은 별도로 보존한다.
PC 실행기는 공개 덱 데이터만 읽는다. 인증 토큰·이메일·secret/service_role 키를 저장하거나 사용하지 않는다.

## 데이터와 권한

- `poc_private`: 편집 이메일 허용 목록, 현재 카드 ID·금제, 적용 대상, 변경 이력. Data API에 노출하지 않고 모든 클라이언트 권한을 회수하며 RLS를 켠다.
- `poc_ai_decks`: 저장된 게임 상대 덱. 기존 공개 도감과 같이 누구나 읽을 수 있다. 직접 INSERT/UPDATE/DELETE 권한은 없다.
- `poc_save_ai_deck`: 확인된 이메일과 허용 목록을 검사한 뒤 카드 수, 그룹, 금제, 대상 원본, 카드 identity를 검증한다. 표시했던 버전과 다르면 `poc_conflict`로 거부한다.
- `poc_load_ai_decks`: 공개 레시피만 반환한다. 계정 정보와 변경 이력은 포함하지 않는다.
- `poc_card_settings`: 현재 identity와 맞는 등급·상점 판매 설정만 공개한다. 저장 RPC는 같은 이메일 허용 목록과 버전 검사를 사용한다. 토큰·특수 카드는 직접 상품으로 추가할 수 없다.
- 공식 `@supabase/supabase-js` 2.117.2를 로컬 번들로 사용한다. `npm ci --ignore-scripts` 후 `npm run build:cloud`.

## 새 프로젝트 설치

`001_ai_decks.sql`을 SQL Editor에서 실행한다. SQL 자체가 공개·비공개 테이블의 RLS를 모두 활성화한다.
이어서 `002_card_settings.sql`을 실행한다.
스토리 제작 온라인 저장은 `003_story_authoring.sql`이다. 제작 문서를 저장하며 게임 보상을 지급하지 않는다.
기존 프로젝트의 도감 갱신은 `prepare_update.py`가 만든 `.local-cloud/catalog-story-update.sql`을 실행한다.
해피 레이디 5종의 합산 3장 검사와 스토리 저장도 이 갱신에 포함된다. `prepare_story_checks.py`는
실제 DB의 저장·읽기·충돌·신원 오류·비소유자 수정 거부·해피 4장 거부를 전체 rollback으로 검사한다.
`prepare_seed.py --owner-email <소유자 이메일>`은 현재 도감·상대 원본과 비공개 허용 목록을 `.local-cloud/bootstrap.sql`에 준비한다. 이 디렉터리는 Git에서 제외한다.
현재 dataset은 한 개만 유지해야 한다. 카드 변경 배포 시 서버 seed도 갱신하고 오래된 저장 레시피는 새 도감에서 검토한 뒤 다시 저장한다.
Auth Site URL은 실제 `ai-decks.html` 주소로 설정한다. 이메일 링크를 받은 사용자가 직접 인증을 완료한다.
`data/cloud-config.json`에는 HTTPS 프로젝트 URL과 **publishable 키**만 넣는다.

## 검증과 PC 연결

`prepare_checks.py`는 실제 DB에서 저장·충돌·잘못된 identity·null 카드 수·비소유자 수정 거부를 확인한 뒤 전체 테스트 트랜잭션을 rollback하는 SQL을 만든다. 테스트 인증 계정과 레시피는 남기지 않는다.
`check_public.py`는 공개 REST 읽기와 익명 수정 거부를 확인한다.
PC `config/ai_sync.json`의 `backend: supabase`는 공개 읽기 어댑터를 선택한다. 기존 `github` 방식도 남아 있다.
네트워크 오류 시 기존 상대 덱으로 실행한다. 내려받은 JSON은 기존 공통 validator와 잠금·백업·journal을 거쳐 게임이 닫혀 있을 때만 적용된다.
Native journal v1의 `issue_number` 필드는 Supabase 어댑터에서 양의 source version으로 매핑한다. `provider`는 `supabase`로 기록한다.
`config/card_settings_sync.json`의 enabled 설정은 PC 상점 동기화를 켠다. 다음 창모드 실행 때 설정을 한 번 확인하고, 새 상점 서버는 실행 중 10초마다 공개 설정을 읽는다. 로컬 거래 처리 시 현재 native 카드 identity와 맞는 설정만 적용한다. 기존 상점·게임 프로세스는 새 코드를 읽도록 한 번 다시 열어야 한다.
등급 변경은 상점 가격·판매 목록·뽑기 등급과 웹 도감에 반영된다. 이미 만들어진 게임 카드 그림의 레어 마크는 별도 이미지 재생성 작업이 필요하다.
플레이 메모는 AI 코드를 자동 생성하지 않는다. 세이브·보유 카드·골드는 클라우드에 올리지 않는다.
