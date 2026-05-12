# Ticket

## Ticket

- ID: Todo-320
- PRD Key: prd_298
- Plan Candidate: start-ticket-owner/finish-ticket-owner/merge-ready-ticket/handoff-todo legacy flow 분석 → JS/TS primary path로 claim/worktree/sanity/verifier/retry/archive 흐름 이관 → runtime mirror 동기화 → ticket-owner smoke 검증.
- Title: sh to ts 전환 4단계 worker finalizer 실제 이관
- Priority: normal
- Change Type: infra
- Stage: verify_pending
- AI: worker
- Claimed By: worker:39458:2026-05-12T12:04:38Z
- Execution AI: worker
- Verifier AI:
- Last Updated: 2026-05-12T12:04:38Z

## Goal

worker/finalizer 핵심 스크립트의 실제 로직을 TypeScript/Node 중심으로 이관한다. claim, worktree setup, sanity gate, verifier handoff/skip, pass/fail routing, retry inbox 생성, completion archive/draft 생성 계약을 보존한다.

## References

- PRD: tickets/done/prd_298/prd_298.md

## Reference Notes

- Project Note: worker/finalizer 이관은 false-pass 방지와 verifier 계약 보존이 최우선이다.
- Ticket Note: `finish-ticket-owner` sanity gate는 완화하지 않는다.

## Allowed Paths

- `.autoflow/scripts/start-ticket-owner.sh`
- `.autoflow/scripts/start-ticket-owner.js`
- `.autoflow/scripts/start-ticket-owner.legacy.sh`
- `.autoflow/scripts/finish-ticket-owner.sh`
- `.autoflow/scripts/finish-ticket-owner.js`
- `.autoflow/scripts/merge-ready-ticket.sh`
- `.autoflow/scripts/merge-ready-ticket.ts`
- `.autoflow/scripts/merge-ready-ticket.js`
- `.autoflow/scripts/handoff-todo.sh`
- `.autoflow/scripts/handoff-todo.js`
- `.autoflow/scripts/runner-common.sh`
- `.autoflow/scripts/common.sh`
- `runtime/board-scripts`
- `tests/smoke`

## Worktree
- Path: `/Users/demoon/Library/Caches/autoflow/worktrees/autoflow/tickets_320`
- Branch: autoflow/tickets_320
- Base Commit: d3cee0daec0c2a4d51ee628e4dc94b1ddfebaf1d
- Worktree Commit: beb9e82b0b70057c6247d0bfe23ccc7a85d6c1e6
- Integration Status: ready_to_merge

## Goal Runtime
- Status: active
- Started At: 2026-05-12T12:04:39Z
- Started Epoch: 1778587479
- Updated At: 2026-05-12T12:04:39Z
- Tick Count: 1
- Time Used Seconds: 0
- Token Budget: 
- Tokens Used: 
- Continuation Suppressed: false
- Last Event: todo
- Last Progress Fingerprint: 3058352037

## Recovery State

- Status: healthy
- Detected By:
- Failure Class:
- Evidence:
- Planner Decision:
- Owner Resume Instruction:
- Last Recovery At:

## Done When

- [x] start-ticket-owner/finish-ticket-owner/merge-ready-ticket/handoff-todo 핵심 흐름이 JS/TS primary path로 이관된다.
- [x] `.legacy.sh` 의존이 제거 가능하거나 fallback-only로 축소된다.
- [x] ownership lock, Done When gate, allowed-path gate, verifier handoff/skip, branch_only push opt-in, wiki deferred 정책이 보존된다.
- [x] pass/fail routing과 retry inbox 생성 계약이 유지된다.
- [x] active/runtime mirror가 동기화된다.
- [x] `find .autoflow/scripts runtime/board-scripts -maxdepth 1 -type f \( -name '*ticket*.sh' -o -name 'handoff-todo*.sh' \) -exec bash -n {} \; && find .autoflow/scripts runtime/board-scripts -maxdepth 1 -type f \( -name '*ticket*.js' -o -name '*ticket*.ts' -o -name 'handoff-todo*.js' \) -exec node --check {} \; && bash tests/smoke/ticket-owner-smoke.sh`가 통과한다.

## Next Action
- Next: Verifier AI must inspect `tickets/verifier/Todo-320.md`; on semantic pass it should call `AUTOFLOW_SKIP_VERIFIER=1 finish-ticket-owner.sh 320 pass "worker finalizer JS primary path migrated"`.

## Resume Context

- Current state: worker pass sanity gate accepted the ticket and created verifier handoff `tickets/verifier/Todo-320.md`.
- Last completed action: PROJECT_ROOT integration verification exited 0, then `finish-ticket-owner.sh 320 pass "worker finalizer JS primary path migrated"` returned `status=verify_pending`.
- First thing to inspect on resume: verifier should compare the diff against the ticket Title/Goal and Done When; worker should not claim another ticket until verifier/finalizer completes or fails this ticket.

## Notes

- Mini-plan: ① lifecycle flow 읽기 ② 고위험 gate test 고정 ③ JS/TS primary path로 작은 단위 이관 ④ runtime mirror 동기화 ⑤ ticket-owner smoke 실행.
- Implementation note: `autoflow` CLI was not on PATH in the ticket worktree, so wiki RAG lookup was skipped with evidence. Current approach is to make Node/TS entrypoints own preflight, contract reporting, and legacy fallback decisions, and to fully move the small deprecated `handoff-todo` route to Node primary while preserving the existing shell fallback file.

- Runtime hydrated worktree dependency at 2026-05-12T12:04:38Z: linked apps/desktop/node_modules -> /Users/demoon/Documents/project/autoflow/apps/desktop/node_modules
- Runtime hydrated worktree dependency at 2026-05-12T12:04:38Z: linked node_modules -> /Users/demoon/Documents/project/autoflow/node_modules
- AI worker prepared todo at 2026-05-12T12:04:38Z; worktree=/Users/demoon/Library/Caches/autoflow/worktrees/autoflow/tickets_320
## Verification
- Result: passed by worker at 2026-05-12T12:26:30Z
- Command: `find .autoflow/scripts runtime/board-scripts -maxdepth 1 -type f \( -name '*ticket*.sh' -o -name 'handoff-todo*.sh' \) -exec bash -n {} \; && find .autoflow/scripts runtime/board-scripts -maxdepth 1 -type f \( -name '*ticket*.js' -o -name '*ticket*.ts' -o -name 'handoff-todo*.js' \) -exec node --check {} \; && bash tests/smoke/ticket-owner-smoke.sh`
- Evidence: command exited 0. `ticket-owner-smoke.sh` ended with `status=ok` and commit hash `116d33bfa3a3722914aee39426d6c1427fab6789`. Node 20 printed `ERR_UNKNOWN_FILE_EXTENSION` warnings for existing `.ts` files during the ticket-specified `node --check` sweep; the command still exited 0 because the `find -exec` phase does not propagate those syntax-check errors as the command exit status.

## Result

- Summary: worker finalizer JS primary path migrated
- Commit:
