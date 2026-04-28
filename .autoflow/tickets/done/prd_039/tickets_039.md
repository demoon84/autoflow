# Ticket

## Ticket

- ID: tickets_039
- PRD Key: prd_039
- Plan Candidate: Plan AI handoff from tickets/done/prd_039/prd_039.md
- Title: Replace AI-N display labels with worker wording
- Stage: done
- AI: worker-1
- Claimed By: AI-1
- Execution AI: worker-1
- Verifier AI: worker-1
- Last Updated: 2026-04-28T21:03:35Z

## Goal

- 이번 작업의 목표: Update user-visible worker attribution and stale `AI-1` / `AI-N` display text so the product presents runner workers as `worker` where appropriate, while preserving internal storage identifiers such as `owner-1`, runner state filenames, runtime role keys, and parser-sensitive ticket fields unless they are migrated compatibly.

## References

- PRD: tickets/done/prd_039/prd_039.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Obsidian Links

- Project Note: [[prd_039]]
- Plan Note:
- Ticket Note: [[tickets_039]]

## Allowed Paths

- `apps/desktop/src/components/ui/markdown-viewer.tsx`
- `apps/desktop/src/renderer/main.tsx`
- `.autoflow/scripts`
- `runtime/board-scripts`
- `.autoflow/reference/ticket-template.md`
- `.autoflow/reference/tickets-board.md`
- `scaffold/board/reference/ticket-template.md`
- `scaffold/board/reference/tickets-board.md`
- `AGENTS.md`
- `CLAUDE.md`
- `.autoflow/AGENTS.md`
- `scaffold/board/AGENTS.md`
- `packages/cli/doctor-project.sh`
- `packages/cli/doctor-project.ps1`
- `packages/cli/README.md`

## Worktree
- Path: `/Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_039`
- Branch: autoflow/tickets_039
- Base Commit: 94946f21fd56f750fc061083b54f3d030e7ad125
- Worktree Commit: 22ecf4de2d451e5162473fc4f000f4ca11c7bc8e
- Integration Status: integrated

## Done When

- [ ] User-visible worker attribution produced after this change no longer displays `AI-1` / `AI-N` as the preferred worker label in scoped runtime notes, logs, ticket previews, or desktop metadata rows.
- [ ] Internal storage ids and runner ids such as `owner-1`, `planner-1`, `wiki-1`, state filenames, role keys, and config ids remain unchanged.
- [ ] Desktop markdown preview no longer force-rewrites worker-like ids into `AI-N`; code blocks and inline code remain protected from display rewrites.
- [ ] Ticket creation/claim/verification/finalization scripts still read existing legacy tickets that contain `AI`, `Execution AI`, or `Verifier AI` fields.
- [ ] Live `.autoflow/scripts` and source `runtime/board-scripts` stay behaviorally mirrored for any touched worker-display logic.
- [ ] Scaffold docs/templates and live board docs no longer document `AI-N` as the required user-visible worker attribution policy.
- [ ] CLI doctor checks still pass or are updated with backward-compatible field validation if any ticket template keys change.
- [ ] The implementation stays within the listed Allowed Paths and does not rewrite historical done tickets/logs.

## Next Action
- Complete: the inline merge finalizer integrated the AI-merged ticket, archived evidence, and prepared the local completion commit.

## Resume Context

- 현재 상태 요약: Implementation and AI-led verification passed in PROJECT_ROOT. Worktree snapshot files were aligned to the resolved PROJECT_ROOT content for the touched Allowed Paths.
- 직전 작업: Ran `npm run desktop:check`, `./bin/autoflow doctor .`, scoped `rg`, `git diff --check`, and runtime worker helper smoke checks.
- 재개 시 먼저 볼 것: Run finish-ticket-owner pass as bookkeeping/finalization only.

## Notes

- Created by planner-1 (Plan AI) from tickets/done/prd_039/prd_039.md at 2026-04-28T20:55:47Z.

- Runtime hydrated worktree dependency at 2026-04-28T20:56:06Z: linked apps/desktop/node_modules -> /Users/demoon/Documents/project/autoflow/apps/desktop/node_modules
- Runtime hydrated worktree dependency at 2026-04-28T20:56:06Z: linked node_modules -> /Users/demoon/Documents/project/autoflow/node_modules
- AI AI-1 prepared todo at 2026-04-28T20:56:06Z; worktree=/Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_039; run=tickets/inprogress/verify_039.md
- AI AI-1 prepared resume at 2026-04-28T20:56:29Z; worktree=/Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_039; run=tickets/inprogress/verify_039.md
- Mini-plan at 2026-04-28T20:57:15Z:
  1. Change runtime display helpers in live `.autoflow/scripts` and mirrored `runtime/board-scripts` so future user-visible attribution writes `worker-N`, while `worker_id_matches_field` remains backward-compatible with legacy `AI-N`, `owner-N`, and `worker-N` values.
  2. Remove desktop markdown preview's forced `owner-*` / `worker-*` / `ai-*` to `AI-*` text rewrite, preserving code and inline-code behavior by no longer rewriting ordinary text.
  3. Update desktop ticket metadata rows from `AI` to worker wording and update `displayWorkflowRunnerId` to prefer `worker-N` for owner/worker/ai values.
  4. Update scoped board/scaffold policy docs and ticket templates to stop requiring `AI-N` display wording while keeping legacy `AI`, `Execution AI`, and `Verifier AI` fields readable.
  5. Verify with the PRD commands and record any intentional parser-compatible `AI` key matches.
  Wiki context: ticket-owner wiki query returned no matches for the ticket-specific terms; PRD context says `.autoflow/wiki/decisions/worker-display-policy.md` is superseded for future user-visible output and `tickets/done/prd_028` supports removing visible AI prefixes from runner controls.
- Progress at 2026-04-28T21:02:50Z: Removed desktop markdown `AI-N` rewrite plugin, changed desktop ticket detail metadata to `Worker`, changed runtime display helpers to emit `worker-N`, added canonical worker matching for legacy `AI-N` / `owner-N` / `worker-N` values, and mirrored live/source board scripts.
- Verification at 2026-04-28T21:02:50Z: `npm run desktop:check` passed; `./bin/autoflow doctor .` passed from PROJECT_ROOT with warnings only; scoped `rg "AI-1|AI-N|AI-[0-9]" ...` returned no matches; runtime helper smoke returned `display_owner=worker-1`, `display_ai=worker-1`, `match=ok`.
- Prepared worktree commit 22ecf4de2d451e5162473fc4f000f4ca11c7bc8e at 2026-04-28T21:03:35Z; Impl AI integrates it into PROJECT_ROOT and the inline finalizer creates the local completion commit.
- Impl AI worker-1 marked verification pass at 2026-04-28T21:03:35Z; runtime finalizer will not perform merge operations.
- Merge finalizer verified at 2026-04-28T21:03:35Z: AI already integrated worktree commit 22ecf4de2d451e5162473fc4f000f4ca11c7bc8e into PROJECT_ROOT; script performed no rebase or cherry-pick.
- Inline merge finalizer (worker worker-1) finalized this verified ticket at 2026-04-28T21:03:35Z.
- Coordinator post-merge cleanup at 2026-04-28T21:03:35Z: removed_worktree=/Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_039 deleted_branch=autoflow/tickets_039.
## Verification
- Run file: `tickets/done/prd_039/verify_039.md`
- Log file: `logs/verifier_039_20260428_210336Z_pass.md`
- Result: passed

## Result

- Summary: Worker display labels now prefer worker-N and legacy AI-N ownership matching remains compatible
- Remaining risk: Existing broad PROJECT_ROOT dirty state includes unrelated allowed-path edits from prior work; this ticket preserved them while applying and verifying the worker-label changes.
