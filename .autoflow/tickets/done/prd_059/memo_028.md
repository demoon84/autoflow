# Autoflow Memo

## Memo

- ID: memo_028
- Title: Tickets 페이지 상세 레이어 열 때 화면 깜박임
- Status: inbox
- Created At: 2026-04-29T21:10:05Z
- Source: autoflow memo create

## Request

tickets 페이지에서 세부 내용을 보기위해 레이어를 열면 화면이 깜박임

## Hints

### Scope

- TicketDetailLayer (main.tsx 라인 3685+) 가 MUI Dialog (overlayClassName=workflow-pin-layer-overlay, panel=ticket-detail-layer-panel) 로 열린다. 깜박임은 보통 (a) overlay/panel 의 transition 이 mount 시 0->1 이 아닌 잘못된 keyframe 으로 처음 frame 이 보였다 사라짐, (b) Dialog 가 두 번 마운트되거나 부모 컴포넌트 re-render 로 portal 내용이 잠깐 사라짐, (c) backdrop 의 background-color/opacity 가 transition 끝에 깜박임. styles.css 의 .workflow-pin-layer-panel / .workflow-pin-layer-overlay / .ticket-detail-layer-panel transition 을 점검하고, TicketDetailLayer 부모(TicketKanban / TicketWorkspace) 가 onOpenChange 시 state 갱신으로 자식을 unmount 후 remount 하는 패턴이 있는지 확인. 필요시 React.memo 적용 또는 open prop 만 토글하도록 분리.

### Allowed Paths

- `apps/desktop/src/renderer/main.tsx`
- `apps/desktop/src/renderer/styles.css`
- `apps/desktop/src/components/ui/dialog.tsx`

### Verification

- Command: npm --prefix apps/desktop run check && desktop dev 모드에서 Tickets 페이지의 카드를 여러 번 열고 닫으며 깜박임이 사라졌는지 확인. 브라우저 dev tools 의 paint flashing 또는 record 로 첫 프레임 깜박임 0회를 목표로 한다.

## Planner Contract

- Plan AI treats this memo as an implementation directive, infers concrete scope from repository context, and promotes it into a generated backlog PRD and todo ticket.
- Plan AI must not turn memo intake into a repeated human-question loop. Only unsafe requests should be blocked; otherwise use the safest narrow interpretation.
