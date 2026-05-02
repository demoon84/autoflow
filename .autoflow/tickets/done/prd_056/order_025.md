# Autoflow Memo

## Memo

- ID: memo_025
- Title: Wiki 검색 체크박스 2개를 단일 목록으로 합치기
- Status: inbox
- Created At: 2026-04-29T21:06:55Z
- Source: autoflow memo create

## Request

Wiki 페이지 검색창 아래에 '완료/거절 티켓 포함' 과 '인수인계 포함' 체크박스가 두 개로 나뉘어 있는데, 이걸 하나의 목록으로 합쳐줘. 첨부 스크린샷에서 보이는 두 체크박스가 한 줄에 별개로 떠 있는 형태를, 하나의 그룹/목록으로 통합.

## Hints

### Scope

- main.tsx 라인 5389-5406 의 Checkbox 두 개 ('완료/거절 티켓 포함', '인수인계 포함') 를 하나의 그룹(예: FormGroup, MUI Select multiple, 또는 Autocomplete multiple, 혹은 옵션 칩 단일 목록) 으로 묶어 단일 컴포넌트에서 두 옵션을 모두 토글할 수 있게 한다. 상태(wikiQueryIncludeTickets, wikiQueryIncludeHandoffs) 는 그대로 유지해 wiki query API 호출과 호환되게 하고, UI 레벨에서만 한 목록으로 합친다.

### Allowed Paths

- `apps/desktop/src/renderer/main.tsx`
- `apps/desktop/src/renderer/styles.css`

### Verification

- Command: npm --prefix apps/desktop run check && desktop dev 모드에서 Wiki 페이지의 두 옵션을 같은 목록 UI 에서 모두 켜고 끌 수 있는지 수동 확인

## Planner Contract

- Plan AI treats this memo as an implementation directive, infers concrete scope from repository context, and promotes it into a generated backlog PRD and todo ticket.
- Plan AI must not turn memo intake into a repeated human-question loop. Only unsafe requests should be blocked; otherwise use the safest narrow interpretation.
