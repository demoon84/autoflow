# Ticket

## Ticket

- ID: tickets_183
- PRD Key: prd_184
- Plan Candidate: Plan AI handoff from tickets/done/prd_184/prd_184.md
- Title: desktop detached runner reconnect policy
- Stage: todo
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated: 2026-05-05T00:23:30Z

## Goal

- 이번 작업의 목표: Electron 데스크톱 앱이 종료되거나 재시작되어도 이미 살아 있는 detached runner를 새 runner로 중복 spawn하지 않고 기존 runner 상태에 attach 하며, 앱 종료 시 runner 유지/정지 정책을 사용자가 명시적으로 선택할 수 있게 만든다.

## References

- PRD: tickets/done/prd_184/prd_184.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_184]]
- Plan Note:
- Ticket Note: [[tickets_183]]

## Allowed Paths

- `apps/desktop/src/main.js`
- `apps/desktop/src/renderer/main.tsx`
- `apps/desktop/src/renderer/styles.css`
- `apps/desktop/src/components/ui`
- `packages/cli/runners-project.sh`
- `tests/smoke/desktop-detached-runner-reconnect-smoke.sh`

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

- [ ] With a fixture board containing enabled loop runners whose state files have alive `pid` values, desktop runner list/start logic treats those runners as reconnected/attached and does not spawn duplicate `loop-worker` processes.
- [ ] If the desktop sends `autoflow runners start <runner>` and stdout contains `status=ok` plus `result=already_running`, the renderer sees a successful running runner state and runner list cache refreshes before the next displayed status.
- [ ] A normal desktop close/Cmd+Q path preserves detached runners by default; graceful stop is called only after an explicit user-selected close policy, and that policy is visible in the renderer UI.
- [ ] A previous desktop session without a clean shutdown marker is reported as an unclean desktop exit with detached runner reattach evidence; the app does not kill, restart, or delete runner state as part of that report.
- [ ] Existing memory ceiling relaunch behavior remains separate from user close policy and still has a bounded cleanup timeout before `app.relaunch()`.
- [ ] `npm --prefix apps/desktop run check`, `bash -n packages/cli/runners-project.sh`, and `bash tests/smoke/desktop-detached-runner-reconnect-smoke.sh` exit 0.

## Next Action

- 다음에 바로 이어서 할 일: Impl AI 는 이 티켓을 todo 에서 claim 한 뒤 `tickets/done/prd_184/prd_184.md`와 `tickets/done/prd_184/order_171.md`를 읽고, 데스크톱 재시작 시 detached runner attach / `already_running` success handling / 일반 종료 정책 UI를 구현한 뒤 지정 검증 명령을 실행한다.

## Resume Context

- 현재 상태 요약: Plan AI 가 backlog PRD 에서 todo 티켓을 생성한 직후.
- 직전 작업: scripts/start-plan.sh 가 PRD 를 done 으로 보관하고 todo 티켓을 만들었다.
- 재개 시 먼저 볼 것: `apps/desktop/src/main.js`의 runner list/control/cache와 memory ceiling relaunch 경로, `packages/cli/runners-project.sh`의 `result=already_running` 출력 계약, PRD의 Wiki Context와 Done When.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_184/prd_184.md at 2026-05-05T00:23:30Z.
- Wiki/ticket finding: 두 번의 wiki RAG 조회(`desktop detached runner restart Electron app.whenReady graceful stop runner state`, `order_147 graceful stop order_148 transition state runner pid`)는 모두 `result_count=0`을 반환했다. 따라서 이번 구현은 order_171 원문과 현재 repo code evidence를 기준으로 범위를 잡는다.
- Repo context finding: `apps/desktop/src/main.js`에는 `runnerControlInflight`, runner list cache refresh, `runnerShutdownInProgress`, memory ceiling relaunch cleanup이 이미 있다. 일반 앱 close 정책과 내부 relaunch cleanup을 분리해서 중복 spawn과 의도치 않은 runner stop을 막아야 한다.
- Repo context finding: `packages/cli/runners-project.sh start`는 state pid가 살아 있으면 `result=already_running`을 반환한다. Desktop은 이를 성공 attach/reconnect evidence로 소비해야 하며 별도 runner loop를 새로 만들면 안 된다.

## Verification

- Run file:
- Log file:
- Result: pending

## Result

- Summary:
- Remaining risk:
