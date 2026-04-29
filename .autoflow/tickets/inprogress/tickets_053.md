# Ticket

## Ticket

- ID: tickets_053
- PRD Key: prd_2017
- Plan Candidate: Plan AI handoff from tickets/done/prd_2017/prd_2017.md
- Title: AI work for prd_2017
- Stage: executing
- AI: worker-1
- Claimed By: worker-1
- Execution AI: worker-1
- Verifier AI: worker-1
- Last Updated: 2026-04-29T16:11:21Z

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
- Base Commit: 116e522806b1197c54486d8ac1ab1c38da0f3c9d
- Worktree Commit:
- Integration Status: pending

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
- 다음에 바로 이어서 할 일: 한 owner 가 mini-plan, 구현, 검증, 증거 기록, done/reject 이동까지 이어서 처리한다.

## Resume Context

- 현재 상태 요약: Plan AI 가 backlog PRD 에서 todo 티켓을 생성한 직후.
- 직전 작업: scripts/start-plan.sh 가 PRD 를 done 으로 보관하고 todo 티켓을 만들었다.
- 재개 시 먼저 볼 것: PRD, Goal, Allowed Paths, Done When.

## Notes

- Created by planner-1 (Plan AI) from tickets/done/prd_2017/prd_2017.md at 2026-04-29T12:52:42Z.

- Runtime hydrated worktree dependency at 2026-04-29T12:53:24Z: linked apps/desktop/node_modules -> /Users/demoon2016/Documents/project/autoflow/apps/desktop/node_modules
- AI worker-1 prepared resume at 2026-04-29T16:11:21Z; worktree=/Users/demoon2016/Documents/project/.autoflow-worktrees/autoflow/tickets_053; run=tickets/inprogress/verify_053.md
## Verification
- Run file: `tickets/inprogress/verify_053.md`
- Log file: pending
- Result: pending ticket-owner by worker-1

## Result

- Summary:
- Remaining risk:
