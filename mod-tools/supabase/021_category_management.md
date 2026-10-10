태그 이름 변경은 모든 해당 카드의 분류를 함께 바꾼다. 삭제는 복구 가능한 보관이며, 삭제한 태그에서 복원하면 같은 카드 identity에 한해 연결이 돌아온다. 관련 카드 링크와 다른 태그는 유지한다.

기존 이메일 편집 권한과 RPC를 사용한다. 카테고리와 카드 분류 저장을 같은 lock으로 직렬화하고 expected revision을 검증한다. 과거 화면에서 저장한 값으로 삭제한 이름을 되살리거나 다른 기기의 변경을 덮어쓸 수 없다.

`021_category_management.sql`은2026-10-11 설치했고 annotation 원본 보존 guard를 통과했다. `check_category_management.sql`은 실제 RPC 변경/삭제/복원·충돌·다른 identity·비인가 편집을 검사한 후 DO subtransaction을 롤백한다. 기존 tag/link/deck/scenario 행의 검사 전후 hash가 동일함을 확인했다. 웹 격리 화면에서도 변경/삭제/복원 뒤 링크1개가 유지되고 오래된 draft 저장이 멈춤을 확인했다.

장시간 public snapshot 사이에는#621에 ‘블랙매지션’ 태그가 별도 저장되었다. 이 변경을 되돌리지 않았다.36개 덱과11개 시나리오는 동일했다. 원본 public snapshot의 완전 일치를 보존 검사로 주장하지 않는다.
