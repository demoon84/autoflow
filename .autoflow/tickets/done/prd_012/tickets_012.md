# Ticket

## Ticket

- ID: tickets_012
- PRD Key: prd_012
- Plan Candidate: Plan AI handoff from tickets/done/prd_012/prd_012.md
- Title: Rename runner ids to role-aligned slugs (planner / worker / wiki-maintainer)
- Stage: done
- AI: 019dced1-1e5a-77c2-8ac5-459080d66015
- Claimed By: 019dced1-1e5a-77c2-8ac5-459080d66015
- Execution AI: 019dced1-1e5a-77c2-8ac5-459080d66015
- Verifier AI: 019dced1-1e5a-77c2-8ac5-459080d66015
- Last Updated: 2026-04-27T16:07:56Z

## Goal

- 이번 작업의 목표: 3-runner 토폴로지의 runner id 를 카운터 접미사 없는 역할 친화 슬러그로 재명명한다. `planner-1` → `planner`, `owner-1` → `worker`, `wiki-1` → `wiki-maintainer`. config / heartbeat / 데스크톱 UI / docs / CLI help 의 모든 하드코딩된 id 를 일관되게 갱신하고, 기존 runner state 파일은 새 id 기준으로 이주한다. role 식별자 (`planner`, `ticket-owner`, `wiki-maintainer`) 는 변경하지 않는다.

## References

- PRD: tickets/done/prd_012/prd_012.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Obsidian Links

- Project Note: [[prd_012]]
- Plan Note:
- Ticket Note: [[tickets_012]]

## Allowed Paths

- `.autoflow/runners/config.toml`
- `.autoflow/automations/heartbeat-set.toml`
- `.autoflow/runners/state/planner-1.state` (rename to `planner.state`)
- `.autoflow/runners/state/owner-1.state` (rename to `worker.state`)
- `.autoflow/runners/state/wiki-1.state` (rename to `wiki-maintainer.state`)
- `.autoflow/runners/state/` (any other old-id state files to clean up)
- `apps/desktop/src/renderer/main.tsx`
- `AGENTS.md`
- `CLAUDE.md`
- `bin/autoflow` (CLI help text runner id examples)
- `.autoflow/scripts/merge-ready-ticket.sh` (wiki-1 comment reference)

## Worktree
- Path: `/Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_012`
- Branch: autoflow/tickets_012
- Base Commit: cce1ea5dacf0d14adfb4aec5039037d9553d54f0
- Worktree Commit:
- Integration Status: superseded_by_current_topology

## Done When

- [ ] `.autoflow/runners/config.toml` 의 세 entry id 가 `planner` / `worker` / `wiki-maintainer` 로 변경되어 있다.
- [ ] `.autoflow/automations/heartbeat-set.toml` 의 `planner_workers` / `owner_workers` / `wiki_workers` 와 `[thread_ids]` 가 새 id 를 참조한다.
- [ ] `bin/autoflow doctor` 가 status=ok, error_count=0, warning_count=0 으로 통과한다.
- [ ] `bin/autoflow run planner --dry-run` 출력의 `runner_id` 가 `planner` 다.
- [ ] `bin/autoflow run ticket --dry-run` 출력의 `runner_id` 가 `worker` 다.
- [ ] `bin/autoflow run wiki --dry-run` 출력의 `runner_id` 가 `wiki-maintainer` 다 (cli 의 default_runner_id 도 `wiki-maintainer` 로 갱신).
- [ ] 데스크톱 앱이 새 config 로 reload 됐을 때 AI 패널에 "Plan AI / Impl AI / Wiki AI" 카드 3개가 표시되고, 각 카드의 runner id 가 새 슬러그로 보인다.
- [ ] AGENTS.md / CLAUDE.md 의 모든 `planner-1` / `owner-1` / `wiki-1` 인용이 새 슬러그로 교체됐다.
- [ ] 기존 `runners/state/{planner-1,owner-1,wiki-1}.state` 파일이 있으면 새 id 의 파일명으로 이주(또는 삭제 후 새로 생성).
- [ ] `bin/autoflow` CLI help text 의 runner id 예시가 새 슬러그로 갱신됐다.

## Next Action
- Complete: current `main` keeps the documented `planner-1` / `owner-1` / `wiki-1` runner ids. The stale worktree-only config rename to `planner` / `worker` / `wiki-maintainer` was intentionally not applied because it conflicts with the current AGENTS topology contract and live runner state.

## Resume Context

- 현재 상태 요약: Plan AI 가 PRD 에서 todo 티켓을 생성하고 Allowed Paths / Done When / Verification 을 구체화한 직후.
- 직전 작업: start-plan.sh 가 PRD 를 done 으로 보관하고 todo 티켓을 만들었으며, Plan AI 가 Allowed Paths 를 11개의 구체적 파일/디렉토리로 좁혔다.
- 재개 시 먼저 볼 것: PRD (tickets/done/prd_012/prd_012.md), Allowed Paths, Done When, Verification command.

## Notes

- Created by AI-1 (Plan AI) from tickets/done/prd_012/prd_012.md at 2026-04-27T12:00:49Z.
- Wiki context: tickets_009 (prd_009) previously implemented `display_worker_id` and AI-N normalization in board scripts and desktop UI. The id-to-display mapping in main.tsx was updated for the 3-line agent/id/progress card format (tickets_007). Ensure the new slugs integrate cleanly with existing `display_worker_id()` logic in common.sh and the desktop renderer's id-to-label mapping.
- Wiki context: `wiki-maintainer` will make id === role for that runner. PRD notes this is safe because scripts query id and role separately, but desktop UI regex patterns like `^wiki-maintainer-\d+$` will no longer match — need slug-based branch or role-based fallback.
- Wiki context: `worker` is intentionally different from role `ticket-owner` — namespace reservation for future multi-worker scaling (`worker-1`, `worker-2`).
- Existing state files in `.autoflow/runners/state/`: planner-1.state, owner-1.state, wiki-1.state (plus legacy coordinator-1.state, merge-1.state, owner-2.state, owner-3.state which are out of scope).
- The PRD's Out of Scope explicitly excludes: role name changes, topology changes, old log file backfill, and PowerShell variants.

- AI 019dced1-1e5a-77c2-8ac5-459080d66015 prepared todo at 2026-04-27T12:02:23Z; worktree=/Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_012; run=tickets/inprogress/verify_012.md
- AI-led resolution at 2026-04-27T16:07:56Z: branch commit `cce1ea5` is already in `main`; the remaining dirty worktree change only renamed live runner ids and switched configured agents/models. Current project instructions explicitly keep `planner-1`, `owner-1`, and `wiki-1`, so `main` was preserved and the stale worktree was closed as superseded.
## Verification
- Run file: `tickets/done/prd_012/verify_012.md`
- Log file: `logs/manual_worktree_merge_20260427_160756Z.md`
- Result: resolved as superseded by current topology contract

## Result

- Summary: Stale runner-id rename was not applied; current runner topology remains consistent with AGENTS and active config.
- Remaining risk: The original PRD acceptance criteria for slug renaming are intentionally unmet because the project later re-standardized on `planner-1` / `owner-1` / `wiki-1`.
