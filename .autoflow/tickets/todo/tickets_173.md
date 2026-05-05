# Ticket

## Ticket

- ID: tickets_173
- PRD Key: prd_174
- Plan Candidate: Plan AI handoff from tickets/done/prd_174/prd_174.md
- Title: runner config apply feedback
- Stage: todo
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated: 2026-05-04T21:58:27Z

## Goal

- 이번 작업의 목표: 데스크톱에서 AI runner 설정 저장 IPC 응답을 실제 적용 완료로 오해하지 않도록, runner state 에 적용 시점 증거를 기록하고 저장 버튼/카드가 새 설정 적용 전까지 명확한 대기 상태를 유지하게 한다.

## References

- PRD: tickets/done/prd_174/prd_174.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_174]]
- Plan Note:
- Ticket Note: [[tickets_173]]

## Allowed Paths

- `apps/desktop/src/renderer/main.tsx`
- `apps/desktop/src/renderer/styles.css`
- `apps/desktop/src/main.js`
- `packages/cli/runners-project.sh`
- `packages/cli/run-role.sh`

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

- [ ] `packages/cli/run-role.sh` 또는 동등한 runner tick 진입부가 현재 runner config fingerprint 와 적용값을 `.autoflow/runners/state/<runner>.state` 에 기록하고, fingerprint 변화가 감지된 tick 에 `config_applied_at=<ISO>` 또는 동등 필드를 갱신한다.
- [ ] `apps/desktop/src/main.js` 의 `autoflow:configureRunner` / `autoflow:readBoard` 경로가 저장된 config fingerprint 또는 updated timestamp 와 runner state 의 applied fingerprint / `config_applied_at` 을 renderer 가 비교할 수 있는 형태로 전달한다.
- [ ] `apps/desktop/src/renderer/main.tsx` 에서 설정 저장 클릭 후 action key 가 `config_applying` 계열로 유지되고, 새 설정 적용 증거가 board polling 또는 state refresh 로 확인되기 전까지 저장 버튼과 같은 runner 의 config/run/dry-run/start/stop/restart 액션이 중복 실행되지 않는다.
- [ ] 적용 대기 중 저장 버튼은 spinner 와 `저장 중...` 또는 `적용 대기...` 라벨을 표시하고, runner 카드에는 적용 대기 badge 가 표시된다.
- [ ] 적용 확인 시 action key 가 해제되고 완료 토스트가 표시되며, timeout(`interval_seconds + 30s` 또는 최소 90초) 시 action key 가 해제되고 경고 토스트가 표시된다.
- [ ] "저장하고 재시작"은 명시 선택 시에만 실행되며, 저장 IPC 성공 후 restart를 이어 실행하고 state 가 running + 새 applied fingerprint 를 보일 때까지 transition UI 를 유지한다.
- [ ] 다중 runner 저장은 runner id 별로 독립 추적되고, 한 runner 의 적용 대기가 다른 runner 의 설정 저장을 막지 않는다.
- [ ] `npm run desktop:check` exits 0.
- [ ] `bash -n packages/cli/runners-project.sh packages/cli/run-role.sh` exits 0.

## Next Action

- 다음에 바로 이어서 할 일: Impl AI 는 이 티켓을 todo 에서 claim 한 뒤 `runnerActionKeys` / `configureRunner` / runner state 적용 증거 흐름을 먼저 읽고, config save transition 을 실제 적용 시점까지 유지하도록 구현한다.

## Resume Context

- 현재 상태 요약: Plan AI 가 `tickets/inbox/order_158.md` 를 `prd_174` / `tickets_173` 으로 승격했다. 범위는 runner config 저장 UX + runner state 적용 증거로 제한한다.
- 직전 작업: `scripts/start-plan.sh 174` 가 PRD 를 `tickets/done/prd_174/prd_174.md` 로 보관하고 `tickets/todo/tickets_173.md` 를 만들었다 (`lint_status=ok`, `lint_vagueness_score=0`).
- 재개 시 먼저 볼 것: `apps/desktop/src/renderer/main.tsx` 의 `runnerActionKeys` / `setRunnerAction` / config save 흐름, `apps/desktop/src/main.js` 의 `configureRunner` / `readBoard` snapshot, `packages/cli/run-role.sh` 의 runner tick config read 지점.
- Wiki/ticket constraints: wiki RAG query for order_158 terms returned `result_count=0`. Related ticket evidence is in `tickets/done/prd_167/prd_167.md` (order_147 graceful stop) and `tickets/done/prd_169/prd_169.md` (order_148 stale worker state reset); reuse the IPC-response-is-not-completion principle without reopening those scopes.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_174/prd_174.md at 2026-05-04T21:58:04Z.
- Planner scope decision at 2026-05-04T21:58:27Z: keep this as a separate high-priority config-apply feedback ticket. Do not merge it into order_147/order_148 work because config save completion depends on runner config applied evidence, not start/stop state transition.

## Verification

- Run file:
- Log file:
- Result: pending

## Result

- Summary:
- Remaining risk:
