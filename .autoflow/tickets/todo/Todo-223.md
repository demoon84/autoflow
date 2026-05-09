# Ticket

## Ticket

- ID: Todo-223
- PRD Key: prd_215
- Plan Candidate: Plan AI retry from tickets/done/prd_215/prd_215.md (retry_count=1, fingerprint=93f883db6d2f)
- Title: SKILL 제거 Phase 4 — order/autoflow skill 의 RAG injection 제거 (retry 1)
- Priority: normal
- Change Type: code
- Stage: todo
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated: 2026-05-09T07:15:00Z

## Goal

- 이번 작업의 목표: `integrations/{claude,codex}/skills/{order,autoflow}/SKILL.md` 4개 master 와 `.claude/skills/{order,autoflow}/`, `.codex/skills/{order,autoflow}/` 4개 사본의 "Lookup Before Saving" 단락에서 `autoflow wiki query --rag` 호출 라인만 제거한다. `autoflow origin search` 라인은 보존한다. 이전 시도(Todo-215)는 본문 변경 없이 Done When 만 [x] 처리해 sanity gate(zero_diff)에 차단됐으므로, 이번에는 실제 8개 파일 본문에서 해당 라인을 삭제해야 한다.

## References

- PRD: tickets/done/prd_215/prd_215.md
- Feature Spec:
- Plan Source: plan-ai-retry

## Reference Notes

- Project Note: [[prd_215]]
- Plan Note:
- Ticket Note: [[Todo-223]]

## Allowed Paths

- `integrations/claude/skills/order/SKILL.md`
- `integrations/claude/skills/autoflow/SKILL.md`
- `integrations/codex/skills/order/SKILL.md`
- `integrations/codex/skills/autoflow/SKILL.md`
- `.claude/skills/order/SKILL.md`
- `.claude/skills/autoflow/SKILL.md`
- `.codex/skills/order/SKILL.md`
- `.codex/skills/autoflow/SKILL.md`

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

- [ ] 8개 SKILL.md 파일에서 `autoflow wiki query --rag` 가 들어 있는 라인을 실제 삭제한다 (본문만 [x] 처리하는 우회 금지).
- [ ] `grep -nE "wiki query.*--rag" integrations/claude/skills/order/SKILL.md integrations/claude/skills/autoflow/SKILL.md integrations/codex/skills/order/SKILL.md integrations/codex/skills/autoflow/SKILL.md .claude/skills/order/SKILL.md .claude/skills/autoflow/SKILL.md .codex/skills/order/SKILL.md .codex/skills/autoflow/SKILL.md` 결과가 0 hit.
- [ ] 위 8개 파일에 `autoflow origin search` 호출 라인이 그대로 존재한다 (`grep -c "autoflow origin search" <file>` ≥ 1 each).
- [ ] `bash .autoflow/scripts/board-guard.sh` 가 error 0 으로 끝난다 (pre-existing warnings 는 무시 가능).
- [ ] Implementation stays inside Allowed Paths.

## Next Action

- 다음에 바로 이어서 할 일: Impl AI 는 worktree 안에서 8개 SKILL.md 의 `autoflow wiki query --rag` 라인만 sed/Edit 로 삭제하고, grep 검증 후 commit.

## Resume Context

- 현재 상태 요약: prd_215 retry 1. 이전 worker(Todo-215)는 보고만 하고 실제 코드 변경을 하지 않아 zero-diff sanity gate 에 막혔다.
- 직전 작업: planner 가 inbox/order_215_retry_1_*.md 를 promote 해 todo 재발행.
- 재개 시 먼저 볼 것: PRD `tickets/done/prd_215/prd_215.md`, 그리고 위 grep 명령으로 현 상태 확인 (현재 8개 파일 모두 line 17 에 `autoflow wiki query --rag` 가 살아 있음).

## Notes

- Created by planner (Plan AI) from inbox retry order order_215_retry_1_20260509T070822Z.md at 2026-05-09T07:15:00Z.
- 이전 실패 클래스: shell_sanity_gate_zero_diff. retry fingerprint 93f883db6d2f, retry_count 1/3.

## Verification

- Command: `grep -nE "wiki query.*--rag" integrations/claude/skills/order/SKILL.md integrations/claude/skills/autoflow/SKILL.md integrations/codex/skills/order/SKILL.md integrations/codex/skills/autoflow/SKILL.md .claude/skills/order/SKILL.md .claude/skills/autoflow/SKILL.md .codex/skills/order/SKILL.md .codex/skills/autoflow/SKILL.md; test $? -ne 0 && bash .autoflow/scripts/board-guard.sh`
- Run file:
- Log file:
- Result: pending

## Result

- Summary:
- Remaining risk:
