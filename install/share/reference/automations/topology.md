# 권장 구성

Autoflow의 권장 구성은 `autoflow` skill과 데스크탑 sidecar, 3개 고정 러너다.

Desktop sidecar runner:

- `Planner`
- `Worker`
- `LLM Wiki`

`Merge` runner는 없다.

일반 정책:

- PRD가 발행되면 Planner가 TODO를 만든다.
- TODO가 있으면 Worker가 배정 TODO를 수행한다.
- Worker는 로컬 검증 evidence를 남긴 뒤 `worker finalize-approved`로 PRD worktree commit을 반영한다.
- PRD의 모든 TODO가 완료되면 마지막 TODO를 처리한 Worker가 PRD worktree merge를 수행한다.
- LLM Wiki는 done evidence가 있고 구현/검증 흐름을 방해하지 않을 때 지연/배치로 동작한다.
