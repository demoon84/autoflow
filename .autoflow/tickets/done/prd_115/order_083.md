---
title: 로컬 미커밋 변경사항(주로 .autoflow/ 보드 상태) 정리/커밋 요청
created_at: 2026-05-02
source: claude-code /order
---

## Request

로컬에 변경된 이력이 커밋 안된 내용들이 많이 있어 정리해줘.

## Context (관찰됨)

- 현재 워킹 트리 변경 약 36건. 대부분 `.autoflow/` 보드 상태(러너가 처리하면서 누적된 결과).
- 분류:
  - `.autoflow/tickets/inbox/` ↔ `.autoflow/tickets/done/<project-key>/` 사이의 memo 이동 (예: `memo_054`, `memo_065~068`, `memo_076~077` 등 inbox에서 사라지고 done 또는 done/prd_NNN/ 아래에 묶임).
  - `.autoflow/tickets/done/prd_098/`, `done/prd_116/` 등 신규 PRD 완료 묶음 추가.
  - `.autoflow/tickets/done/prd_099~103/` 의 memo 갱신 (러너 finalizer 결과).
  - `.autoflow/tickets/inprogress/Todo-115.md`, `verify_115.md` 등 진행/검증 산출물.
  - `.autoflow/tickets/reject/verify_115.md` 등 반려 결과.
  - `.autoflow/wiki/` (index, log, project-overview, features/*) 갱신.
  - `.autoflow/wiki-raw/prd-*-handoff.md` 다수 신규(98, 99, 100, 102~113 등).
  - `.autoflow/logs/verifier_*_fail.md` 신규 로그.
  - inbox에 새로 들어온 quick order들: `memo_076~083.md` (이번 세션 포함).
  - `.autoflow/tickets/backlog/prd_098.md` 삭제(완료 이동의 일환).

## Scope (hint)

- 이건 코드 변경 PRD 라기보다 **보드 상태 housekeeping** 요청에 가깝다.
- 가능한 처리 방식 후보 (Plan AI 가 사용자 의도 확인 후 선택):
  1. 단일 정리 커밋: `[chore][board] 누적 보드 상태(완료/반려/위키/오더 인박스) 동기화` 같은 한 번에 묶는 commit.
  2. 카테고리별 분할 커밋: `tickets/done/prd_098`, `tickets/done/prd_116`, `wiki/`, `logs/`, `inbox/`(quick orders) 등으로 나눠 커밋.
  3. PRD별 분할 커밋: 완료 PRD(98, 99, 100, 102, 103, 116) 마다 `[PRD_NNN][board] 완료 산출물 commit` 형태.
- `git push` 는 금지(로컬 commit 까지만).
- 새 backlog PRD 가 본 위치(예: `prd_111`, `prd_112`, `prd_113` 등)에 있으면 그건 별도 흐름이므로 정리 commit 에 포함 여부를 사용자에 확인 필요.
- `.autoflow/wiki/` 변경은 Wiki AI 영역이므로 commit 분리 시 별도 커밋으로 묶는 게 일관됨(AGENTS.md rule 18).

## Allowed Paths (hint)

- `.autoflow/**` (보드 상태 전반)
- 제품 코드 디렉터리는 영향 없음 (현재 워킹 트리에 product code diff 없음).

## Verification (hint)

- `git status` 가 깨끗한지 확인 (정리 후).
- `git log -n 5 --oneline` 으로 commit message 가 `[chore][board]` 또는 `[PRD_NNN][board]` 형식을 따르는지 확인.
- `git push` 는 절대 수행하지 않음.

## Note

이 요청은 standard Impl AI ticket worktree 흐름과 잘 맞지 않는다. Plan AI 가 본 인박스 노트를 읽고:
- 단순 commit 묶기 의도인지(=러너가 만든 누적 결과 정리),
- 아니면 어떤 의미 있는 코드/보드 정리 작업이 필요한지,
사용자에게 명확히 묻는 generated PRD/memo 로 승격하는 게 안전.
