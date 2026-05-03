# Ticket

## Ticket

- ID: tickets_147
- PRD Key: prd_148
- Plan Candidate: Plan AI handoff from tickets/done/prd_148/prd_148.md
- Title: order body format standardization and request de-duplication
- Stage: done
- Priority: high
- AI: worker
- Claimed By: worker
- Execution AI: worker
- Verifier AI: worker
- Last Updated: 2026-05-03T12:01:04Z

## Goal

- 이번 작업의 목표: `autoflow order create`와 `/order` 계열 스킬이 새 inbox order를 하나의 표준 markdown 형식으로 작성하고, 요청 본문에 `## Request` 헤더가 이미 포함된 경우에도 헤더가 중복되지 않게 한다.

## References

- PRD: tickets/done/prd_148/prd_148.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_148]]
- Plan Note:
- Ticket Note: [[tickets_147]]

## Allowed Paths

- `packages/cli/order-project.sh`
- `.claude/skills/order/SKILL.md`
- `.codex/skills/order/SKILL.md`
- `integrations/claude/skills/order/SKILL.md`
- `integrations/codex/skills/order/SKILL.md`

## Worktree
- Path: `/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_147`
- Branch: autoflow/tickets_147
- Base Commit: 0f6f482dbd4bdcb9dfebd1c1b1da207f63733135
- Worktree Commit: 
- Integration Status: already_in_project_root

## Goal Runtime
- Status: complete
- Started At: 2026-05-03T11:56:33Z
- Started Epoch: 1777809393
- Updated At: 2026-05-03T12:01:05Z
- Tick Count: 3
- Time Used Seconds: 272
- Token Budget: 
- Tokens Used: 
- Continuation Suppressed: false
- Last Event: complete
- Last Progress Fingerprint: 372066807

## Recovery State

- Status: healthy
- Detected By:
- Failure Class:
- Evidence:
- Planner Decision:
- Owner Resume Instruction:
- Last Recovery At:

## Done When

- [x] `packages/cli/order-project.sh create --request "plain body"` creates an order file whose first non-empty line is `# Autoflow Order`.
- [x] The same generated file contains exactly one `## Order` heading and exactly one `## Request` heading.
- [x] The same generated file contains no yaml frontmatter delimiter line `---`.
- [x] `packages/cli/order-project.sh create --request $'## Request\nalready headed body'` creates an order file with exactly one `## Request` heading and preserves `already headed body` under that section.
- [x] `packages/cli/order-project.sh create --from-file <file>` with a source file that already starts with `## Request` also creates exactly one `## Request` heading.
- [x] The generated `## Order` section still contains exactly one `- Priority: <value>` line when priority support from `prd_146` is present.
- [x] `.claude/skills/order/SKILL.md`, `.codex/skills/order/SKILL.md`, `integrations/claude/skills/order/SKILL.md`, and `integrations/codex/skills/order/SKILL.md` all state that direct Write fallback must use `# Autoflow Order` and must not use yaml frontmatter.
- [x] Implementation stays inside the Allowed Paths.
- [x] `bash -lc 'bash -n packages/cli/order-project.sh && tmp="$(mktemp -d)" && trap "rm -rf \"$tmp\"" EXIT && bin/autoflow init "$tmp" .autoflow >/dev/null && bin/autoflow order create "$tmp" .autoflow --title "plain" --request "plain body" >/dev/null && f1="$tmp/.autoflow/tickets/inbox/order_001.md" && test "$(grep -c "^## Request$" "$f1")" -eq 1 && test "$(grep -c "^## Order$" "$f1")" -eq 1 && test "$(grep -c "^---$" "$f1")" -eq 0 && test "$(grep -c "^- Priority: " "$f1")" -eq 1 && bin/autoflow order create "$tmp" .autoflow --title "headed" --request $'"'"'## Request\nalready headed body'"'"' >/dev/null && f2="$tmp/.autoflow/tickets/inbox/order_002.md" && test "$(grep -c "^## Request$" "$f2")" -eq 1 && grep -q "already headed body" "$f2" && src="$tmp/source.md" && printf "## Request\nfrom file body\n" > "$src" && bin/autoflow order create "$tmp" .autoflow --title "file" --from-file "$src" >/dev/null && f3="$tmp/.autoflow/tickets/inbox/order_003.md" && test "$(grep -c "^## Request$" "$f3")" -eq 1 && grep -q "from file body" "$f3" && npm run desktop:check'` exits 0.

## Next Action
- Complete: the inline merge finalizer integrated the AI-merged ticket, archived evidence, and prepared the local completion commit.

## Resume Context

