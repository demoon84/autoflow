# Ticket

## Ticket

- ID: tickets_186
- PRD Key: prd_187
- Plan Candidate: Plan AI handoff from tickets/done/prd_187/prd_187.md
- Title: planner secret dependency preflight
- Stage: todo
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated: 2026-05-05T00:43:58Z

## Goal

- 이번 작업의 목표: PRD의 verification 또는 명시 메타데이터가 외부 비밀키를 요구할 때, 해당 환경변수가 없는 상태에서 planner가 todo ticket을 만들지 않고 PRD를 `needs_user_secret` 상태로 park 한다.

## References

- PRD: tickets/done/prd_187/prd_187.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_187]]
- Plan Note:
- Ticket Note: [[tickets_186]]

## Allowed Paths

- `.autoflow/scripts/start-plan.sh`
- `runtime/board-scripts/start-plan.sh`
- `.autoflow/scripts/common.sh`
- `runtime/board-scripts/common.sh`
- `.autoflow/agents/spec-author-agent.md`
- `scaffold/board/agents/spec-author-agent.md`
- `.autoflow/reference/project-spec-template.md`
- `scaffold/board/reference/project-spec-template.md`
- `tests/smoke/planner-secret-preflight-smoke.sh`

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

- [ ] A fixture PRD whose `## Verification` `Command:` references `$ANTHROPIC_API_KEY` with that env var unset causes `start-plan.sh` to exit `0`, emits `source=needs-user-secret`, `missing_secrets=ANTHROPIC_API_KEY`, `recovery_state=needs_user`, and creates no `tickets/todo/tickets_*.md`.
- [ ] The same fixture PRD is updated in backlog with `Status: needs_user_secret` and exactly one idempotent `## Notes` entry naming the missing variable and source PRD path after two repeated planner runs with the env var unset.
- [ ] When `ANTHROPIC_API_KEY=dummy` is provided for the fixture run, `start-plan.sh` creates one todo ticket from the same PRD and the ticket `Verification.Command` remains unchanged.
- [ ] A fixture PRD that mentions `ANTHROPIC_API_KEY` only in explanatory prose but not in `Verification.Command` or `Requires Secrets` is promoted to todo and is not parked as `needs_user_secret`.
- [ ] A fixture PRD with explicit `Requires Secrets: [OPENAI_API_KEY]` or YAML `requires_secrets: [OPENAI_API_KEY]` is parked when `OPENAI_API_KEY` is unset and promotes when it is set.
- [ ] The generated todo ticket for this PRD cites `tickets/done/prd_158/tickets_157.md` as the prior late-block example and keeps the scope limited to planner preflight, spec metadata guidance, and smoke tests.
- [ ] `bash -n .autoflow/scripts/start-plan.sh runtime/board-scripts/start-plan.sh .autoflow/scripts/common.sh runtime/board-scripts/common.sh tests/smoke/planner-secret-preflight-smoke.sh` exits `0`.
- [ ] `bash tests/smoke/planner-secret-preflight-smoke.sh` exits `0` and prints evidence lines for `missing_secret_blocked=1`, `idempotent_notes=1`, `secret_present_promoted=1`, and `prose_only_promoted=1`.

## Next Action

- 다음에 바로 이어서 할 일: Impl AI 는 이 티켓을 todo 에서 claim 한 뒤 `tickets/done/prd_187/prd_187.md`와 `tickets/done/prd_158/tickets_157.md`의 late secret blocker evidence를 확인하고, planner secret preflight 구현, spec metadata guide 보강, fixture smoke test 작성, 검증, 머지까지 한 턴에 끝낸다.

## Resume Context

- 현재 상태 요약: Plan AI 가 `order_156`을 `prd_187`과 `tickets_186`으로 승격했다. 작업은 `Verification.Command`와 명시 `Requires Secrets` metadata의 missing env var를 planner promote 전에 감지하는 범위로 제한된다.
- 직전 작업: `.autoflow/scripts/start-plan.sh 187`이 `prd_187`을 `tickets/done/prd_187/prd_187.md`로 보관하고 `tickets/todo/tickets_186.md`를 만들었다. 원 요청은 `tickets/done/prd_187/order_156.md`에 보존됐다.
- 재개 시 먼저 볼 것: `tickets/done/prd_187/prd_187.md`, `tickets/done/prd_158/tickets_157.md`, `.autoflow/scripts/start-plan.sh`, `runtime/board-scripts/start-plan.sh`, `.autoflow/agents/spec-author-agent.md`, `scaffold/board/agents/spec-author-agent.md`.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_187/prd_187.md at 2026-05-05T00:43:08Z.
- Planner wiki pass: `bin/autoflow wiki query --term "ANTHROPIC_API_KEY needs_user_secret planner promote start-plan external secret" --rag` returned `result_count=0`.
- Relevant prior ticket: `tickets/done/prd_158/tickets_157.md` shows `ANTHROPIC_API_KEY` was absent, static checks passed, live Anthropic API verification could not run, and planner later parked the ticket as external-secret `needs_user_decision`.
- Related recovery context: `tickets/done/prd_170/prd_170.md` addressed downstream `needs_user` / `repairing` inprogress parking. This ticket should prevent the upstream promote of secret-bound PRDs before worker time is spent.
- Scope boundary from `order_156`: implement A plus B in a narrow form: gate `Verification.Command` and explicit `Requires Secrets` / `requires_secrets`; do not add a new `tickets/needs_secret/` folder and do not broadly scan explanatory prose.
- Guard warning: `bin/autoflow guard` at 2026-05-05T00:43:58Z returned `status=warning`, `error_count=0`, `warning_count=3`; existing warnings are invalid legacy recovery class on `tickets/inprogress/tickets_166.md`, leftover worktree `autoflow/tickets_119`, and dirty done-ticket worktree `autoflow/tickets_163`. Planner recorded evidence and did not delete, reset, or manage worktrees.

## Verification

- Run file:
- Log file:
- Result: pending

## Result

- Summary:
- Remaining risk:
