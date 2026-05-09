# Autoflow Order

## Order

- ID: order_184
- Title: AI Autoflow 화면 그리드 항상 1줄 3칸 고정
- Status: inbox
- Priority: normal
- Created At: 2026-05-09T04:53:46Z
- Source: autoflow order create

## Request

# Autoflow Order

## Order

- Title: AI Autoflow 화면 그리드 항상 1줄 3칸 고정
- Priority: normal
- Status: ready


ai autoflow 화면이 반응형 되지 않고 항상 1줄 3칸으로 나와야 함

## Notes

- 과거 commit: `187d97c [autoflow_desktop] ai-progress-board grid: 2 → 3 columns`, `436b9ba [autoflow_desktop] runner grid: 1 row × 3 columns layout` 에서 이미 3열로 맞춘 적이 있음. 그 이후 미디어쿼리 반응형이 다시 들어가서 좁은 폭에서 2열 / 1열로 무너지는 듯.
- 후보 파일: `apps/desktop/src/renderer/styles.css` (`.ai-progress-board`, `.runner-grid`, 그리고 같은 파일 ~line 4010, ~line 6255, ~line 6366 에 있는 미디어쿼리 분기). `apps/desktop/src/renderer/main.tsx` 는 클래스 사용처 정도만 확인 필요.
- 의도: viewport 폭 무관하게 grid-template-columns 를 1fr 1fr 1fr 등 3열 고정으로 두고, narrow viewport 에서 칸이 줄어드는 미디어쿼리를 제거 (또는 min-width 고정 + 가로 스크롤 허용).
- AI Autoflow 탭 (settings-content-progress) 영역만 적용. 다른 탭/페이지 그리드는 변경하지 말 것.

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
