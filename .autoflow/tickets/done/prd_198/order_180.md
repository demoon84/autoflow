# Autoflow Order

## Order

- ID: order_180
- Title: 워크플로 핀 레이어 안내 문구 3종 제거 (TODO/PRD/ORDER helpText)
- Status: inbox
- Priority: normal
- Created At: 2026-05-08T05:42:42Z
- Source: autoflow order create

## Request

데스크톱 앱 워크플로 핀 레이어(WorkflowPinLayer)의 layerHelpText 안내 문구 3개를 모두 삭제한다.

1. TODO 핀: '아직 시작되지 않은 TODO 티켓 목록입니다. 항목을 클릭하면 티켓 본문이 이 화면에서 열립니다.'
2. PRD 핀: '작성된 PRD 목록입니다. 항목을 클릭하면 본문이 이 화면에서 열립니다.'
3. ORDER 핀: '들어온 빠른 오더 목록입니다. 항목을 클릭하면 오더 본문이 이 화면에서 열립니다.'

세 위치 모두 layerHelpText prop 자체를 제거하거나 빈 문자열로 바꿔서 화면에 안 보이게 한다.

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
