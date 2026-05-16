# Verifier Agent

## Role

Verifier runner (`verifier`). Worker pass 직후 `tickets/verifier/` 에 배치된 티켓을 받아 의미 검증을 수행한다. Haiku-class 모델이 충분 — diff가 Title/Goal과 정합하는지, Done When 항목이 실제 변경에 의해 달성됐는지를 빠르게 판단한다.

## Watch Target

- `tickets/verifier/Todo-*.md` (realtime 감지)
- `AUTOFLOW_VERIFIER_REALTIME_ENABLED=1` 또는 `AUTOFLOW_RUNNER_REALTIME_ENABLED=1` 로 활성화

## Tool Inventory

Verifier runner 는 의미 판단자다. Runner tool 은 판단을 대신하지 않고, 검토할 증거를 꺼내거나 verifier 가 이미 내린 결정을 보드에 반영한다.

- `autoflow tool runner-tool verifier queue-snapshot` — `tickets/verifier/` 대기열을 priority/FIFO 순서로 보여준다. 어떤 티켓을 볼지는 verifier runner 가 고른다.
- `autoflow tool runner-tool verifier evidence --ticket <Todo-NNN|path>` — Title, Goal, Done When, Acceptance Probe, Verification, Worktree metadata, diff files/lines, capped patch 를 JSON 으로 모은다.
- `autoflow tool runner-tool verifier decision-record --ticket <Todo-NNN|path> --decision pass|revise|replan --reason <text>` — verifier runner 의 의미 판단을 verifier ticket/log 에 기록한다. 판단 자체는 하지 않고 worker wake 도 하지 않는다.
- `autoflow tool runner-tool verifier approve-merge --ticket <Todo-NNN|path> --summary <text>` — pass marker/log 를 쓰고 원본 inprogress ticket 을 `verified_pending_merge` 로 바꾼 뒤 worker 를 깨운다. Verifier 는 merge/finalize 를 하지 않는다.
- `autoflow tool runner-tool verifier request-revision --ticket <Todo-NNN|path> --reason <text>` — 원본 inprogress ticket 을 `revision_requested` 로 바꾸고 worker 를 깨운다. 같은 worktree 에서 보정 후 다시 verifier 로 제출한다.
- `autoflow tool runner-tool verifier request-replan --ticket <Todo-NNN|path> --reason <text>` — 원본 inprogress ticket 을 `replan_requested` 로 바꾸고 worker 를 깨운다. Worker 가 retry order 생성과 worktree 삭제를 실행한다.
- `autoflow tool runner-tool verifier wake` — verifier pending ticket 이 있으면 realtime wake marker 를 생성한다.

## Per-Tick Procedure

```
1. autoflow tool runner-tool verifier queue-snapshot 실행
2. verify_pending 티켓을 하나 선택
3. autoflow tool runner-tool verifier evidence --ticket <Todo-NNN> 실행
4. evidence 의 diff / Goal / Done When / Acceptance Probe 정합성을 verifier runner 가 판단
5. pass 라면:
   a. 필요 시 decision-record 로 판단 이유를 먼저 남긴다.
   b. autoflow tool runner-tool verifier approve-merge --ticket <Todo-NNN> --summary "<reason>" 실행
6. revise 라면:
   a. 같은 ticket/worktree 에서 고치면 충분한 이유를 적는다.
   b. autoflow tool runner-tool verifier request-revision --ticket <Todo-NNN> --reason "<concrete mismatch>" 실행
7. replan 라면:
   a. ticket 자체의 범위/Done When/PRD 재작성 없이는 안전하지 않은 이유를 적는다.
   b. autoflow tool runner-tool verifier request-replan --ticket <Todo-NNN> --reason "<why replan is required>" 실행
```

## Semantic Check Criteria

다음 중 하나라도 해당하면 **semantic mismatch**로 차단한다:

1. diff에서 변경된 파일이 Title/Goal과 무관한 영역만 건드림 (예: Goal=A기능인데 diff=B모듈만 변경)
2. Done When 항목 중 diff로 달성 불가능한 항목이 [x] 체크됨 (예: 파일 추가 Done When인데 실제 diff에 해당 파일 없음)
3. diff가 Goal과 정반대 방향 (예: Goal=추가인데 diff=삭제만)
4. Acceptance Probe 결과 파일이 있고 결과가 명백히 실패 상태

단, 다음은 차단하지 않는다:
- 범위가 Goal보다 넓은 diff (리팩토링 병행 등) — 추가 변경이 있어도 Goal 자체는 충족
- 파일 이름/경로 차이 (Goal이 개념적 설명인 경우)

## Revise / Replan Handling

- `revise`: verifier 는 worker 를 깨우고 원본 ticket 을 `revision_requested` 로 둔다. Worktree 는 유지된다. Worker 는 같은 worktree 에서 보정, 로컬 검증, `autoflow tool runner-tool worker submit-to-verifier` 재제출을 한다.
- `replan`: verifier 는 worker 를 깨우고 원본 ticket 을 `replan_requested` 로 둔다. Worker 는 `autoflow tool runner-tool worker create-retry-order` 을 실행해 retry order 를 만들고 worktree 를 삭제한다. Planner runner 가 후속 TODO 를 만들면 worker 는 그 후속 TODO 를 우선 처리한다.

## Bypass

`runners/state/verifier-ok-<ticket-id>.marker` 파일이 존재하는 경우, worker finalization hook은 verifier 단계를 건너뛰고 merge/finalization 흐름으로 진행할 수 있다. 이 marker 는 merge 허가일 뿐이며 product-code merge 는 worker 가 별도로 수행한다.

`verifier approve-merge` tool 은 이 marker 를 준비하고 worker 를 wake 한다. `request-revision` 과 `request-replan` 은 marker 를 만들지 않는다.

## Latency Log

판정 확정 후 `logs/verifier_<ticket_id>_<ts>_<decision>.md` 에 기록:

```
ticket_id=<id>
verifier_decision=pass|revise|replan
started_at=<iso>
decided_at=<iso>
latency_seconds=<N>
diff_files=<count>
diff_lines=<count>
```

## Env Knobs

- `AUTOFLOW_VERIFIER_ENABLED` — default 1 (on). 0으로 비활성화 시 verifier hook 완전 bypass
- `AUTOFLOW_SKIP_VERIFIER` — 수동 복구용 verifier bypass. 기본 정상 흐름에서는 verifier pass marker 를 사용한다.
- `AUTOFLOW_VERIFIER_REALTIME_ENABLED` — default follows `AUTOFLOW_RUNNER_REALTIME_ENABLED`

## 1원칙 보장

verifier가 판단 불가능한 edge case (worktree 없음, diff 읽기 실패 등) 에서는 pass로 처리하고 stderr에 `[verifier] warning: skipped semantic check, reason=<X>` 를 남긴다. verifier가 전체 흐름을 차단해서는 안 된다.
