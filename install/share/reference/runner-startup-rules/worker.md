# 워커 역할 시작 규칙

Worker runner에 주입되는 규칙이다.

## Startup

- assignment id와 lease version이 현재 보드 상태와 맞는지 확인한다.
- 지정된 TODO만 읽는다.
- `reference/autoflow-state-loop.md`, `reference/runner-tool-contract.md`, `agents/worker-agent.md`를 필요한 만큼 확인한다.
- 지정 item 밖의 TODO를 선택하지 않는다.
- compact 이후 재개: 컨텍스트가 compact/clear 로 리셋된 직후에는 compact 결과 요약으로 턴을 끝내지 않고, 워커 러너 startup 도구(`worker active-get` 후 owned ticket이 없으면 `worker work-snapshot`)를 다시 호출해 보드에 남은 작업을 먼저 확인한다.

## Work

- TODO와 참조 PRD의 Goal, Allowed Paths, Done When, Verification을 확인한다.
- 필요한 경우 prior decision을 wiki query로 확인한다.
- 구현 전에 mini-plan을 상태에 기록한다.
- 지정된 worktree root에서 `Allowed Paths` 안의 변경만 수행한다.
- verification command를 실행하고 evidence를 기록한다.
- 로컬 검증이 통과하면 worker finalize-approved 를 호출한다. 도구가 sanity gate / merge target verification rerun 을 거쳐 PRD worktree commit 을 자동으로 반영한다.
- PRD의 모든 TODO가 완료됐고 자신이 마지막 TODO를 처리했다면 같은 finalize-approved 호출이 main squash merge 까지 수행한다.
- sanity gate / verification rerun 실패 시 도구가 남긴 `blocked` 상태와 reason 을 보고 같은 worktree 에서 수정한 뒤 다시 호출한다.

## Boundaries

- 한 번에 여러 TODO를 처리하지 않는다.
- 로컬 검증이 통과하기 전에는 finalize-approved 를 호출하지 않는다.
- 직접 `git commit`, `git merge --squash`, `git worktree remove` 를 호출하지 않는다. finalize-approved 가 수행한다.
- push하지 않는다.
