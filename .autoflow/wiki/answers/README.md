---
kind: wiki_section_readme
title: Wiki Answers
---

# Wiki Answers

이 디렉터리는 `autoflow wiki query --synth --save-as <slug>` 로 저장된 위키 합성(synth) 답변을 보관한다.

LLM-Wiki 패턴의 핵심 권고 — *"good answers can be filed back into the wiki as new pages"* — 를 구현한 영역이다. 같은 질문을 두 번 LLM에게 묻지 않도록, 가치 있는 합성 답변은 여기 파일로 남아 다음 질의에서 wiki query 로 다시 검색·인용된다.

## 파일 규약

각 답변 파일은 다음을 포함한다.

- YAML frontmatter: `kind: synth_answer`, `slug`, `runner`, `created`, `updated`, `terms` (질의어 배열), `citations` (board-relative 경로 배열).
- `## Answer`: 한 문단 내외의 한국어 답변.
- `## Citations`: 합성에 사용된 위키/티켓/로그 경로.
- `## Source`: 답변을 생성한 명령.

## 재실행 / 갱신

같은 slug 으로 다시 `--save-as` 하면 `created:` 는 보존되고 `updated:` 만 갱신되며 본문이 새 답변으로 교체된다.

## 최근 답변

- [[ticket-detail-layer-meta-layout-20260501]]: `prd_077` 기준 `TicketDetailLayer` 메타 박스를 3열 고정 그리드에서 한 줄 우선 flex wrap 레이아웃으로 좁힌 변경 요약.
- [[recent-desktop-ui-refinements-20260429]]: `tickets_063` 의 memo→order 사용자 표기 변경과 `tickets_065` 의 Logs 사이드바 말단 이동을 함께 요약.
- [[wiki-preview-top-alignment]]: `tickets_059` 기준 위키 검색 우측 미리보기 패널의 상단 정렬 유지 요약.
- [[finish-ticket-owner-cleanup-status-contract]]: `verify_003` / `reject_003` 기준 `cleanup_status=ok` 출력 계약 누락 원인 요약.
- [[korean-board-writing-policy]]: PRD·ticket·memo 본문 한국어 기본 정책과 parser-sensitive 예외 요약.
- [[wiki-query-filter-group]]: `tickets_058` 기준 위키 검색 필터 체크박스 2개를 단일 옵션 그룹으로 묶은 변경 요약.

## 작성자

이 디렉터리의 파일은 `wiki-1` 러너의 어댑터(또는 fallback coordinator)가 작성한다. 사람이 직접 편집해도 무방하지만, 같은 slug 이 다시 호출되면 본문은 덮여 쓰인다.
