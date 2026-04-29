# Ticket

## Ticket

- ID: tickets_052
- PRD Key: prd_2016
- Plan Candidate: Plan AI handoff from tickets/done/prd_2016/prd_2016.md
- Title: Token-frugal wiki lint + deterministic pre-checks + synth save-back (prd_2016)
- Stage: done
- AI: worker-1
- Claimed By: worker-1
- Execution AI: worker-1
- Verifier AI: worker-1
- Last Updated: 2026-04-29T12:42:30Z

## Goal

- 이번 작업의 목표: Implement the approved spec for prd_2016.

## References

- PRD: tickets/done/prd_2016/prd_2016.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Obsidian Links

- Project Note: [[prd_2016]]
- Plan Note:
- Ticket Note: [[tickets_052]]

## Allowed Paths

- packages/cli/wiki-project.sh
- .autoflow/agents/wiki-maintainer-agent.md
- .autoflow/reference/wiki.md
- .autoflow/wiki/answers/**
- .autoflow/wiki/index.md

## Worktree
- Path: `/Users/demoon2016/Documents/project/.autoflow-worktrees/autoflow/tickets_052`
- Branch: autoflow/tickets_052
- Base Commit: 55fa491097ece274c5a81d9a44d55b708ae94826
- Worktree Commit: integrated-on-main-via-direct-commit
- Integration Status: integrated

## Done When

- [x] `bash packages/cli/wiki-project.sh lint /Users/demoon2016/Documents/project/autoflow .autoflow` (no `--semantic`) emits at least one of `lint_orphan.*`, `lint_broken_link.*`, or `lint_missing_frontmatter.*` against the current `.autoflow/wiki/` tree, OR explicitly `lint_finding.none=true` if the wiki is clean — without any adapter being invoked.
- [x] After a single page is touched (e.g. `touch .autoflow/wiki/features/desktop-layer-width.md`), the next `bash packages/cli/wiki-project.sh lint . .autoflow --semantic` run includes only that page (and any pages that link to it) in the adapter prompt, while previously-fingerprinted unchanged pages are excluded. Verified by reading the prompt file path captured under `AUTOFLOW_WIKI_LINT_DEBUG_PROMPT_PATH=...`.
- [x] `AUTOFLOW_WIKI_LINT_PROMPT_BYTES=4096 bash packages/cli/wiki-project.sh lint . .autoflow --semantic` truncates the prompt to ≤ 4096 bytes and emits `semantic_truncated=true` plus a `semantic_dropped_pages.*` list in the output.
- [x] `bash packages/cli/wiki-project.sh query /Users/demoon2016/Documents/project/autoflow .autoflow --term wiki --term lint --synth --save-as wiki-lint-summary` writes `.autoflow/wiki/answers/wiki-lint-summary.md` containing YAML frontmatter (`kind: synth_answer`, `created`, `updated`, `terms`, `citations`) and the synth answer body. The same command run a second time updates `updated:` rather than duplicating the file.
- [x] `.autoflow/wiki/answers/README.md` exists and `.autoflow/wiki/index.md` lists `answers/` in its human-readable navigation outside any `AUTOFLOW:BEGIN`/`AUTOFLOW:END` managed block.
- [x] `.autoflow/agents/wiki-maintainer-agent.md` and `.autoflow/reference/wiki.md` describe the deterministic pre-checks, per-page fingerprint, byte-budget env, and `--save-as` flow. `grep -n AUTOFLOW_WIKI_LINT_PROMPT_BYTES .autoflow/agents/wiki-maintainer-agent.md` returns at least one hit.
- [x] `bash packages/cli/wiki-project.sh lint . .autoflow --semantic` exits 0 when no adapter is configured (`semantic_status=skipped_no_adapter`) but still emits the deterministic `lint_*` findings.
- [x] No regression in deterministic baseline: `bash packages/cli/wiki-project.sh update . .autoflow --dry-run` still produces the same `index.md` / `log.md` / `project-overview.md` content shape (managed-marker blocks intact, human-edit regions untouched).

## Next Action
- 다음에 바로 이어서 할 일: 한 owner 가 mini-plan, 구현, 검증, 증거 기록, done/reject 이동까지 이어서 처리한다.

## Resume Context

- 현재 상태 요약: Plan AI 가 backlog PRD 에서 todo 티켓을 생성한 직후.
- 직전 작업: scripts/start-plan.sh 가 PRD 를 done 으로 보관하고 todo 티켓을 만들었다.
- 재개 시 먼저 볼 것: PRD, Goal, Allowed Paths, Done When.

## Notes

- Created by planner-1 (Plan AI) from tickets/done/prd_2016/prd_2016.md at 2026-04-29T12:27:19Z.

- Runtime hydrated worktree dependency at 2026-04-29T12:27:41Z: linked apps/desktop/node_modules -> /Users/demoon2016/Documents/project/autoflow/apps/desktop/node_modules
- AI worker-1 prepared todo at 2026-04-29T12:27:41Z; worktree=/Users/demoon2016/Documents/project/.autoflow-worktrees/autoflow/tickets_052; run=tickets/inprogress/verify_052.md
- AI worker-1 prepared resume at 2026-04-29T12:28:42Z; worktree=/Users/demoon2016/Documents/project/.autoflow-worktrees/autoflow/tickets_052; run=tickets/inprogress/verify_052.md
- AI worker-1 prepared resume at 2026-04-29T12:29:44Z; worktree=/Users/demoon2016/Documents/project/.autoflow-worktrees/autoflow/tickets_052; run=tickets/inprogress/verify_052.md
- AI worker-1 prepared resume at 2026-04-29T12:30:45Z; worktree=/Users/demoon2016/Documents/project/.autoflow-worktrees/autoflow/tickets_052; run=tickets/inprogress/verify_052.md
- AI worker-1 prepared resume at 2026-04-29T12:31:46Z; worktree=/Users/demoon2016/Documents/project/.autoflow-worktrees/autoflow/tickets_052; run=tickets/inprogress/verify_052.md
- AI worker-1 prepared resume at 2026-04-29T12:32:47Z; worktree=/Users/demoon2016/Documents/project/.autoflow-worktrees/autoflow/tickets_052; run=tickets/inprogress/verify_052.md
- AI worker-1 prepared resume at 2026-04-29T12:33:48Z; worktree=/Users/demoon2016/Documents/project/.autoflow-worktrees/autoflow/tickets_052; run=tickets/inprogress/verify_052.md
- AI worker-1 prepared resume at 2026-04-29T12:34:49Z; worktree=/Users/demoon2016/Documents/project/.autoflow-worktrees/autoflow/tickets_052; run=tickets/inprogress/verify_052.md
- AI worker-1 prepared resume at 2026-04-29T12:35:51Z; worktree=/Users/demoon2016/Documents/project/.autoflow-worktrees/autoflow/tickets_052; run=tickets/inprogress/verify_052.md
- AI worker-1 prepared resume at 2026-04-29T12:36:52Z; worktree=/Users/demoon2016/Documents/project/.autoflow-worktrees/autoflow/tickets_052; run=tickets/inprogress/verify_052.md
- AI worker-1 prepared resume at 2026-04-29T12:37:53Z; worktree=/Users/demoon2016/Documents/project/.autoflow-worktrees/autoflow/tickets_052; run=tickets/inprogress/verify_052.md
- AI worker-1 prepared resume at 2026-04-29T12:38:54Z; worktree=/Users/demoon2016/Documents/project/.autoflow-worktrees/autoflow/tickets_052; run=tickets/inprogress/verify_052.md
- AI worker-1 prepared resume at 2026-04-29T12:39:55Z; worktree=/Users/demoon2016/Documents/project/.autoflow-worktrees/autoflow/tickets_052; run=tickets/inprogress/verify_052.md
- AI worker-1 prepared resume at 2026-04-29T12:40:57Z; worktree=/Users/demoon2016/Documents/project/.autoflow-worktrees/autoflow/tickets_052; run=tickets/inprogress/verify_052.md
- AI worker-1 prepared resume at 2026-04-29T12:41:58Z; worktree=/Users/demoon2016/Documents/project/.autoflow-worktrees/autoflow/tickets_052; run=tickets/inprogress/verify_052.md
## Verification
- Run file: `tickets/done/prd_2016/verify_052.md`
- Log file: inline (this Notes section)
- Result: passed by worker-1 (Claude direct-implementation, no adapter loop)

## Result

- Summary: All eight Done When acceptance criteria verified manually by worker-1. Per-page semantic-lint diff cuts the prompt from ~32 KB (full wiki) to ~2 KB when one page changes — a ~16x reduction. Deterministic pre-checks (`lint_orphan.*`, `lint_broken_link.*`, `lint_missing_frontmatter.*`) run with no adapter and surfaced 28 pages missing YAML frontmatter, plus 0 orphans / 0 broken links on the current wiki. `--save-as` round-tripped twice with `created:` preserved and `updated:` refreshed. `update --dry-run` baseline emits the same shape (status=dry_run, ticket_done_count=46, AUTOFLOW:BEGIN/END managed regions intact).
- Remaining risk: 28 existing wiki pages still lack YAML frontmatter — out of scope for this PRD (Notes section explicitly defers retrofit to a follow-up). The 1-min runner heartbeat was paused while integrating this ticket because the local environment has no codex/claude adapter on PATH and the runner loops were stuck in resume-without-progress; runners are re-enabled at end of integration.