- 현재 상태 요약: Plan AI 가 `order_140`을 `prd_148`과 `tickets_147`로 승격했다.
- 직전 작업: `.autoflow/scripts/start-plan.sh 148`이 `prd_148`을 `tickets/done/prd_148/prd_148.md`로 보관하고 `tickets/todo/tickets_147.md`를 만들었다.
- 재개 시 먼저 볼 것: `tickets/done/prd_148/prd_148.md`, `packages/cli/order-project.sh`의 order file writer, `.claude/skills/order/SKILL.md`, `.codex/skills/order/SKILL.md`, `integrations/claude/skills/order/SKILL.md`, `integrations/codex/skills/order/SKILL.md`.
- Wiki/ticket constraints: wiki RAG는 관련 선례를 찾지 못했다(`result_count=0`). `tickets/done/prd_146/prd_146.md`는 priority 입력 metadata를 완료 범위로 삼고 order body format normalization을 `order_140` 후속으로 남겼다. `tickets/done/prd_145/prd_145.md`는 queue priority sorting을 소유하므로 이 티켓에서 sorting helpers나 Desktop priority UI를 수정하지 않는다.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_148/prd_148.md at 2026-05-03T11:49:20Z.
- Planner runtime: `.autoflow/scripts/start-plan.sh` first returned `source=order-inbox`, `order_id=140`; after PRD creation, `.autoflow/scripts/start-plan.sh 148` returned `source=backlog-to-todo`, `lint_status=ok`, `lint_vagueness_score=0`.
- Planner wiki pass: `bin/autoflow wiki query --term "order body format standard CLI header Request duplicate frontmatter" --term "autoflow order create priority Request section duplicate yaml frontmatter" --term "order_140 order_138 order skills standard format" --term "desktop markdown preview frontmatter order inbox" --limit 12 --rag` returned `result_count=0`.
- Relevant prior ticket: `tickets/done/prd_146/prd_146.md` and `tickets/done/prd_146/tickets_145.md` own input-side priority metadata in `packages/cli/order-project.sh` and the same four order skill files. Preserve its `Priority:` behavior and avoid reworking priority validation/inference beyond what is needed to keep standard output intact.
- Relevant prior ticket: `tickets/done/prd_145/prd_145.md` owns priority-aware queue sorting. Do not edit `.autoflow/scripts/common.sh`, `start-plan.sh`, `start-ticket-owner.sh`, `start-verifier.sh`, `AGENTS.md`, or Desktop priority sorting for this ticket.
- Scope decision: existing frontmatter inbox orders are not backfilled here because changing already queued order files can race planner selection; this ticket only fixes new order creation and skill guidance.
- Guard warning after planner creation: `bin/autoflow guard . .autoflow` returned `status=warning`, `error_count=0`, `warning.1=autoflow/tickets_119 has a ticket worktree but no board ticket: /Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_119`. This is a cleanup candidate only; planner did not delete or reset the worktree.

- Runtime hydrated worktree dependency at 2026-05-03T11:56:32Z: linked apps/desktop/node_modules -> /Users/demoon2016/Documents/project/autoflow/apps/desktop/node_modules
- AI worker prepared todo at 2026-05-03T11:56:31Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_147; run=tickets/inprogress/verify_147.md
- AI worker prepared resume at 2026-05-03T11:56:53Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_147; run=tickets/inprogress/verify_147.md
- Mini-plan 2026-05-03T12:00Z: `start-ticket-owner.sh` returned `status=resume` and `worktree_status=ready`. Wiki pass is running with order/request/frontmatter terms; existing planner note says prior wiki result was `result_count=0`. Implement narrowly inside Allowed Paths by adding request-body normalization to `packages/cli/order-project.sh`, preserving the existing `- Priority: <value>` output from `prd_146`, and updating the four order skill files so direct Write fallback explicitly uses `# Autoflow Order` markdown with no yaml frontmatter.
- Ticket owner wiki pass: `bin/autoflow wiki query --term "order body format standard CLI header Request duplicate frontmatter" --term "autoflow order create Priority Request yaml frontmatter" --term "order skill direct Write fallback Autoflow Order" --limit 12 --rag` returned `result_count=0`; no additional constraint beyond prior `prd_145`/`prd_146` notes.
- Implementation evidence: changed only Allowed Paths. `packages/cli/order-project.sh` now strips exact `## Request` heading lines from input before writing the single generated `## Request` section; priority output remains unchanged. The four order skill files now require direct Write fallback to start with `# Autoflow Order` and avoid yaml frontmatter.
- Verification evidence: direct worktree verification command exited 0; project-root verification after manual integration also exited 0. A recorder attempt failed once because the PRD command was extracted with markdown backticks; rerun with a command override recorded `verify_147.md` as pass with exit 0.
- Queued without worktree commit at 2026-05-03T12:01:03Z: PROJECT_ROOT already matches the ticket worktree for all Allowed Paths with code changes.
- Impl AI worker marked verification pass at 2026-05-03T12:01:03Z; runtime finalizer will not perform merge operations.
- Coordinator post-merge cleanup at 2026-05-03T12:01:04Z: removed_worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_147 deleted_branch=autoflow/tickets_147.
- Inline merge finalizer (worker worker) finalized this verified ticket at 2026-05-03T12:01:04Z.
## Verification
- Run file: `tickets/done/prd_148/verify_147.md`
- Log file: `logs/verifier_147_20260503_120105Z_pass.md`
- Result: passed

## Result

- Summary: Standardize order markdown format and request heading de-duplication
- Remaining risk: Existing inbox files were intentionally not backfilled per PRD scope.
