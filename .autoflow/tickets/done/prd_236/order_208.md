# Autoflow Order

## Order

- Title: TODO 카운트가 inprogress 만 있을 때 idle 표시와 충돌하는 UX 정리
- Priority: normal
- Status: ready
- Change Type: code

## Request

비슷한 내용인대 처리할 내용이 있는데 처리할 작업이 없다고 표기 되고 대기 상태임.
화면: PRD (0/234), TODO (1/212), Worker 슬라이더 "대기" + ticket_inputs_unchanged.

## Context

`order_206` 에서 TODO numerator 를 `todoTickets + inprogressTickets` 로 바꿨다.
그래서 inprogress 1건만 있어도 `TODO (1/212)` 로 표시된다. 하지만:

- inprogress 티켓은 이미 worker 가 잡아서 처리 중 → 사용자 입장에선 "1건 남음"
- 동시에 worker 슬라이더는 "대기" + `ticket_inputs_unchanged` (idle preflight)
- todo/ 폴더가 비어 있어 worker 는 새 ticket 을 잡지 않음 (정상 동작)

결과: 사용자는 "1건 처리해야 하는데 worker 가 놀고 있음" 으로 오해.

실제로는 inprogress 티켓이 이미 worker 의 worktree 에서 처리 단계에 있고
다음 tick 이 그것을 picked-up state 로 마무리하는 흐름이라 "대기" 표시가 맞다.

## Allowed Paths

- apps/desktop/src/renderer/main.tsx

## Done When

- [ ] TODO 카운트 라벨이 todo 와 inprogress 를 사용자가 한눈에 구분할 수 있게 변경됨 (예: `TODO (1+0/212)` 또는 `TODO (1대기·0구현/212)`, 혹은 hover/aria-label 에 분리 표시)
- [ ] inprogress 만 있고 todo 가 비어 있을 때 "처리 중" 임을 보조 텍스트/툴팁으로 명확히 알 수 있다
- [ ] worker 가 실제로 idle (todo 도 inprogress 도 비어 있음) 일 때만 "대기" 슬라이더와 일관됨
- [ ] `cd /Users/demoon2016/Documents/project/autoflow/apps/desktop && npm run check` exits 0

## Verification

- Command: cd /Users/demoon2016/Documents/project/autoflow/apps/desktop && npm run check

## Notes

- 위치: `apps/desktop/src/renderer/main.tsx:5566` `todoPinTitle` 그리고
  `WorkflowFileEntry` 렌더링 부.
- 비슷한 과거 작업: `prd_231`, `prd_232` (idle 신호 우선 검사). 본 건은 그
  follow-up 으로, idle 매핑은 정상이지만 카운트 라벨이 사용자에게 혼란을 주는
  UX 측면.
- 가벼운 옵션: 라벨을 `구현(N)/대기(N)/{total}` 식으로 분리 표시하거나,
  `TODO + 구현` 으로 묶어서 보여주되 hover 에 detail.
- Worker 분기 stage 로직 자체는 변경 X (idle 일 때 "대기" 가 옳음).
