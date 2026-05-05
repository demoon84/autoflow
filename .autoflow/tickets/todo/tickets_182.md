# Ticket

## Ticket

- ID: tickets_182
- PRD Key: prd_183
- Plan Candidate: Plan AI handoff from tickets/done/prd_183/prd_183.md
- Title: wiki meaningful commit gate
- Stage: todo
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated: 2026-05-05T00:16:09Z

## Goal

- 이번 작업의 목표: wiki runner 가 `wiki/index.md`, `wiki/log.md`, manifest/history/fingerprint 갱신이나 cosmetic-only diff 만으로 `[wiki] wiki knowledge update` commit 을 반복 생성하지 않게 하고, 실제 지식 content delta 가 있을 때만 의미 있는 commit message 로 local commit 하게 만든다.

## References

- PRD: tickets/done/prd_183/prd_183.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_183]]
- Plan Note:
- Ticket Note: [[tickets_182]]

## Allowed Paths

- `packages/cli/run-role.sh`
- `runtime/board-scripts/run-role.sh`
- `packages/cli/wiki-project.sh`
- `.autoflow/scripts/update-wiki.sh`
- `.autoflow/agents/wiki-maintainer-agent.md`
- `AGENTS.md`
- `tests/smoke/wiki-meaningful-commit-gate-smoke.sh`
- `tests/smoke/planner-wiki-scoped-autocommit-smoke.sh`
- `tests/smoke/wiki-ai-owned-update-smoke.sh`

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

- [ ] Temp repo smoke test에서 `wiki/index.md`, `wiki/log.md`, `*.manifest`, `*.history`, `*.fingerprint` 만 변경된 wiki scope diff 는 `autocommit_status=skipped_wiki_commit_gate` 또는 동등한 key=value evidence 를 남기고 local commit 을 만들지 않는다.
- [ ] Temp repo smoke test에서 whitespace-only/cosmetic-only wiki diff 는 `git diff -w` 기준 content delta 가 없음을 evidence 로 남기고 local commit 을 만들지 않는다.
- [ ] Temp repo smoke test에서 `wiki/sources/one.md` 단일 기존 파일 수정은 weight 1, line delta 30 미만으로 계산되어 commit 을 만들지 않는다.
- [ ] Temp repo smoke test에서 `wiki/answers/new-answer.md` 신규 파일 추가는 weight 5 이상으로 계산되어 local commit 을 만들고, commit subject 가 `[wiki] update:` 로 시작하며 `answers`, `total`, `+`, `-` 정보를 포함한다.
- [ ] Temp repo smoke test에서 wiki 파일 삭제는 line 임계와 무관하게 local commit 을 만들고, commit subject 가 삭제 category 와 total file count 를 포함한다.
- [ ] `AUTOFLOW_WIKI_COMMIT_WEIGHT_THRESHOLD=1` 과 `AUTOFLOW_WIKI_COMMIT_MIN_LINES=1` 로 실행한 fixture 에서 low-weight content change commit 이 허용되어 env override 가 동작함을 확인한다.
- [ ] wiki debounce/admission 로그가 `wiki_commit_weight=`, `wiki_commit_line_delta=`, `wiki_commit_primary_category=`, `wiki_commit_gate_reason=` 또는 동등한 key=value evidence 를 `.autoflow/runners/logs/<runner>.log` 에 남긴다.
- [ ] 기존 AI-owned wiki update smoke 는 `status=unchanged` 결과가 `.autoflow/wiki/` 를 dirty 로 만들지 않는 계약을 유지한다.
- [ ] `bash -n packages/cli/run-role.sh runtime/board-scripts/run-role.sh packages/cli/wiki-project.sh .autoflow/scripts/update-wiki.sh`, `bash tests/smoke/wiki-meaningful-commit-gate-smoke.sh`, `bash tests/smoke/wiki-ai-owned-update-smoke.sh`, and `bash tests/smoke/planner-wiki-scoped-autocommit-smoke.sh` exit 0.

## Next Action

- 다음에 바로 이어서 할 일: Impl AI 는 이 티켓을 todo 에서 claim 한 뒤 `tickets/done/prd_183/prd_183.md`의 weight/line/cosmetic commit gate 계약을 기준으로 mini-plan, 구현, smoke 검증, PROJECT_ROOT 통합까지 한 턴에 끝낸다. 현재 active `tickets_177`와 queued `tickets_181`가 `run-role.sh` 계열 파일을 함께 다루므로 worker serialization이 해당 변경 landing 후 이 티켓을 claim해야 한다.

## Resume Context

- 현재 상태 요약: Plan AI 가 `order_164`를 `prd_183`와 `tickets_182`로 승격했고, source order는 `tickets/done/prd_183/order_164.md`로 보관됐다.
- 직전 작업: `.autoflow/scripts/start-plan.sh 183`가 `prd_183`를 `tickets/done/prd_183/prd_183.md`로 보관하고 `tickets/todo/tickets_182.md`를 만들었다.
- 재개 시 먼저 볼 것: `tickets/done/prd_183/prd_183.md`, `packages/cli/run-role.sh`의 `maybe_skip_debounced_wiki_turn`, `role_autocommit_message`, `role_autocommit_after_adapter`, 그리고 `tests/smoke/planner-wiki-scoped-autocommit-smoke.sh`의 기존 wiki subject assertion.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_183/prd_183.md at 2026-05-05T00:15:55Z.
- Planner wiki pass: `bin/autoflow wiki query /Users/demoon2016/Documents/project/autoflow .autoflow --term "wiki knowledge update commit debounce" --term "AUTOFLOW_WIKI_COMMIT_WEIGHT_THRESHOLD wiki-project.sh" --term "wiki update commit message" --term "update-wiki.sh wiki-maintainer-agent AGENTS rule 18" --limit 8 --rag` returned `result_count=0`; no prior wiki chunk constrained the scope.
- Repo context finding: current wiki debounce threshold and generic `[wiki] wiki knowledge update` subject are implemented in `packages/cli/run-role.sh`; keep `runtime/board-scripts/run-role.sh` in parity if the mirrored runtime carries the same role runner logic.
- Repo context finding: `tests/smoke/planner-wiki-scoped-autocommit-smoke.sh` currently asserts the old generic wiki subject, so implementation must update that smoke alongside the new subject contract.
- Repo context finding: `tests/smoke/wiki-ai-owned-update-smoke.sh` already verifies `status=unchanged` does not dirty `.autoflow/wiki/`; preserve that regression and add a dedicated temp-board commit-gate smoke rather than touching current repo wiki pages.
- Active queue constraint: `tickets/inprogress/tickets_177.md` and `tickets/todo/tickets_181.md` both overlap `run-role.sh` / `runners-project.sh` ownership. This ticket should be claimed only through normal single-worker serialization, not by manual worktree/process management.
- Guard warning: `bin/autoflow guard /Users/demoon2016/Documents/project/autoflow .autoflow` at 2026-05-05T00:16Z returned `status=warning`, `error_count=0`, `warning_count=2`; unrelated cleanup candidates are leftover worktree `autoflow/tickets_119` with no board ticket and dirty done-ticket worktree `autoflow/tickets_163`. Planner recorded the evidence and did not delete or reset worktrees.

## Verification

- Run file:
- Log file:
- Result: pending

## Result

- Summary:
- Remaining risk:
