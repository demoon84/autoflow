# Ticket

## Ticket

- ID: Todo-320
- PRD Key: prd_298
- Plan Candidate: start-ticket-owner/finish-ticket-owner/merge-ready-ticket/handoff-todo legacy flow 분석 → JS/TS primary path로 claim/worktree/sanity/verifier/retry/archive 흐름 이관 → runtime mirror 동기화 → ticket-owner smoke 검증.
- Title: sh to ts 전환 4단계 worker finalizer 실제 이관
- Priority: normal
- Change Type: infra
- Stage: todo
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated: 2026-05-12T07:55:00Z

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

- Branch:
- Path:
- Base:
- Created At:

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
- Last Lint Status:
- Last Lint Vagueness Score:

## Recovery State

- Status: healthy
- Detected By:
- Failure Class:
- Evidence:
- Planner Decision:
- Owner Resume Instruction:
- Last Recovery At:

## Done When

- [ ] start-ticket-owner/finish-ticket-owner/merge-ready-ticket/handoff-todo 핵심 흐름이 JS/TS primary path로 이관된다.
- [ ] `.legacy.sh` 의존이 제거 가능하거나 fallback-only로 축소된다.
- [ ] ownership lock, Done When gate, allowed-path gate, verifier handoff/skip, branch_only push opt-in, wiki deferred 정책이 보존된다.
- [ ] pass/fail routing과 retry inbox 생성 계약이 유지된다.
- [ ] active/runtime mirror가 동기화된다.
- [ ] `find .autoflow/scripts runtime/board-scripts -maxdepth 1 -type f \( -name '*ticket*.sh' -o -name 'handoff-todo*.sh' \) -exec bash -n {} \; && find .autoflow/scripts runtime/board-scripts -maxdepth 1 -type f \( -name '*ticket*.js' -o -name '*ticket*.ts' -o -name 'handoff-todo*.js' \) -exec node --check {} \; && bash tests/smoke/ticket-owner-smoke.sh`가 통과한다.

## Next Action

가장 먼저 `finish-ticket-owner` sanity gate와 `start-ticket-owner` claim/worktree setup 흐름을 읽고, 이식 순서와 smoke 보호 범위를 확정한다.

## Resume Context

- Current state: ticket 생성됨, worker 클레임 대기 중.
- Last completed action: order_319를 prd_298/Todo-320으로 승격했다.
- First thing to inspect on resume: `finish-ticket-owner` sanity gate와 `start-ticket-owner` ownership/worktree setup 흐름.

## Notes

- Mini-plan: ① lifecycle flow 읽기 ② 고위험 gate test 고정 ③ JS/TS primary path로 작은 단위 이관 ④ runtime mirror 동기화 ⑤ ticket-owner smoke 실행.

## Verification

- Command: `find .autoflow/scripts runtime/board-scripts -maxdepth 1 -type f \( -name '*ticket*.sh' -o -name 'handoff-todo*.sh' \) -exec bash -n {} \; && find .autoflow/scripts runtime/board-scripts -maxdepth 1 -type f \( -name '*ticket*.js' -o -name '*ticket*.ts' -o -name 'handoff-todo*.js' \) -exec node --check {} \; && bash tests/smoke/ticket-owner-smoke.sh`
- Run file:
- Result:

## Result

- Summary:
- Commit:
