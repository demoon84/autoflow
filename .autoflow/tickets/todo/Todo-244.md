# Ticket

## Ticket

- ID: Todo-244
- PRD Key: express_213
- Plan Candidate: Express promotion from tickets/inbox/order_213.md
- Title: 셀렉트 박스 화살표(chevron) 클릭 시 드롭다운 안 펼쳐짐 수정
- Priority: normal
- Change Type: code
- Stage: executing
- AI: worker
- Claimed By: worker
- Execution AI: worker
- Verifier AI:
- Last Updated: 2026-05-10T00:04:46Z

## Goal

- 이번 작업의 목표: 셀렉트 박스 화살표(chevron) 누를 때 셀렉트 박스가 안 펼쳐짐

## References

- PRD: (express; no PRD authored)
- Order: tickets/done/express_213/order_213.md
- Plan Source: express-skip-prd

## Reference Notes

- Project Note: [[express_213]]
- Plan Note:
- Ticket Note: [[Todo-244]]

## Allowed Paths

- apps/desktop/src/components/ui/select.tsx
- apps/desktop/src/renderer/styles.css

## Worktree
- Path: `/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_244`
- Branch: autoflow/tickets_244
- Base Commit: 461cc2786765e81a1d0cc922f1bb0a083f972d55
- Worktree Commit: 
- Integration Status: pending

## Goal Runtime
- Status: active
- Started At: 2026-05-09T23:49:28Z
- Started Epoch: 1778370568
- Updated At: 2026-05-10T00:05:01Z
- Tick Count: 15
- Time Used Seconds: 933
- Token Budget: 
- Tokens Used: 
- Continuation Suppressed: false
- Last Event: adapter_exit_1
- Last Progress Fingerprint: 1383301171

## Recovery State

- Status: healthy
- Detected By:
- Failure Class:
- Evidence:
- Planner Decision:
- Owner Resume Instruction:
- Last Recovery At:

## Done When

- [ ] `<ChevronDown>` 위치를 클릭해도 native `<select>` 가 펼쳐진다 (또는 chevron 클릭 시 select.click() 을 강제로 위임)
- [ ] 기존 select 컨트롤(라벨/값 영역 클릭) 동작은 보존
- [ ] 키보드 접근 (Tab + Space/Arrow) 도 보존
- [ ] `cd /Users/demoon2016/Documents/project/autoflow/apps/desktop && npm run check` exits 0

## Next Action
- 다음에 바로 이어서 할 일: 한 owner 가 mini-plan, 구현, 검증, 증거 기록, done 이동까지 이어서 처리한다.

## Resume Context

- 현재 상태 요약: Express order 213 가 PRD 없이 todo 로 직접 승격된 직후.
- 직전 작업: scripts/start-plan.sh 의 express 분기가 order 파일을 읽어 todo 를 생성했다.
- 재개 시 먼저 볼 것: Order, Goal, Allowed Paths, Done When.

## Notes

- Created by planner (Plan AI, express path) from tickets/inbox/order_213.md at 2026-05-09T23:48:29Z.
- Express promotion: order_213 의 Allowed Paths 와 Done When 이 모두 명시돼 있어 PRD 단계를 생략했다.

### Order Notes

- 빠른 수정안: chevron 의 `pointer-events: none` 이 정상 동작하는데도 안 열리면
  native `<select>` 가 chevron 영역을 차지하지 못하는 layout 문제 →
  `<select>` 에 `padding-right` 충분히 주거나 chevron 을 select 의 자식으로 둘
  수 없으니 wrapper 가 click 을 select 로 forward (`onClick` → `selectRef.current?.showPicker?.()`).
- Express rationale: 단일 컴포넌트 + 한 CSS 블록 변경.

### Original Request


셀렉트 박스 화살표(chevron) 누를 때 셀렉트 박스가 안 펼쳐짐

- Runtime hydrated worktree dependency at 2026-05-09T23:49:27Z: linked apps/desktop/node_modules -> /Users/demoon2016/Documents/project/autoflow/apps/desktop/node_modules
- Runtime hydrated worktree dependency at 2026-05-09T23:49:27Z: linked node_modules -> /Users/demoon2016/Documents/project/autoflow/node_modules
- AI worker prepared todo at 2026-05-09T23:49:26Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_244
- AI worker prepared resume at 2026-05-10T00:04:46Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_244
## Verification
- Result: pending ticket-owner by worker

## Result

- Summary:
- Remaining risk:
