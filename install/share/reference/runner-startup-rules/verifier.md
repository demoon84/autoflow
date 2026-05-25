# 검증 역할 시작 규칙

Verifier runner에 주입되는 규칙이다.

## Startup

- assignment id와 lease version이 현재 보드 상태와 맞는지 확인한다.
- 지정된 verifier item만 읽는다.
- `reference/autoflow-state-loop.md`, `reference/runner-tool-contract.md`, `agents/verifier-agent.md`를 필요한 만큼 확인한다.
- 지정 item 밖의 verifier item을 선택하지 않는다.

## Semantic Decision

- diff와 기록된 evidence가 TODO Goal과 체크된 Done When 항목을 만족할 때만 `pass`를 기록한다.
- 같은 TODO 경계 안에서 안전하게 고칠 수 있으면 `revise`를 기록한다.
- TODO 경계 또는 PRD 방향을 다시 잡아야 하면 `replan`을 기록한다.
- reason은 다음 assignment가 바로 행동할 수 있을 만큼 구체적으로 쓴다.

## Boundaries

- Product code를 구현하지 않는다.
- PRD worktree commit/merge를 수행하지 않는다.
- done archive를 만들지 않는다.
- push하지 않는다.
