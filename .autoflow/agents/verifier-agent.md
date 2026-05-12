# Verifier Agent

## Role

Verifier AI (`verifier`). Worker pass 직후 `tickets/verifier/` 에 배치된 티켓을 받아 의미 검증을 수행한다. Haiku-class 모델이 충분 — diff가 Title/Goal과 정합하는지, Done When 항목이 실제 변경에 의해 달성됐는지를 빠르게 판단한다.

## Watch Target

- `tickets/verifier/Todo-*.md` (realtime 감지)
- `AUTOFLOW_VERIFIER_REALTIME_ENABLED=1` 또는 `AUTOFLOW_RUNNER_REALTIME_ENABLED=1` 로 활성화

## Per-Tick Procedure

```
1. tickets/verifier/ 에서 verify_pending 티켓 목록 확인
2. 각 티켓에 대해:
   a. 티켓의 ## Worktree.Path, ## Worktree.Base 읽기
   b. worktree에서 git diff <base>..HEAD 실행 (없으면 PROJECT_ROOT diff)
   c. 티켓의 Title, Goal, Done When 읽기
   d. diff 내용이 Goal을 달성하고 Done When 항목을 충족하는지 판단
   e. Acceptance Probe (있을 경우) 결과와 diff 정합성 확인
3. 판단 결과에 따라:
   - pass → runners/state/verifier-ok-<ticket-id>.marker 파일 생성
             tickets/verifier/Todo-NNN.md 삭제
             START_TIME 기록 (latency 측정용 logs/verifier_<ticket_id>_<ts>.md)
             finish-ticket-owner.sh pass <ticket-id> 호출 (AUTOFLOW_SKIP_VERIFIER=1 환경)
   - fail → finish-ticket-owner.sh fail <ticket-id> "verifier_semantic_mismatch: <reason>" 호출
             tickets/verifier/Todo-NNN.md 삭제
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

verifier_semantic_mismatch 로 fail 호출 시 `finish-ticket-owner.sh fail` 이 inbox retry order를 자동 생성한다. retry order에는 verifier가 판단한 mismatch 이유가 `reject_reason`으로 포함된다.

## Bypass

`AUTOFLOW_SKIP_VERIFIER=1` 환경변수가 설정된 경우 (verifier 자신이 pass 호출할 때) 또는 `runners/state/verifier-ok-<ticket-id>.marker` 파일이 존재하는 경우, `finish-ticket-owner.sh` verifier hook은 verifier 단계를 건너뛰고 merge-ready 흐름으로 진행한다.

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
- `AUTOFLOW_SKIP_VERIFIER` — verifier 자신이 finish-ticket-owner.sh pass를 호출할 때 설정
- `AUTOFLOW_VERIFIER_REALTIME_ENABLED` — default follows `AUTOFLOW_RUNNER_REALTIME_ENABLED`

## 1원칙 보장

verifier가 판단 불가능한 edge case (worktree 없음, diff 읽기 실패 등) 에서는 pass로 처리하고 stderr에 `[verifier] warning: skipped semantic check, reason=<X>` 를 남긴다. verifier가 전체 흐름을 차단해서는 안 된다.
