# AI 덱 온라인 저장과 게임 연동

도감의 AI 편집기와 네이티브 적용 도구를 같은 저장소에서 관리한다.
원본 EXE, 리소스 아카이브, 플레이어 덱·세이브·상점 장부는 이 도구에 포함하지 않는다.
게임은 PC에서 실행되며 공개 도감과 이 패치의 소스는 GitHub, 저장한 상대 덱 설정은 Supabase에서 관리한다.

1. 도감에서 현재 AI 덱을 가져오거나 일반/스피드 덱을 만든다.
2. **이메일로 로그인**하고 받은 링크를 직접 열어 인증한다. 등록된 소유자 이메일만 편집할 수 있다.
3. 덱 확인 항목을 해결하고 **이 덱 온라인 저장**을 누른다.
4. 바꿀 상대와 실제 등장 난이도를 확인하고 **이 상대 덱으로 저장**을 누른다.
5. 저장 성공 후 게임의 기존 한국어 창모드 바로가기로 다음 실행 시 적용한다.

다른 기기에서는 **온라인 덱 불러오기**로 검사에 통과한 최신 덱을 편집본으로 가져온다.
새 저장은 같은 상대 파일의 이전 온라인 설정을 교체한다. 희망 난이도 메모만 바꾸면
엔진의 등장 난이도 연결은 바뀌지 않는다. 저장할 때 그 난이도에 등장하는 상대를 고른다.
난이도를 공유하는 파일은 표시된 여러 난이도에 같이 반영된다.
콤보·행동 메모는 저장하지만 AI 코드를 자동 생성하지 않는다.

## 구조

- `ai-sync-core.js`: 도감 카드 신원, 매수, 규칙 검사와 압축 저장 요청 생성.
- `supabase_provider.py`: 공개 RPC에서 상대 덱을 읽어 공통 적용 형식으로 정규화한다.
- `../supabase/`: 이메일 권한, 서버 검증·버전 충돌 처리, 등급·상점 설정 SQL과 PC 동기화.
- `sync_core.py`: PC에서 내려받기, native ID 검사, YDC의 원래 8바이트 헤더 보존, 적용·복구.
- `launcher.py`: 기존 창모드 실행기 연결. `KoreanPatch/scripts/ai_deck_sync.py`는 이 파일을 부르는 호환 진입점이다. 기본 표준 라이브러리만 사용.

PC 실행기는 공개 publishable 키로 읽기만 한다. 브라우저는 공식 Supabase SDK로 이메일 로그인하며 소유자 확인과 데이터 검증을 저장 RPC에서 수행한다. 인증·변경 이력은 공개하지 않는다. AI 덱 이름·구성·메모는 공개된다. 소유자가 동시에 수정한 덱은 표시 버전이 다르면 덮어쓰기를 거부한다.

PC 적용은 게임 종료 상태에서 원본 해시·카드 신원·같은 카드 3장·해피 합산 3장·그룹·크기를 검사한다. AI는 일반/스피드 플레이어 금제를 적용하지 않는다. 편집기의 금제 배지는 플레이어 규칙 참고용이다.
적용 전 상대 파일과 패치 manifest를 `KoreanPatch/ai_sync/backups`에 백업한다.
원본 또는 이전 동기화 결과와 다른 변경이 있으면 보류하며, 끊긴 적용은 저널로 이어 처리한다.
인터넷 확인에 실패하면 기존 상대 덱으로 실행한다. 플레이 중 자동 변경은 하지 않는다.

`KoreanPatch/reports/last_ai_sync.json`에서 적용·보류·오프라인 기록을 확인한다.
동기화를 끄려면 `KoreanPatch/config/ai_sync.json`의 `enabled`를 `false`로 바꾼다.
게임 종료 후 AI 동기화 백업만 복구하는 예:

```powershell
& 'C:/Users/djmon/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe' -X utf8 KoreanPatch/scripts/ai_deck_sync.py --restore 'KoreanPatch/ai_sync/backups/해당_백업_폴더'
```

복구 명령은 자동 연동을 함께 끈다. 이후 다른 패치를 적용해 manifest가 달라졌다면 복구를 거부한다. 세이브를 과거 것으로 되돌리지 않는다.

이전 GitHub Issue 방식은 `backend: github`로 사용할 수 있게 남겼다. `.github/workflows/ai-deck-sync.yml`과 `github_update.py`는 소유자의 Issue 요청을 검증하고 `ai-sync-data` 브랜치를 갱신한다. 현재 웹 UI와 PC 설정은 Supabase 방식이다. 설치·권한·검사는 [Supabase 안내](../supabase/README.md)를 참고한다.
