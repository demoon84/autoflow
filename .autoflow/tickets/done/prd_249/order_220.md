# Autoflow Order

## Order

- ID: order_220
- Title: PTY runner UI active ticket 복원
- Status: inbox
- Priority: high
- Created At: 2026-05-10T09:17:29Z
- Source: autoflow order create

## Request

# Autoflow Order

## Order

- Title: PTY runner UI 에 처리 중 ticket / progress slider 복원
- Priority: high
- Status: ready
- Change Type: code


PTY 모드로 전환 후 데스크톱 runner 카드의 "처리 중인 ticket" 표기와 진행 단계 슬라이더(대기/구현/완료/반려)가 비어있다. legacy run-role.sh 가 쓰던 `active_ticket_id` / `active_ticket_title` / `active_stage` state 필드를 PTY 모드는 갱신하지 않기 때문. 이걸 worktree / inprogress 폴더에서 신뢰성 있게 유추해 UI 에 반영.

핵심 갭:
- worker 가 실제로 잡고 있는 ticket 을 정확히 식별 (단순히 inprogress 폴더 첫 파일이 아니라 worktree 와 매칭)
- active_stage 를 worktree 존재 / inprogress 비어있음 / done 흐름으로 결정
- planner / wiki 도 같은 원칙으로 보강

## Allowed Paths

- apps/desktop/src/main.js
- apps/desktop/src/renderer/main.tsx

## Done When

- [ ] worker runner 가 inprogress 폴더에서 단 하나의 Todo-*.md 를 잡고 있을 때, UI 의 "실행 중" 영역에 ticket id (`Todo-NNN`) 와 Title 이 표시된다
- [ ] worker runner 의 progress slider 가 inprogress 비어있을 때 "대기", 1개 이상일 때 "구현" 단계를 active 로 표시
- [ ] inprogress 에 ticket 이 여러 개 있을 때 (정상 흐름은 0~1 이지만 fail-safe) worker 의 가장 최근 worktree 와 매칭되는 ticket 을 선택
- [ ] planner runner 가 inbox/backlog 에 처리할 항목이 있을 때 슬라이더가 "계획" 단계, 비었을 때 "대기" 표시
- [ ] PTY mode (`mode=pty`) 와 legacy mode 둘 다 호환 — legacy state 가 active_ticket_id 를 박아 두면 그 값 우선

## Verification

- Command: rg -n "enrichRunnerActiveTicketFromFs|activeTicketId|activeStage" apps/desktop/src/main.js apps/desktop/src/renderer/main.tsx

## Notes

- 현재 fs enrichment 는 단순히 inprogress 첫 파일을 잡는 수준이라 worktree 매칭 / multi-inprogress 정리가 미흡
- `git worktree list` 로 worker 의 활성 worktree 를 알아내 그 path 의 ticket 과 inprogress 를 매칭하는 안정적인 방법 검토
- runner state 파일에 PTY 시작 시 worker 가 잡은 ticket 을 main.js 가 직접 추적해 (fs.watch on inprogress + 자기 PTY 의 stdout 패턴) state 파일에 써주는 방식도 가능

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
