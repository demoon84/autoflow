# Runner State

이 디렉터리는 데스크탑 sidecar와 runner가 사용하는 local state를 둔다.

## 고정 Runner

데스크탑 sidecar는 4개 러너를 표시한다.

- `Planner`
- `Worker`
- `Verifier`
- `LLM Wiki`

`Merge` runner는 없다.

## 역할

- Planner: PRD를 TODO로 분해한다.
- Worker: 배정 TODO를 수행한다. Verifier pass 뒤 PRD worktree commit을 반영하고, 마지막 TODO를 처리하면 PRD worktree merge를 수행한다.
- Verifier: Worker 결과를 검증하고 후속조치를 기록한다.
- LLM Wiki: 완료 원장에서 파생 지식을 지연/배치로 정리한다.

## 상태 감지

Planner, Worker, Verifier는 자신의 상태를 보드에 기록한다. 데스크탑 sidecar는 이 상태 변화를 실시간 감지해 다음 실행을 이어간다.
