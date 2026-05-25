# 러너와 러너 도구 계약

이 파일은 `autoflow` skill, 데스크탑 sidecar, 4개 runner, runner tool 사이의 기준 계약이다.

## 용어

- **Autoflow skill**: goal을 사용해 목표를 완료하는 사용자-facing skill. 프로젝트 상태와 LLM Wiki를 참고해 PRD를 발행하고 루프를 감시한다.
- **Desktop sidecar**: skill과 runner를 실행하고 보드 상태를 실시간 감지하는 데스크탑 앱.
- **Runner**: 데스크탑에 표시되고 실행되는 고정 작업자. `Planner`, `Worker`, `Verifier`, `LLM Wiki` 네 개다.
- **Runner process**: 각 runner가 PTY 안에서 실행하는 LLM 기반 프로세스.
- **Runner tool**: 좁은 상태 전이, ID 예약, 파일 이동, 검증 기록 같은 deterministic helper.
- **Board state**: `tickets/`, `runners/`, `metrics/`, `conversations/`, `wiki/` 아래 source of truth.

## 핵심 규칙

상태가 흐름을 만든다.

Planner, Worker, Verifier는 자신의 상태를 보드에 기록한다. 각 runner는 상태 변수를 보고 남은 작업과 다음 일을 판단한다. 데스크탑 sidecar는 보드 상태 변화를 실시간 감지해 다음 단계가 이어지게 한다.

Runner tool은 워크플로의 판단자가 아니다. 도구는 상태를 검사하고 좁은 보드 변경을 수행하며, 작업 선택, pass/revise/replan 판단, 목표 완료 판단을 하지 않는다.

## 4개 Runner

`Planner`:

- PRD를 TODO로 분해한다.
- PRD 하나에서 여러 TODO를 만들 수 있다.
- 구현, 검증, PRD worktree commit/merge, 위키 작성을 하지 않는다.

`Worker`:

- 배정된 TODO를 수행한다.
- 작업 완료 후보를 Verifier에게 넘긴다.
- Verifier pass 뒤 PRD worktree commit을 반영한다.
- PRD의 마지막 TODO를 처리한 경우 PRD worktree merge를 수행한다.
- Verifier revise/replan 후속조치에 따른다.

`Verifier`:

- Worker 결과를 검증한다.
- `pass | revise | replan`과 후속조치를 기록한다.
- 구현, PRD worktree commit/merge, 위키 작성을 하지 않는다.

`LLM Wiki`:

- 완료 원장에서 파생 지식을 정리한다.
- Wiki 결과만으로 TODO/PRD/goal 완료를 판단하지 않는다.
- Deferred maintenance이며 critical path가 아니다.

`Merge` runner나 `merge` role은 없다.

## 도구 경계

도구가 반환할 수 있는 것:

- 상태 스냅샷
- 예약된 ID
- 변경 파일 목록
- 검증 command 결과
- diff 수치
- 보드 변경 결과
- commit/merge preflight 결과

도구가 결정해서는 안 되는 것:

- 어떤 TODO를 실행할지
- `Done When`이 의미적으로 충족됐는지
- pass, revise, replan 중 무엇이 맞는지
- goal complete 여부
- runner process를 시작/중지/재시작할지

## Runner 공통 책임

1. 자기 역할 밖의 일을 하지 않는다.
2. 다른 runner를 직접 호출하지 않는다.
3. 상태 변경은 보드에 기록한다.
4. non-success는 reason/evidence와 함께 남긴다.
5. 완료 후 다음 runner가 읽을 수 있는 `Next Action`을 남긴다.
6. LLM Wiki를 source of truth로 사용하지 않는다.

## 상태 의미

- `pending`: 아직 실행되지 않았다.
- `running`: 해당 runner가 처리 중이다.
- `ready_for_verifier`: Worker가 검증을 요청했다.
- `pass`: Verifier가 목표와 evidence가 맞다고 판단했다.
- `revise`: 같은 TODO 경계 안에서 수정하면 된다.
- `replan`: TODO 경계를 다시 잡아야 한다.
- `verified`: Verifier pass 뒤 Worker commit 반영을 기다리거나 완료한 상태다.
- `done`: TODO 또는 PRD가 필요한 evidence와 함께 닫혔다.
- `blocked`: runner가 더 진행할 수 없는 상태와 이유를 남겼다.

## 변경 체크리스트

러너 도구나 상태를 바꿀 때:

1. 이 파일의 역할 경계를 먼저 갱신한다.
2. 역할별 agent 문서와 startup rule을 맞춘다.
3. `tickets-board.md`의 lane/field 설명과 맞춘다.
4. `autoflow tool runner-tool --help`, `./app/bin/autoflow tool list`, typecheck를 확인한다.
