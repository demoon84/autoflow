---
name: "desktop-readboard-subcall-timeout-isolation"
description: "desktop readBoard subcall timeout isolation"
pattern_type: orchestration_cleanup
applies_to:
  module: "apps/desktop/src/main.js"
  keywords:
    - "desktop"
    - "read"
    - "board"
    - "subcall"
    - "timeout"
    - "isolation"
    - "apps"
    - "src"
    - "main"
pinned: false
created_from:
  prd: "prd_173"
  ticket: "tickets_172"
created_at: "2026-05-05T07:11:45Z"
---

# desktop readBoard subcall timeout isolation

## Trigger

- Reuse when: desktop readBoard subcall timeout isolation
- Source ticket: `tickets/inprogress/tickets_172.md`

## Recommended Procedure

- `apps/desktop/src/main.js`의 `readBoard` 내부 6개 진단 호출은 `Promise.allSettled` 또는 동등한 safe wrapper를 사용해 단일 rejected promise가 전체 `autoflow:readBoard` IPC reject로 이어지지 않는다.
- `status`, runner list, `doctor`, `metrics`, `stop-hook-status`, `watch-status` 각각은 개별 timeout(기본 15000ms 안팎) 또는 공유 helper를 통해 handler-level 30000ms보다 짧게 fallback result를 반환한다.
- timeout 또는 reject가 난 diagnostic result는 `ok: false` 또는 `partial/fallback` 계열 field, `cancelled`/`signal`/`stderr` 증거, source 이름을 포함해 `readBoardMeta.fallbackSources`에서 식별된다.
- 한 diagnostic refresh가 timeout되어도 나머지 성공/캐시/파일 목록 결과는 board snapshot에 유지되고, renderer는 빈 전체 board 대신 부분 board를 받을 수 있다.
- 기존 `readBoard` stale cache와 inflight refresh guard는 유지되며, `prd_140`의 `partial`, `fallback`, `stale`, `refreshInFlight`, `readBoardFallback`, top-level `readBoardMeta` 의미가 제거되지 않는다.

## Pitfalls

- Allowed Paths 밖으로 확장하지 말고, 추출 실패가 finalization을 막지 않게 유지한다.

## Verification Pattern

- Command: ``npm run desktop:check``

## Source Evidence

- Ticket: `tickets/inprogress/tickets_172.md`
- PRD: `tickets/done/prd_173/prd_173.md`
- Verification: `tickets/inprogress/verify_172.md`
