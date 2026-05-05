# Ticket

## Ticket

- ID: tickets_184
- PRD Key: prd_185
- Plan Candidate: Plan AI handoff from tickets/done/prd_185/prd_185.md
- Title: Self-monitoring agent 도입과 monitor runner 표준화
- Stage: todo
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated: 2026-05-05T00:29:47Z

## Goal

- 이번 작업의 목표: Autoflow 가 별도 monitor runner 로 runner 상태, board 적체, telemetry/metrics 이상, dirty root, needs_user 신호를 주기적으로 점검하고, 반복/critical 신호를 보수적으로 `tickets/inbox/order_NNN.md` 또는 `tickets/check/check_NNN.md` evidence 로 발행하게 만든다.

## References

- PRD: tickets/done/prd_185/prd_185.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_185]]
- Plan Note:
- Ticket Note: [[tickets_184]]

## Allowed Paths

- `packages/cli/run-role.sh`
- `runtime/board-scripts/run-role.sh`
- `packages/cli/monitor-project.sh`
- `bin/autoflow`
- `.autoflow/scripts/start-monitor.sh`
- `runtime/board-scripts/start-monitor.sh`
- `packages/cli/package-board-common.sh`
- `.autoflow/runners/config.toml`
- `packages/cli/runners-project.sh`
- `runtime/board-scripts/runners-project.sh`
- `packages/cli/doctor-project.sh`
- `.autoflow/agents/monitor-agent.md`
- `.autoflow/README.md`
- `.autoflow/automations/README.md`
- `AGENTS.md`
- `apps/desktop/src/main.js`
- `apps/desktop/src/renderer/main.tsx`
- `apps/desktop/src/renderer/styles.css`
- `apps/desktop/src/components/ui`
- `tests/smoke/monitor-agent-smoke.sh`

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

- [ ] `autoflow run monitor <project-root> .autoflow --runner monitor --dry-run` 또는 동등한 monitor role dry-run 이 `status=ok`, `role=monitor`, `runtime_role=monitor`, `runtime_script=start-monitor.sh` 를 출력하며 unknown role 로 실패하지 않는다.
- [ ] `bash bin/autoflow monitor scan "$PWD" .autoflow` 가 runner state, board queue, telemetry/metrics, dirty root, needs_user 신호를 읽고 `signal_count=`, `signal.<n>.type=`, `signal.<n>.severity=`, `signal.<n>.confidence=`, `order_created=` 또는 `duplicate_suppressed=` key=value 를 출력한다.
- [ ] Temp board smoke 에서 같은 `last_result` 3회 반복 fixture 를 넣으면 `priority: high` 또는 `critical`, `source: autoflow-monitor-agent`, fingerprint evidence, suggested next action 을 포함한 `tickets/inbox/order_NNN.md` 가 1건 생성된다.
- [ ] 같은 fixture 를 cooldown 안에서 두 번 실행하면 두 번째 tick 은 새 order 를 만들지 않고 같은 fingerprint 의 duplicate suppression evidence 를 남긴다.
- [ ] Telemetry/token-cache 불일치 fixture 에서 source A/B 값과 비율을 order 본문에 기록하고 `confidence=confirmed` 로 분류한다.
- [ ] `Recovery State` 의 실제 field 값이 `needs_user` 인 ticket 만 needs_user signal 로 잡고, 본문 텍스트나 과거 notes 의 단어 매칭만으로 false positive 를 만들지 않는다.
- [ ] `AUTOFLOW_MONITOR_ENABLED=0` 이면 monitor scan 이 `status=idle` 또는 `monitor_disabled=true` evidence 를 남기고 order/check 를 생성하지 않는다.
- [ ] Default `.autoflow/runners/config.toml` 과 installed-board packaging 이 `monitor` runner, `monitor-agent.md`, `start-monitor.sh` 를 포함한다.
- [ ] Desktop 에서 monitor runner 는 사람이 읽는 역할명으로 표시되고, 최근 monitor signal/order/check 로 이동할 수 있는 카드 또는 상태 표시가 AI 진행 현황/통계 영역에 노출된다.
- [ ] `bash -lc 'bash -n packages/cli/run-role.sh runtime/board-scripts/run-role.sh packages/cli/monitor-project.sh .autoflow/scripts/start-monitor.sh runtime/board-scripts/start-monitor.sh packages/cli/runners-project.sh runtime/board-scripts/runners-project.sh packages/cli/doctor-project.sh && bash tests/smoke/monitor-agent-smoke.sh && npm --prefix apps/desktop run check'` exits 0.

