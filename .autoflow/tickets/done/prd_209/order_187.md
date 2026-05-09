# Autoflow Order

## Order

- ID: order_187
- Title: 러너 카드 내부 설정 행도 항상 1줄 고정
- Status: inbox
- Priority: normal
- Created At: 2026-05-09T05:02:44Z
- Source: autoflow order create

## Request

# Autoflow Order

## Order

- Title: 러너 카드 내부 설정 행도 항상 1줄 고정 (반응형 collapse 제거)
- Priority: normal
- Status: ready


여기도 반응형 레이아웃이 아닌 항상 1줄로 나와야 함

## Notes

- 사용자가 가리킨 영역: AI Autoflow 탭 안의 각 러너 카드 (claude / codex / gemini) 내부의 설정 행 — agent dropdown + model dropdown + reasoning dropdown + (저장 등 액션 버튼). 현재 viewport 가 좁아지면 이 행이 2 줄로 wrap 됨.
- 직접 원인: `apps/desktop/src/renderer/styles.css` line ~4019 `@media (max-width: 1279px)` 블록이 `.ai-progress-config` 와 `.ai-progress-config-with-agent` 를 `grid-template-columns: repeat(2, minmax(0, 1fr)) !important;` 로 강제 collapse + `.ai-progress-config .runner-save-button { grid-column: 1 / -1 }` 로 버튼 줄을 강제로 다음 행으로 내림.
- 의도: 1280px 미만에서도 inner 설정 행을 1 줄로 유지. dropdown 의 가로 폭을 줄이거나 (text overflow ellipsis) 가로 스크롤 허용 또는 카드 자체가 1280px 미만이면 가로 스크롤 컨테이너 안에 들어가는 식으로 처리. 절대 wrap 금지.
- 관련: order_184 ("AI Autoflow 화면 그리드 항상 1줄 3칸 고정") 가 OUTER 3-card grid 의 1줄 고정을 다루고, 이 order 는 그 안 INNER 설정 행 (각 카드 내부) 의 1줄 고정을 다룸. 두 작업이 같은 미디어쿼리 영역을 건드릴 수 있어 같은 PRD 또는 sequential PRD 로 묶어도 OK.
- 후보 파일:
  - `apps/desktop/src/renderer/styles.css` (.ai-progress-config* 블록 line ~4019, 그리고 line ~6330 부근 작은 폭 분기).
  - 기준이 되는 grid 정의는 .ai-progress-config (위쪽 line ~? 에서 base 정의) — collapse 대신 base 가 4열 + 작은 폭에서도 4열 유지하도록.
- 회귀 가드: 매우 좁은 viewport 에서 dropdown 본문이 잘릴 수 있으므로 select 안의 placeholder/현재값 truncation (text-overflow ellipsis + title 속성) 도 함께 적용 권장.

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
