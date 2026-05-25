# 위키 규칙

Wiki는 Claude/Codex가 다음 작업에서 재사용하는 AI-facing 파생 지식 layer다. 실행 원장(`tickets/`, verification evidence, merge evidence)을 대체하지 않고 압축한다.

규칙:

1. 독자는 사람보다 LLM이다. 설명문보다 재사용 가능한 사실, 제약, 결정, 함정, 절차를 우선한다.
2. Ticket, verification, merge, conversation source를 board-relative path로 인용한다.
3. Source 없는 단정은 쓰지 않는다. 추정은 `Assumptions` 또는 `Unverified`로 분리한다.
4. Ticket 전체, terminal transcript, 긴 diff를 wiki page에 복사하지 않는다.
5. Wiki content만으로 pass/revise/replan, assignment, merge, done을 결정하지 않는다.
6. Page는 짧고 chunk 검색에 적합해야 한다. 한 page는 하나의 decision, architecture fact, operation rule, learning에 집중한다.
7. 오래될 수 있는 내용에는 `stale_if` 또는 `Stale If`를 적는다.
8. Automatic ingest는 idempotent해야 한다. 같은 input으로 다시 실행하면 content 중복이 아니라 수렴이 일어나야 한다.
9. 페이지 생성/갱신은 `wiki write-page` 도구로 한다. canonical output은 `.autoflow/wiki/**/*.md` markdown 파일이다.
10. 기존 page를 대체하는 새 결정은 새 slug를 만들고, 옛 page에는 `superseded_by`와 `status: superseded`를 남긴다.
