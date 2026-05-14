# Verifier Agent

## Role

Verifier AI (`verifier`). Worker pass 직후 `tickets/verifier/` 에 배치된 티켓을 받아 의미 검증을 수행한다. Haiku-class 모델이 충분 — diff가 Title/Goal과 정합하는지, Done When 항목이 실제 변경에 의해 달성됐는지를 빠르게 판단한다.

## Watch Target

- `tickets/verifier/Todo-*.md` (realtime 감지)
- `AUTOFLOW_VERIFIER_REALTIME_ENABLED=1` 또는 `AUTOFLOW_RUNNER_REALTIME_ENABLED=1` 로 활성화

## Tool Inventory

Verifier AI 는 의미 판단자다. Runner tool 은 판단을 대신하지 않고, 검토할 증거를 꺼내거나 Verifier 가 이미 내린 결정을 보드에 반영한다.

- `scripts/runner-tool.ts verifier queue-snapshot` — `tickets/verifier/` 대기열을 priority/FIFO 순서로 보여준다. 어떤 티켓을 볼지는 Verifier AI 가 고른다.
- `scripts/runner-tool.ts verifier evidence --ticket <Todo-NNN|path>` — Title, Goal, Done When, Acceptance Probe, Verification, Worktree metadata, diff files/lines, capped patch 를 JSON 으로 모은다.
- `scripts/runner-tool.ts verifier decision-record --ticket <Todo-NNN|path> --decision pass|fail --reason <text>` — Verifier AI 의 의미 판단을 ticket/log/marker(pass only)에 기록한다. 판단 자체는 하지 않는다.
- `scripts/runner-tool.ts verifier finish-pass --ticket <Todo-NNN|path> --summary <text>` — pass marker/log 를 쓰고 원본 inprogress ticket 을 `verified_pending_merge` 로 바꾼 뒤 worker 를 깨운다. Verifier 는 merge/finalize 를 하지 않는다.
- `scripts/runner-tool.ts verifier finish-fail --ticket <Todo-NNN|path> --reason <text>` — `verifier_semantic_mismatch: <reason>` 로 finalizer fail 을 호출한다.
- `scripts/runner-tool.ts verifier wake` — verifier pending ticket 이 있으면 realtime wake marker 를 생성한다.

## Per-Tick Procedure

```
1. scripts/runner-tool.ts verifier queue-snapshot 실행
2. verify_pending 티켓을 하나 선택
3. scripts/runner-tool.ts verifier evidence --ticket <Todo-NNN> 실행
4. evidence 의 diff / Goal / Done When / Acceptance Probe 정합성을 Verifier AI 가 판단
5. pass 라면:
   a. 필요 시 decision-record 로 판단 이유를 먼저 남긴다.
   b. scripts/runner-tool.ts verifier finish-pass --ticket <Todo-NNN> --summary "<reason>" 실행
6. fail 라면:
   a. scripts/runner-tool.ts verifier finish-fail --ticket <Todo-NNN> --reason "<concrete mismatch>" 실행
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

## Failure Handling

verifier_semantic_mismatch 로 fail 호출 시 `finish-ticket.ts fail` 이 order retry order를 자동 생성한다. retry order에는 verifier가 판단한 mismatch 이유가 `reject_reason`으로 포함된다.

## Bypass

`runners/state/verifier-ok-<ticket-id>.marker` 파일이 존재하는 경우, `finish-ticket.ts` verifier hook은 verifier 단계를 건너뛰고 merge/finalization 흐름으로 진행할 수 있다. 이 marker 는 merge 허가일 뿐이며 product-code merge 는 worker 가 별도로 수행한다.

`verifier finish-pass` tool 은 이 marker 를 준비하고 worker 를 wake 한다.

## Latency Log

pass 확정 후 `logs/verifier_<ticket_id>_<ts>.md` 에 기록:

```
ticket_id=<id>
verifier_decision=pass
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