## Next Action

- 다음에 바로 이어서 할 일: Impl AI 는 이 티켓을 todo 에서 claim 한 뒤 `tickets/done/prd_185/prd_185.md`와 `tickets/done/prd_185/order_172.md`를 읽고, monitor role/runtime/CLI/desktop 표시/packaging 문서화를 구현한 뒤 지정 검증 명령을 실행한다.

## Resume Context

- 현재 상태 요약: Plan AI 가 backlog PRD 에서 todo 티켓을 생성한 직후.
- 직전 작업: scripts/start-plan.sh 가 PRD 를 done 으로 보관하고 todo 티켓을 만들었다.
- 재개 시 먼저 볼 것: `packages/cli/run-role.sh`와 `runtime/board-scripts/run-role.sh`의 role dispatch, `packages/cli/runners-project.sh`와 `packages/cli/doctor-project.sh`의 role validation, `bin/autoflow` subcommand dispatch, desktop runner role label/health UI.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_185/prd_185.md at 2026-05-05T00:29:47Z.
- Wiki finding: self-monitoring / monitor runner / 관련 order 키워드로 wiki RAG 조회를 실행했지만 `result_count=0`이었다. 이번 구현은 `order_172` 원문, 관련 완료 order, 현재 repo code evidence 를 기준으로 범위를 잡는다.
- Related ticket finding: `tickets/done/prd_160/order_146.md`는 self-learning 형제 루프다. 이 ticket은 skill 자동 활용이 아니라 monitor 신호 검출과 auto-order/check 발행에 집중한다.
- Related ticket finding: `tickets/done/prd_143/order_135.md`는 `check_NNN.md`를 자동 개입 사후 확인 ledger 로 정의했다. Monitor 는 새 운영 신호는 inbox order 로, 자동 개입 결과는 check 로 분리해야 한다.
- Related ticket finding: `tickets/done/prd_147/order_139.md`는 resource defense/circuit breaker 요구를 담고 있다. 이 ticket은 강제 halt/cleanup 구현이 아니라 증상 검출과 follow-up 발행까지로 제한한다.
- Related ticket finding: `tickets/inbox/order_159.md`는 stale heartbeat false alarm 문제를 설명한다. Monitor 는 long-running LLM 호출을 즉시 stuck 으로 보지 않도록 conservative threshold 와 cross-verification 을 사용해야 한다.
- Related ticket finding: `tickets/done/prd_180/order_168.md`의 worker `token_budget_exceeded` 3회 반복 사례를 smoke fixture 로 사용한다.
- Repo context finding: 현재 `run-role.sh`, `runners-project.sh`, `doctor-project.sh`, desktop role labels, `bin/autoflow` dispatch 는 `monitor` role/subcommand 를 아직 지원하지 않는다. 구현은 package/runtime mirror 와 installed-board packaging 을 함께 갱신해야 한다.

## Verification

- Command: `bash -lc 'bash -n packages/cli/run-role.sh runtime/board-scripts/run-role.sh packages/cli/monitor-project.sh .autoflow/scripts/start-monitor.sh runtime/board-scripts/start-monitor.sh packages/cli/runners-project.sh runtime/board-scripts/runners-project.sh packages/cli/doctor-project.sh && bash tests/smoke/monitor-agent-smoke.sh && npm --prefix apps/desktop run check'`
- Run file:
- Log file:
- Result: pending

## Result

- Summary:
- Remaining risk:
