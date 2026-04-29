# Ticket

## Ticket

- ID: tickets_054
- PRD Key: prd_052
- Plan Candidate: Plan AI handoff from tickets/done/prd_052/prd_052.md
- Title: AI work for prd_052
- Stage: todo
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated: 2026-04-29T13:09:57Z

## Goal

- 이번 작업의 목표: Implement the approved spec for prd_052.

## References

- PRD: tickets/done/prd_052/prd_052.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Obsidian Links

- Project Note: [[prd_052]]
- Plan Note:
- Ticket Note: [[tickets_054]]

## Allowed Paths

- TODO: Plan AI must narrow this to concrete repo-relative paths before Impl AI claims.

## Worktree

- Path:
- Branch:
- Base Commit:
- Worktree Commit:
- Integration Status: pending_claim

## Done When

- [ ] `bash packages/cli/wiki-project.sh retrofit-frontmatter . .autoflow --dry-run` prints proposed frontmatter for all 28 currently unframed pages and exits 0 without modifying any file. The output includes `retrofit.<n>.status=dry_run` and `retrofit_dry_run=28`.
- [ ] `bash packages/cli/wiki-project.sh retrofit-frontmatter . .autoflow` (no flags) writes a YAML frontmatter block (`kind`, `slug`, `title`, `created`, `updated`, `tags`) at the head of every previously-unframed page. The body bytes after the frontmatter remain identical to before. Output includes `retrofit_written=28` and `retrofit_skipped=0` for the post-`prd_2016` baseline (or matching counts if the baseline shifts).
- [ ] After the retrofit, `bash packages/cli/wiki-project.sh lint . .autoflow` emits `missing_frontmatter_count=0` and the same `orphan_count` / `broken_link_count` / `stale_reference_count` as before the retrofit (no regression).
- [ ] Re-running `retrofit-frontmatter` after a successful run is a no-op: every page reports `retrofit.<n>.status=skipped_already_has_frontmatter`, `retrofit_written=0`. No file mtime changes.
- [ ] `bash packages/cli/wiki-project.sh retrofit-frontmatter . .autoflow --page wiki/features/desktop-layer-width.md` retrofits only that page. Other pages are not touched.
- [ ] Without `--allow-adapter`, the action never invokes any adapter (verified by leaving `codex` / `claude` off PATH — exit code 0 and no stderr from `run_wiki_adapter_prompt`).
- [ ] `.autoflow/agents/wiki-maintainer-agent.md` and `.autoflow/reference/wiki.md` describe the action, env var, and deterministic-first invariant. `grep -n AUTOFLOW_WIKI_RETROFIT_PROMPT_BYTES .autoflow/agents/wiki-maintainer-agent.md` returns at least one hit.
- [ ] `bash packages/cli/wiki-project.sh update . .autoflow --dry-run` baseline still produces the same shape as before (no regression in `index.md` / `log.md` / `project-overview.md` managed regions).

## Next Action

- 다음에 바로 이어서 할 일: Plan AI 가 Allowed Paths 와 Done When 을 PRD 기준으로 더 좁힌다. Impl AI 는 이 티켓을 todo 에서 claim 한 뒤 mini-plan, 구현, 검증, 머지까지 한 턴에 끝낸다.

## Resume Context

- 현재 상태 요약: Plan AI 가 backlog PRD 에서 todo 티켓을 생성한 직후.
- 직전 작업: scripts/start-plan.sh 가 PRD 를 done 으로 보관하고 todo 티켓을 만들었다.
- 재개 시 먼저 볼 것: PRD, Goal, Allowed Paths, Done When.

## Notes

- Created by planner-1 (Plan AI) from tickets/done/prd_052/prd_052.md at 2026-04-29T13:09:57Z.

## Verification

- Run file:
- Log file:
- Result: pending

## Result

- Summary:
- Remaining risk:
