# Ticket

## Ticket

- ID: tickets_053
- PRD Key: prd_2017
- Plan Candidate: Plan AI handoff from tickets/done/prd_2017/prd_2017.md
- Title: AI work for prd_2017
- Stage: done
- AI: worker-1
- Claimed By: worker-1
- Execution AI: worker-1
- Verifier AI: worker-1
- Last Updated: 2026-04-29T21:09:32Z

## Goal

- 이번 작업의 목표: Implement the approved spec for prd_2017.

## References

- PRD: tickets/done/prd_2017/prd_2017.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Obsidian Links

- Project Note: [[prd_2017]]
- Plan Note:
- Ticket Note: [[tickets_053]]

## Allowed Paths

- TODO: Plan AI must narrow this to concrete repo-relative paths before Impl AI claims.

## Worktree
- Path: `/Users/demoon2016/Documents/project/.autoflow-worktrees/autoflow/tickets_053`
- Branch: autoflow/tickets_053
- Base Commit: d8dae69c41d335ba8bfa719102d4e857b0ae18c7
- Worktree Commit:
- Integration Status: no_code_changes

## Done When

- [ ] `bash packages/cli/wiki-project.sh ingest /Users/demoon2016/Documents/project/autoflow .autoflow <some-source.md>` (with a wiki adapter on PATH or via `command=`) creates both `.autoflow/wiki-raw/<slug>.md` and `.autoflow/wiki/sources/<slug>.md`. The raw file starts with YAML frontmatter and contains the verbatim body; the summary file starts with YAML frontmatter (`kind: source_summary`, `slug`, `created`, `updated`, `raw_source`, `entities`, `concepts`).
- [ ] Re-running the same `ingest` command on the unchanged source emits `ingest_status=skipped_unchanged_source` AND `ingest_summary_status=skipped_unchanged`, calls no adapter, and leaves both files byte-for-byte identical.
- [ ] After modifying the source body and re-running ingest, `ingest_status=updated_source` and `ingest_summary_status=ok`, the raw file's `updated_at:` advances while `ingested_at:` is preserved, and the summary file's `updated:` advances while `created:` is preserved.
- [ ] `AUTOFLOW_WIKI_INGEST_PROMPT_BYTES=2048 bash packages/cli/wiki-project.sh ingest . .autoflow <large-source.md>` truncates the body in the prompt (output emits `ingest_prompt_bytes` ≤ 2048 and `ingest_body_truncated=true`).
- [ ] `bash packages/cli/wiki-project.sh ingest . .autoflow <source-file> --no-summary` writes the raw file but emits `ingest_summary_status=skipped_no_summary_flag` and does not create the summary file.
- [ ] `bash packages/cli/wiki-project.sh ingest . .autoflow nonexistent.md` exits non-zero with `ingest_status=source_not_found`.
- [ ] `bash packages/cli/wiki-project.sh ingest . .autoflow <source-file> --slug 'bad slug!'` exits non-zero with `ingest_status=invalid_slug`.
- [ ] `bash packages/cli/wiki-project.sh ingest . .autoflow <source-file>` with no adapter on PATH still writes `wiki-raw/<slug>.md` (deterministic copy) and emits `ingest_summary_status=skipped_no_adapter` without crashing.
- [ ] `bash packages/cli/wiki-project.sh lint . .autoflow` after at least one summary exists does not flag `wiki/sources/*.md` under `lint_missing_frontmatter.*` and does not flag the linked summary as `lint_orphan.*`.
- [ ] `.autoflow/agents/wiki-maintainer-agent.md` and `.autoflow/reference/wiki.md` describe the ingest workflow, the per-source fingerprint cache, and `AUTOFLOW_WIKI_INGEST_PROMPT_BYTES`. `grep -n AUTOFLOW_WIKI_INGEST_PROMPT_BYTES .autoflow/agents/wiki-maintainer-agent.md` returns at least one hit.
- [ ] `bash packages/cli/wiki-project.sh update . .autoflow --dry-run` baseline still produces the same shape (no regression).

## Next Action
- Complete: the inline merge finalizer integrated the AI-merged ticket, archived evidence, and prepared the local completion commit.

## Resume Context

- 현재 상태 요약: Plan AI 가 backlog PRD 에서 todo 티켓을 생성한 직후.
- 직전 작업: scripts/start-plan.sh 가 PRD 를 done 으로 보관하고 todo 티켓을 만들었다.
- 재개 시 먼저 볼 것: PRD, Goal, Allowed Paths, Done When.

## Notes

- Created by planner-1 (Plan AI) from tickets/done/prd_2017/prd_2017.md at 2026-04-29T12:52:42Z.

- Runtime hydrated worktree dependency at 2026-04-29T12:53:24Z: linked apps/desktop/node_modules -> /Users/demoon2016/Documents/project/autoflow/apps/desktop/node_modules
- AI worker-1 prepared resume at 2026-04-29T20:58:47Z; worktree=/Users/demoon2016/Documents/project/.autoflow-worktrees/autoflow/tickets_053; run=tickets/inprogress/verify_053.md
- Wiki context pass at 2026-04-29T21:00Z:
  - `bash packages/cli/wiki-project.sh query /Users/demoon2016/Documents/project/autoflow .autoflow --term ingest --term wiki-raw --term source_summary --limit 8` returned `tickets/done/prd_2017/prd_2017.md` as the governing spec, plus prior `tickets/done/prd_2016/prd_2016.md` and `tickets/done/prd_2016/tickets_052.md` for token-frugal wiki lint/query patterns.
  - `bash packages/cli/wiki-project.sh query /Users/demoon2016/Documents/project/autoflow .autoflow --term token-frugal --term "wiki sources" --term AUTOFLOW_WIKI_INGEST_PROMPT_BYTES --limit 8` again surfaced `prd_2017` and `prd_2016`; implementation should reuse the existing wiki adapter, runner selection, fingerprint, and prompt-budget idioms.
- Mini-plan:
  1. Extend `packages/cli/wiki-project.sh` with an `ingest` action that writes `wiki-raw/<slug>.md`, gates summary adapter calls with `runners/state/<runner_id>.ingest.sources.d/<slug>`, caps prompt bytes via `AUTOFLOW_WIKI_INGEST_PROMPT_BYTES`, and supports `--slug`, `--no-summary`, and `--runner`.
  2. Add `wiki/sources/<slug>.md` summary writing with YAML frontmatter, created/updated preservation, index link insertion, and lint compatibility for `[[sources/<slug>]]` links.
  3. Document the raw source and source summary layers in `.autoflow/agents/wiki-maintainer-agent.md`, `.autoflow/reference/wiki.md`, `.autoflow/wiki-raw/README.md`, and `.autoflow/wiki/sources/README.md`.
- Implementation checkpoint at 2026-04-29T21:04Z: CLI ingest action, docs, source directories, lint path-link handling, and temp-board verification matrix are implemented in the ticket worktree.
- Finish paused at 2026-04-29T21:08:56Z: worktree HEAD 668c4b268bb7192eebea22c2b100507ae404ae20 does not contain PROJECT_ROOT HEAD 140c651b93f11566831456e8712cea5bbdd82433. AI must perform the rebase/merge; script did not run git rebase.
- Allowed path was not present in worktree during merge preparation at 2026-04-29T21:09:32Z, so it was skipped: TODO: Plan AI must narrow this to concrete repo-relative paths before Impl AI claims.
- No staged code changes found in worktree during merge preparation at 2026-04-29T21:09:32Z.
- Impl AI worker-1 marked verification pass at 2026-04-29T21:09:31Z; runtime finalizer will not perform merge operations.
- Inline merge finalizer (worker worker-1) finalized this verified ticket at 2026-04-29T21:09:32Z.
- Coordinator post-merge cleanup at 2026-04-29T21:09:32Z: removed_worktree=/Users/demoon2016/Documents/project/.autoflow-worktrees/autoflow/tickets_053 deleted_branch=autoflow/tickets_053.
## Verification
- Run file: `tickets/done/prd_2017/verify_053.md`
- Log file: `logs/verifier_053_20260429_210932Z_pass.md`
- Result: passed

## Result

- Summary: Implemented raw-source wiki ingest with deterministic raw copy, cached source summaries, prompt budget controls, docs, and verification evidence.
- Remaining risk: Host wiki lint still reports pre-existing missing frontmatter on existing non-source wiki pages; source summary lint compatibility passed in an isolated temp-board matrix.
