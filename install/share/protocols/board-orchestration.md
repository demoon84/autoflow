# 보드 상태 루프 프로토콜

## 목적

보드는 Autoflow의 source of truth다. `autoflow` skill 대화, 데스크탑 sidecar, Planner/Worker/LLM Wiki runner는 모두 보드 상태를 기준으로 움직인다.

## 책임

`autoflow` skill 대화:

- goal 상태 확인과 완료 처리.
- 프로젝트 현재 상태와 LLM Wiki read-only 참고.
- PRD 하나 이상 발행.
- PRD 루프 진행 상태 감시.
- PRD 완료 뒤 goal 기준 부족분 확인과 추가 PRD 발행.

Desktop sidecar:

- 보드 상태 실시간 감지.
- 3개 고정 러너 표시: `Planner`, `Worker`, `LLM Wiki`.
- runner 실행/중지/PTY/lifecycle 관리.

Runner:

- Planner는 PRD를 TODO로 분해한다.
- Worker는 배정 TODO를 수행하고 로컬 검증 evidence를 남긴 뒤 `worker finalize-approved`로 PRD worktree commit을 반영한다. 마지막 TODO를 처리한 Worker는 같은 호출로 PRD worktree merge까지 수행한다.
- LLM Wiki는 지연/배치로 파생 지식을 정리한다.

## 결정 순서

1. Skill 대화가 goal과 현재 보드 상태를 확인한다.
2. 필요하면 LLM Wiki를 read-only로 참고한다.
3. 목표 달성을 위해 필요한 PRD를 하나 이상 발행한다.
4. Desktop sidecar가 PRD 상태를 감지한다.
5. Planner가 PRD 기준 TODO를 만든다.
6. Worker가 pending TODO를 수행한다.
7. Worker가 로컬 검증 evidence를 남긴다.
8. Worker가 `worker finalize-approved`로 PRD worktree commit을 반영한다.
9. PRD의 모든 TODO가 완료되면 마지막 TODO를 처리한 Worker가 PRD worktree merge를 수행한다.
10. Skill 대화가 goal 기준 부족분을 확인한다.
11. 부족하면 PRD를 추가 발행하고, 충분하면 goal complete를 수행한다.

## 위키

LLM Wiki는 skill 대화가 PRD를 발행할 때 참고하는 read-only memory다. LLM Wiki runner의 작성 작업은 deferred maintenance이며 PRD 완료나 goal 완료를 막지 않는다.

## 금지

- Skill 대화는 제품 구현, 검증 판정, PRD worktree commit/merge, 위키 작성을 직접 하지 않는다.
- Runner는 자기 역할 밖의 상태를 임의로 변경하지 않는다.
- Desktop sidecar는 goal 완료 여부를 판단하지 않는다.
- 별도 `Merge`/`merge` runner를 만들지 않는다.
