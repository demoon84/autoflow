# Ticket

## Ticket

- ID: tickets_086
- PRD Key: prd_088
- Plan Candidate: Plan AI handoff from tickets/done/prd_088/prd_088.md
- Title: Done When 완료 항목 체크 표시
- Stage: todo
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated: 2026-05-01T00:32:23Z

## Goal

- 이번 작업의 목표: Ticket Owner와 verification completion 흐름에서 실제로 충족된 `## Done When` 체크리스트 항목을 ticket 문서에 `[x]`로 남겨, 완료/반려 판단 근거가 ticket 자체에 보이게 한다.

## References

- PRD: tickets/done/prd_088/prd_088.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_088]]
- Plan Note:
- Ticket Note: [[tickets_086]]

## Allowed Paths

- `.autoflow/agents/ticket-owner-agent.md`
- `.autoflow/agents/verifier-agent.md`
- `.autoflow/reference/ticket-template.md`
- `.autoflow/rules/verifier/checklist-template.md`
- `.autoflow/rules/verifier/verification-template.md`
- `.autoflow/scripts/verify-ticket-owner.sh`
- `.autoflow/scripts/finish-ticket-owner.sh`
- `.autoflow/scripts/common.sh`
- `runtime/board-scripts/verify-ticket-owner.sh`
- `runtime/board-scripts/finish-ticket-owner.sh`
- `runtime/board-scripts/common.sh`
- `tests/smoke/ticket-owner-smoke.sh`

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

## Recovery State

- Status: healthy
- Detected By:
- Failure Class:
- Evidence:
- Planner Decision:
- Owner Resume Instruction:
- Last Recovery At:

## Done When

- [ ] Ticket Owner instructions require updating ticket `## Done When` checklist state before `finish-ticket-owner.sh pass` or `finish-ticket-owner.sh fail`.
- [ ] Legacy verifier instructions require marking satisfied `## Done When` items as `[x]` and leaving unmet items as `[ ]` before routing to done/reject.
- [ ] `ticket-template.md` and verifier checklist/template describe `Done When` as a checklist whose checked state reflects observed completion.
- [ ] When Ticket Owner verification/finalization ends in pass, the final ticket archived under `tickets/done/<project-key>/tickets_NNN.md` has satisfied `## Done When` items checked with `[x]`.
- [ ] When verification fails or a ticket is rejected, unmet `## Done When` items remain `[ ]` and the reject reason or verification evidence identifies the remaining blocker.
- [ ] Runtime updates do not erase existing manual `[x]`/`[ ]` state in the ticket `## Done When` section.
- [ ] Installed scripts under `.autoflow/scripts` and source mirrors under `runtime/board-scripts` stay behaviorally aligned for any touched runtime helper.
- [ ] `tests/smoke/ticket-owner-smoke.sh` or equivalent smoke coverage verifies the pass path leaves checked `Done When` items in the done ticket.
- [ ] Implementation stays inside Allowed Paths.
- [ ] `rg -n "Done When|\\[x\\]|\\[ \\]" .autoflow/agents .autoflow/reference runtime/board-scripts .autoflow/scripts && bash tests/smoke/ticket-owner-smoke.sh` passes.

## Next Action

- Impl AI 는 이 티켓을 todo 에서 claim 한 뒤, ticket `## Done When` 체크 상태를 durable board state로 남기는 구현/문서/스모크 변경을 Allowed Paths 안에서 끝낸다.

## Resume Context

- 현재 상태 요약: Plan AI 가 `tickets/inbox/memo_055.md` 를 `tickets/done/prd_088/prd_088.md` 생성 PRD 로 승격하고 이 todo 티켓을 만들었다.
- 직전 작업: wiki context pass 를 `Done When`, `ticket-owner verification completion`, `ticket checklist [x]`, `.autoflow/agents/ticket-owner-agent.md`, `.autoflow/scripts`, `runtime/board-scripts` 키워드로 실행했다.
- 재개 시 먼저 볼 것: `tickets/done/prd_088/prd_088.md`, ticket `## Done When` 체크 상태를 갱신/보존해야 하는 owner/verifier 지시와 `verify-ticket-owner.sh` / `finish-ticket-owner.sh` 흐름.
- 최근 결정: verifier record의 `Done When items were checked` 체크만으로는 ticket 자체의 `## Done When` 항목이 `[x]`로 남는다고 볼 수 없으므로, 이 티켓은 ticket 문서의 checklist state를 직접 갱신/보존하는 범위로 제한한다.
- 관련 주의: `tickets/reject/reject_003.md`, `wiki/answers/finish-ticket-owner-cleanup-status-contract.md`, `wiki/answers/finish-ticket-owner-cleanup-status-regression-20260430.md` 는 `ticket-owner-smoke.sh` / `finish-ticket-owner` 출력 계약 이력을 보여주지만, `prd_003` UI 재시도는 이 티켓 범위가 아니다.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_088/prd_088.md at 2026-05-01T00:32:01Z.
- Wiki context: `bin/autoflow wiki query --term "Done When"` surfaced many prior `verify_NNN.md` records where `Criteria Checked` includes `Done When items were checked`; this ticket treats those as evidence of the verification checklist convention, not proof that source ticket `## Done When` checklist items were updated.
- Wiki context: `tickets/reject/reject_003.md` is a max-retry unrelated Wiki preview reject with repeated smoke/runtime contract failures. Keep implementation focused on Done When checklist state; only touch `finish-ticket-owner` / smoke behavior where it is directly needed for this PRD.
- Wiki context: `wiki/answers/finish-ticket-owner-cleanup-status-contract.md` and `wiki/answers/finish-ticket-owner-cleanup-status-regression-20260430.md` document prior cleanup output contract failures. If the smoke test exposes that exact issue, resolve it only within the allowed runtime/smoke files and do not mix product UI changes into this ticket.

## Verification

- Run file:
- Log file:
- Result: pending

## Result

- Summary:
- Remaining risk:
