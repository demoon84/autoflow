# Autoflow Order

## Order

- ID: order_181
- Title: 데스크톱 inbox order filter가 retry order 매치하도록 regex 확장
- Status: inbox
- Priority: normal
- Created At: 2026-05-08T05:45:26Z
- Source: autoflow order create

## Request

apps/desktop/src/renderer/main.tsx 의 isOrderBoardFile 함수 regex 가 현재 'order_NNN.md' 만 매치한다. 따라서 worker fail 후 발행되는 retry order 'order_<id>_retry_<N>_<timestamp>.md' 형태가 desktop UI 의 ORDER pin layer / Ticket Workspace listing 양쪽에서 안 보이는 cosmetic 버그 + 운영 위험.

retry order 도 일반 order 처럼 보이도록 regex 를 확장한다 (예: order_ prefix + .md 끝 매치). 동시에 retry 인지 알 수 있는 작은 시각적 힌트 (라벨/아이콘/카운트 등) 가 있으면 더 좋다. 단, 라벨 추가가 큰 변경이면 일단 listing 노출만 1차 fix.

같은 regex/필터 가 ID 추출, retry_count badge, status label 등 다른 위치에서도 사용되면 함께 점검한다.

## Hints

### Scope

- pending Plan AI inference

### Allowed Paths

- pending Plan AI inference

### Verification

- Command: pending Plan AI inference

## Planner Contract

- Plan AI treats this order as an implementation directive, infers concrete scope from repository context, and promotes it into a generated backlog PRD and todo ticket.
- Plan AI must not turn order intake into a repeated human-question loop. Only unsafe requests should be blocked; otherwise use the safest narrow interpretation.
