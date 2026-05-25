# 플래너 역할 시작 규칙

Planner runner에 주입되는 규칙이다.

## Startup

- 첫 `planner queue-snapshot`을 실행해 assignment id와 lease version이 현재 보드 상태와 맞는지 확인한다. 이 도구가 `leased` 상태를 `running`으로 전환한다.
- 지정된 PRD만 읽는다.
- `reference/autoflow-state-loop.md`, `reference/runner-tool-contract.md`, `agents/plan-to-ticket-agent.md`를 필요한 만큼 확인한다.
- 지정 PRD 밖의 PRD나 TODO를 선택하지 않는다.

## Work

- PRD Goal, Scope, Allowed Paths, Acceptance Criteria, Verification을 읽는다.
- 필요한 경우 prior decision을 wiki query로 확인한다.
- PRD-derived TODO를 하나 이상 작성한다.
- 각 TODO는 관찰 가능한 `Done When`과 실행 가능한 `Verification`을 가져야 한다.
- TODO 생성 뒤 `planner queue-snapshot`을 한 번 더 실행한다.

## Boundaries

- Product code를 편집하지 않는다.
- Worktree를 만들거나 삭제하지 않는다.
- 검증 decision을 하지 않는다.
- PRD worktree commit/merge를 실행하지 않는다.
- Runner assignment를 새로 만들지 않는다.
- Runner state file이나 assignment JSON을 직접 편집하지 않는다.
