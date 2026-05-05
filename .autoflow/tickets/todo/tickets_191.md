# Ticket

## Ticket

- ID: tickets_191
- PRD Key: prd_192
- Plan Candidate: Plan AI handoff from tickets/done/prd_192/prd_192.md
- Title: desktop runner transition action guard
- Priority: high
- Stage: todo
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated: 2026-05-05T13:29:14Z

## Goal

- 이번 작업의 목표: AI runner start/stop/restart 처리가 IPC 응답 직후가 아니라 실제 runner state transition 완료 시점까지 진행 중으로 유지되게 하여, 중복 클릭으로 인한 race condition 과 중복 spawn 가능성을 막는다.

## References

- PRD: tickets/done/prd_192/prd_192.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_192]]
- Plan Note:
- Ticket Note: [[tickets_191]]

## Allowed Paths

- `apps/desktop/src/renderer/main.tsx`
- `apps/desktop/src/renderer/styles.css`
- `apps/desktop/src/main.js`

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

- [ ] Start 클릭 후 IPC 응답이 먼저 도착해도 해당 runner 의 control buttons remain disabled until observed runner state has `status=running`.
- [ ] Graceful stop 클릭 후 `stop_pending=true` 또는 equivalent pending evidence 가 관찰되는 동안 stop UI shows `중지 예약 중...` with a spinner, and normal start/restart/config/run/dry-run actions for that runner remain disabled until `status=stopped`.
- [ ] Graceful stop pending 중 force stop 경로는 확인 다이얼로그를 통해서만 활성화되고, force 선택 후 UI shows `강제 종료 중...` until `status=stopped`.
- [ ] Restart 클릭 후 action state remains active through the stop and subsequent start phases, and clears only after the final target state is observed.
- [ ] Transition state is tracked per runner id: one runner in `"starting"` or `"stopping_pending"` does not disable controls for another runner.
- [ ] If no target state is observed within 60 seconds, action state is cleared and a Korean warning toast tells the user that state 확인이 실패했으며 새로고침 또는 재시도를 권장한다.
- [ ] `apps/desktop/src/renderer/main.tsx` no longer clears start/stop/restart action state solely in the `finally` branch of the IPC call; the clear path is tied to state observation or timeout fallback.
- [ ] `npm run desktop:check` exits 0.

## Next Action

- 다음에 바로 이어서 할 일: Plan AI 가 Allowed Paths 와 Done When 을 PRD 기준으로 더 좁힌다. Impl AI 는 이 티켓을 todo 에서 claim 한 뒤 mini-plan, 구현, 검증, 머지까지 한 턴에 끝낸다.

## Resume Context

- 현재 상태 요약: Plan AI 가 backlog PRD 에서 todo 티켓을 생성한 직후.
- 직전 작업: scripts/start-plan.sh 가 PRD 를 done 으로 보관하고 todo 티켓을 만들었다.
- 재개 시 먼저 볼 것: PRD, Goal, Allowed Paths, Done When. `tickets/done/prd_167/prd_167.md` 는 graceful stop runtime semantics 를 소유하므로 이 티켓은 UI action guard 와 state observation 에만 집중한다.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_192/prd_192.md at 2026-05-05T13:29:14Z.
- Planner wiki pass: `runnerActionKeys start stop disabled transition order_147 graceful stop desktop runner state polling`, `AI runner start stop button disabled state transition force stop restart desktop controls`, `order_147 PRD_135 stop_pending graceful_stop_completed runner state file watch short poll` RAG queries all returned `result_count=0`.
- Relevant ticket boundary: `tickets/done/prd_167/prd_167.md` / `tickets/done/prd_167/order_147.md` define `stop_pending`, graceful completion, and force stop confirmation semantics. Do not rewrite CLI/runtime stop behavior here.
- Related prior pattern: `tickets/done/prd_174/prd_174.md` uses the same "IPC response is not completion" principle for config apply feedback; reuse the state-observation principle for runner buttons without reopening config-save scope.
- Related runner-state boundary: `tickets/done/prd_135/prd_135.md` owns stop marker/self-resurrect semantics, so this ticket should not change those state fields.

## Verification

- Run file:
- Log file:
- Result: pending

## Result

- Summary:
- Remaining risk:
