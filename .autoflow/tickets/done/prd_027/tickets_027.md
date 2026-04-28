# Ticket

## Ticket

- ID: tickets_027
- PRD Key: prd_027
- Plan Candidate: Plan AI handoff from tickets/done/prd_027/prd_027.md
- Title: Replace the desktop design kit from shadcn/Radix/Tailwind to MUI
- Stage: done
- AI: AI-1
- Claimed By: AI-1
- Execution AI: AI-1
- Verifier AI: AI-1
- Last Updated: 2026-04-28T13:44:48Z

## Goal

- 이번 작업의 목표: Replace the Autoflow desktop app design-kit foundation from shadcn-compatible Radix/Tailwind wrappers to MUI while preserving current desktop behavior, Korean user-facing copy, and board-reading workflows.

## References

- PRD: tickets/done/prd_027/prd_027.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Obsidian Links

- Project Note: [[prd_027]]
- Plan Note:
- Ticket Note: [[tickets_027]]

## Allowed Paths

- AGENTS.md
- README.md
- scaffold/board/AGENTS.md
- apps/desktop/package.json
- apps/desktop/package-lock.json
- apps/desktop/vite.config.ts
- apps/desktop/components.json
- apps/desktop/src/renderer
- apps/desktop/src/components/ui
- apps/desktop/src/lib/utils.ts

## Worktree
- Path: `/Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_027`
- Branch: autoflow/tickets_027
- Base Commit: db8cc57a04de9021939da84783a65538857490ec
- Worktree Commit: 6ecc56ab85dd55831d202fd1144db5bf40a88920
- Integration Status: integrated

## Done When

- [x] Root and scaffold guidance no longer require shadcn/ui for desktop UI work and instead identify MUI as the preferred desktop design-kit foundation.
- [x] `apps/desktop` installs and uses MUI Material with Emotion styling dependencies.
- [x] The React renderer is wrapped in a MUI theme provider and baseline reset.
- [x] Existing desktop controls currently backed by local shadcn-style wrappers have MUI equivalents: button, input, badge/chip, dialog, select/menu, and any active tab/control primitive.
- [x] Existing desktop board views still render the same core data: project state, runner state, ticket/workflow views, wiki/log previews, and metrics/report panels.
- [x] User-facing Korean labels remain intact.
- [x] shadcn/Radix/Tailwind/CVA utilities are removed from desktop dependencies when no longer used.
- [x] `apps/desktop/components.json` is removed or made obsolete by the migration.
- [x] No new plans, tickets, verification records, commits, or pushes are created by PRD authoring itself.

## Next Action
- Complete: coordinator integrated the verified ticket, archived evidence, and prepared the local completion commit.

## Resume Context

- 현재 상태 요약: MUI migration is implemented in the ticket worktree and manually merged into PROJECT_ROOT. Worktree and PROJECT_ROOT match for the Allowed Paths, including pre-existing renderer overlap that was preserved.
- 직전 작업: Ran required verification in worktree and PROJECT_ROOT; all required commands passed. The removed-stack grep returned no matches.
- 재개 시 먼저 볼 것: `tickets/inprogress/verify_027.md`, Worktree integration status, and finish-ticket-owner finalizer output.

## Notes

- Created by planner-1 (Plan AI) from tickets/done/prd_027/prd_027.md at 2026-04-28T13:25:10Z.
- Plan AI refinement at 2026-04-28T13:27:06Z:
  - Filled concrete Allowed Paths from `tickets/done/prd_027/prd_027.md` because the runtime parser only extracts a `## Allowed Paths` section and the PRD stores paths under `## Main Screens / Modules`.
  - Wiki query command: `./bin/autoflow wiki query . --term MUI --term shadcn --term Radix --term Tailwind --term desktop --term renderer --term components/ui --term "design kit"`.
  - Wiki/ticket context: `tickets/done/prd_011/prd_011.md` and `tickets/done/prd_024/prd_024.md` show the current ticket workspace and detail-layer UX depends on shadcn/Radix tabs/dialog patterns plus `MarkdownViewer`; migrate these to MUI equivalents without changing board-reading behavior.
  - Wiki/ticket context: `tickets/done/prd_021/tickets_021.md` shows workflow page runner controls, role-only labels, synced model/reasoning controls, and wrapping progress dots; preserve those interactions during component replacement.
  - Wiki/ticket context: `tickets/done/prd_003/reject_003.md` and `.autoflow/wiki/learnings/ticket-overlap-no-op.md` warn that overlapping `main.tsx`/`styles.css` work can produce no-op or dirty-root retries; implementation must keep an isolated ticket diff and should not pass a zero-diff worktree.
  - Wiki/ticket context: `.autoflow/wiki/learnings/merge-blocked-already-applied-patch.md` records prior `styles.css` merge blockage and the already-applied-patch pattern; if merge is blocked on dirty `PROJECT_ROOT`, diagnose at patch level before retrying finish.

- Runtime hydrated worktree dependency at 2026-04-28T13:25:16Z: linked apps/desktop/node_modules -> /Users/demoon/Documents/project/autoflow/apps/desktop/node_modules
- Runtime hydrated worktree dependency at 2026-04-28T13:25:16Z: linked node_modules -> /Users/demoon/Documents/project/autoflow/node_modules
- AI AI-1 prepared todo at 2026-04-28T13:25:16Z; worktree=/Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_027; run=tickets/inprogress/verify_027.md
- AI AI-1 prepared resume at 2026-04-28T13:25:57Z; worktree=/Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_027; run=tickets/inprogress/verify_027.md
- Owner mini-plan at 2026-04-28T13:27:15Z:
  1. Update root/scaffold/README guidance from shadcn-first to MUI-first.
  2. Install `@mui/material`, `@emotion/react`, and `@emotion/styled`; remove unused Radix/Tailwind/CVA utilities once imports are gone.
  3. Add a desktop MUI theme and wrap the renderer with `ThemeProvider` + `CssBaseline`.
  4. Replace local UI primitive implementations with MUI-backed equivalents while preserving existing component APIs and Korean UI copy.
  5. Remove obsolete shadcn/Tailwind config and run the required checks from the PRD.
- Owner wiki query at 2026-04-28T13:27:15Z: `./bin/autoflow wiki query --term "MUI desktop design kit" --term "apps/desktop components ui" --term "shadcn Radix Tailwind"` returned `result_count=0`. The Plan AI context above remains the related-ticket constraint set for preserving current desktop workflows.
- Implementation summary at 2026-04-28T13:41:02Z: replaced desktop UI wrappers with MUI-backed components, added `apps/desktop/src/renderer/theme.ts`, wrapped the renderer in `ThemeProvider` and `CssBaseline`, removed obsolete desktop component config and dependency usage, and updated root/scaffold/README guidance to MUI-first.
- Merge note at 2026-04-28T13:41:02Z: PROJECT_ROOT already had overlapping renderer changes for workflow pin empty-state behavior. AI preserved those changes and mirrored them into the ticket worktree so final PROJECT_ROOT and worktree content match within Allowed Paths.
- Verification evidence at 2026-04-28T13:41:02Z: `npm --prefix apps/desktop run check`, `npm run desktop:check`, `git diff --check -- AGENTS.md scaffold/board/AGENTS.md README.md apps/desktop`, and removed-stack `rg` all passed; `rg` exited 1 because there were no matches.
- Finish paused at 2026-04-28T13:42:03Z: worktree HEAD db8cc57a04de9021939da84783a65538857490ec does not contain PROJECT_ROOT HEAD 757d12386589293ac23978883d6f66f09974834f. AI must perform the rebase/merge; script did not run git rebase.
- Rebase note at 2026-04-28T13:43:31Z: AI committed the ticket worktree snapshot, rebased `autoflow/tickets_027` onto `main` commit `7f6b5fb`, reran worktree and PROJECT_ROOT desktop checks, and recorded worktree commit `6ecc56ab85dd55831d202fd1144db5bf40a88920`.
- Impl AI AI-1 marked verification pass at 2026-04-28T13:44:12Z; runtime finalizer will not perform merge operations.
- Merge blocked at 2026-04-28T13:44:12Z: Worktree Commit touched paths outside Allowed Paths (apps/desktop/src/components/ui/badge.tsx apps/desktop/src/components/ui/button.tsx apps/desktop/src/components/ui/card.tsx apps/desktop/src/components/ui/dialog.tsx apps/desktop/src/components/ui/input.tsx apps/desktop/src/components/ui/label.tsx apps/desktop/src/components/ui/select.tsx apps/desktop/src/components/ui/separator.tsx apps/desktop/src/components/ui/tabs.tsx apps/desktop/src/renderer/main.tsx apps/desktop/src/renderer/styles.css apps/desktop/src/renderer/theme.ts).
- Impl AI AI-1 flagged merge_blocked in place at 2026-04-28T13:44:12Z: invalid_worktree_commit_scope.
- Scope repair at 2026-04-28T13:44:12Z: normalized directory Allowed Paths by removing trailing slashes so the runtime prefix matcher recognizes `apps/desktop/src/renderer/*` and `apps/desktop/src/components/ui/*` as in-scope.
- Impl AI AI-1 marked verification pass at 2026-04-28T13:44:48Z; runtime finalizer will not perform merge operations.
- Merge finalizer verified at 2026-04-28T13:44:48Z: AI already integrated worktree commit 6ecc56ab85dd55831d202fd1144db5bf40a88920 into PROJECT_ROOT; script performed no rebase or cherry-pick.
- Coordinator AI-1 finalized this verified ticket at 2026-04-28T13:44:48Z.
- Coordinator post-merge cleanup at 2026-04-28T13:44:48Z: removed_worktree=/Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_027 deleted_branch=autoflow/tickets_027.
## Verification
- Run file: `tickets/done/prd_027/verify_027.md`
- Log file: `logs/verifier_027_20260428_134449Z_pass.md`
- Result: passed

## Result

- Summary: Replace desktop design kit with MUI Material and Emotion
- Remaining risk: Visual inspection of the Electron shell was not launched in this turn; build/type/grep checks passed and wrapper APIs were kept compatible with existing renderer usage.
