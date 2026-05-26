# Autoflow 상태 루프

Autoflow는 사용자-facing skill이다. 데스크탑 앱은 skill과 runner를 실행하는 sidecar이며, 보드 상태를 실시간 감지해 3개 고정 러너를 표시한다.

## 핵심 문장

- `autoflow` skill은 goal 기능을 사용해 사용자 목표를 유지하고 완료한다.
- skill 대화의 주된 역할은 프로젝트 현재 구현 상태와 LLM Wiki를 read-only로 참고해 PRD를 발행하는 것이다.
- skill 대화는 PRD를 하나 이상 발행할 수 있다.
- 구현, 검증, PRD worktree commit/merge, 위키 작성은 skill 대화가 직접 하지 않는다.
- 실행 루프는 `PRD -> TODO -> Worker local verification -> PRD worktree commit/merge` 흐름이다.
- PRD 하나에서 여러 TODO가 나올 수 있다.
- PRD 하나가 끝나면 skill 대화는 goal 기준 부족분을 확인하고, 필요하면 PRD를 추가 발행한다.
- LLM Wiki 작성은 PRD 완료나 goal 완료의 필수 조건이 아니다.
- `Merge` runner는 없다.

## 구성

- `autoflow` skill: goal 사용, 상태 파악, LLM Wiki 참고, PRD 발행, 루프 감시, 목표 부족분 판단.
- Desktop sidecar: 보드 상태 실시간 감지, runner 실행/중지, PTY 관리, 3개 러너 표시.
- Board: PRD, TODO, runner 상태, 로컬 검증 evidence, commit/merge evidence의 source of truth.
- Planner runner: PRD를 TODO로 분해한다.
- Worker runner: 배정 TODO를 수행한다. 로컬 검증 evidence를 남기고 `worker finalize-approved`를 호출해 PRD worktree commit을 반영한다. PRD의 마지막 TODO를 처리한 경우 같은 호출이 PRD worktree merge까지 수행한다.
- LLM Wiki runner: 완료 원장에서 파생 지식을 지연/배치로 정리한다.

## 3개 고정 Runner

Desktop sidecar는 아래 3개 러너를 표시한다.

- `Planner`
- `Worker`
- `LLM Wiki`

Runner는 고정 표시 단위다.

## PRD 발행

Skill 대화는 read-only 상태 점검 뒤 PRD를 발행한다.

1. goal과 완료 조건을 확인한다.
2. 프로젝트 구현 상태, 보드 상태, LLM Wiki를 참고한다.
3. 목표 달성에 필요한 PRD를 하나 이상 발행한다.
4. PRD에는 관찰 가능한 `Goal`, `Allowed Paths`, `Done When`, `Verification`을 둔다.
5. PRD 하나가 여러 TODO로 나뉘어야 하면 `## Work Item Split`을 둔다.

Active PRD가 있다는 이유만으로 새 PRD 발행을 금지하지 않는다. 단, 같은 범위 중복 PRD는 만들지 않는다.

## 실행 루프

```text
PRD 발행
  -> Planner: PRD 기준 TODO 생성
  -> Worker: 배정 TODO 수행
  -> Worker: 로컬 검증 evidence 기록
  -> Worker: finalize-approved로 PRD worktree에 commit 반영
  -> Worker: PRD의 모든 TODO 완료 시 PRD worktree merge
  -> skill 대화: goal 기준 부족분 확인
  -> 부족하면 PRD 추가 발행
  -> 충분하면 goal complete
```

로컬 검증이나 finalize gate가 실패하면 Worker는 실패 원인과 다음 조치를 보드에 기록한다. 실패한 작업은 완료 commit으로 반영하지 않는다.

## 상태 변수

상태 변수는 보드에 기록한다.

- `goal.state`: `active | complete | blocked`
- `prd.state`: `active | planned | in_progress | done | blocked`
- `todo.state`: `pending | running | ready_for_finalization | revise_requested | replan_requested | verified | done | blocked`
- `runner.state`: `idle | running | blocked | completed`
- `wiki.state`: `idle | deferred | running | completed`

Planner, Worker는 자신의 상태를 변경해 현재 상태를 공유한다. Desktop sidecar는 이 상태 변화를 실시간 감지한다.

## 역할 경계

- Skill 대화: goal 유지, 상태 파악, LLM Wiki 참고, PRD 발행, 루프 감시, 부족분 판단, goal complete.
- Planner: 지정 PRD에서 TODO를 만든다. 구현, 검증, merge, 위키 작성을 하지 않는다.
- Worker: 지정 TODO를 수행하고 로컬 검증 evidence를 남긴다. 검증 통과 뒤 `worker finalize-approved`를 호출해 PRD worktree commit/merge를 마무리한다.
- LLM Wiki: 파생 지식을 정리한다. source of truth가 아니며 진행을 막지 않는다.

## Goal 완료

Skill 대화는 다음이 참이면 goal을 완료할 수 있다.

1. 최초 goal의 완료 조건이 PRD/TODO/로컬 검증/commit/merge evidence로 덮인다.
2. 진행 중인 critical PRD/TODO 작업이 없다.
3. 실패한 finalize 후속조치가 남아 있지 않다.
4. 사용자 확인이 필요한 gap이 없다.

LLM Wiki 작성 여부는 완료 조건이 아니다. 위키 정리는 별도 deferred maintenance로 남긴다.
