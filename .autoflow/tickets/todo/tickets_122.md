# Ticket

## Ticket

- ID: tickets_122
- PRD Key: prd_123
- Plan Candidate: Plan AI handoff from tickets/done/prd_123/prd_123.md
- Title: AI work for prd_123
- Stage: todo
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated: 2026-05-03T06:11:23Z

## Goal

- 이번 작업의 목표: Implement the approved spec for prd_123.

## References

- PRD: tickets/done/prd_123/prd_123.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_123]]
- Plan Note:
- Ticket Note: [[tickets_122]]

## Allowed Paths

- packages/cli/metrics-project.sh
- packages/cli/run-role.sh

## Worktree

- Path:
- Branch:
- Base Commit:
- Worktree Commit:
- Integration Status: pending_claim

## Goal Runtime

- Status:
- Started At:
- Started Epoch:
- Updated At:
- Tick Count: 0
- Time Used Seconds: 0
- Token Budget:
- Tokens Used:
- Continuation Suppressed: false
- Last Event:
- Last Progress Fingerprint:
- Iteration Fingerprints: []
- Last Lint Status: ok
- Last Lint Vagueness Score: 0

## Recovery State

- Status: healthy
- Detected By:
- Failure Class:
- Evidence:
- Planner Decision:
- Owner Resume Instruction:
- Last Recovery At:

## Done When

- [ ] `time bin/autoflow metrics /Users/demoon2016/Documents/project/autoflow .autoflow` 의 real wall time 이 5초 미만이다 (현재 약 4분 36초 대비). 측정은 5회 평균.
- [ ] 위 명령의 stdout 에 출력되는 `autoflow_token_usage_count=N` 의 N 이 `bin/autoflow telemetry query --target runs --since 1970-01-01 | jq -s 'map(.token_input + .token_output) | add // 0'` 의 결과와 정확히 일치한다.
- [ ] worker 또는 planner runner 1 tick 을 실제로 실행한 직후 `.autoflow/runners/logs/` 디렉토리에 새 `_stdout.log` 파일이 생성되지 않는다 (`*.loop.stdout.log` 와 `_live_stdout.log` 는 영향 없음).
- [ ] `.autoflow/telemetry/runs.jsonl` 가 존재하지 않는 fresh board 에 대해 `bin/autoflow metrics` 를 실행하면 `autoflow_token_usage_count=0`, `autoflow_token_report_count=0` 이 나오고 exit 0 으로 끝난다.
- [ ] `metrics-project.sh` 에서 `token_cache_file` / `token_cache_next` / `token_usage_from_file` / `compute_runner_log_token_usage` 식별자가 더 이상 참조되지 않는다 (`grep -n` 결과 0 라인).
- [ ] `metrics/daily.jsonl --write` 모드 (`bin/autoflow metrics ... --write`) 실행 후 새 행이 추가되고, 기존 행의 키 이름과 타입이 그대로 유지된다 (jq schema diff 결과 키 추가/제거 0 건).
- [ ] readBoard IPC 가 30초 안에 응답한다 (cleanup + telemetry 기반 metrics 결합 효과).
- [ ] `npm run desktop:check` 가 exit 0 으로 통과한다.

## Next Action

- 다음에 바로 이어서 할 일: Plan AI 가 Allowed Paths 와 Done When 을 PRD 기준으로 더 좁힌다. Impl AI 는 이 티켓을 todo 에서 claim 한 뒤 mini-plan, 구현, 검증, 머지까지 한 턴에 끝낸다.

## Resume Context

- 현재 상태 요약: Plan AI 가 backlog PRD 에서 todo 티켓을 생성한 직후.
- 직전 작업: scripts/start-plan.sh 가 PRD 를 done 으로 보관하고 todo 티켓을 만들었다.
- 재개 시 먼저 볼 것: PRD, Goal, Allowed Paths, Done When.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_123/prd_123.md at 2026-05-03T06:11:23Z.

## Verification

- Run file:
- Log file:
- Result: pending

## Result

- Summary:
- Remaining risk:
