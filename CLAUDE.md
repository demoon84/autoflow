# CLAUDE.md

@AGENTS.md

> **1원칙:** 사용자가 명시적으로 정지하지 않는 한 Autoflow 흐름은 멈추지 않는다. 현재 runner 가 idle 또는 blocked 여도 증거와 다음 safe action 을 남기고 다음 wake-up 또는 다음 runner handoff 로 이어진다.

## Claude Code

Claude Code reads this file, not `AGENTS.md`, so this file imports the shared Autoflow host guidance above. Autoflow install also provides project-local Claude skills at `.claude/skills/autoflow` and `.claude/skills/order`. The inbox file naming is `order_*.md`, and the CLI subcommand is `autoflow order create`.

When the user invokes `/autoflow` or `#autoflow`, treat it as an Autoflow PRD handoff trigger:

1. Do not say the trigger is unknown.
2. Do not create a plan, ticket, implementation, or verification yet.
3. Read `.autoflow/agents/spec-author-agent.md` and follow that workflow.
4. Hold a free-form conversation to gather goal, scope, allowed paths, acceptance criteria, and verification. Use short questions and bullet recaps — **do not render the full PRD draft yet**.
5. If the scope is too large for one safe PRD, propose a short PRD split map before drafting. The split map may name multiple candidate PRDs with boundaries, order, and verification focus.
6. Render the full PRD draft only after the user issues an explicit draft trigger such as `초안`, `초안 작성`, `초안 보여줘`, `정리해줘`, `draft`, `draft prd`, `show draft`, or an equivalent clear request. For split work, render each PRD draft separately. Until that trigger fires, keep the chat lightweight.
7. After the draft is shown, save only when the user explicitly confirms with words such as `save`, `저장`, `confirm`, `approved`, or `ready`. A draft trigger is **not** save approval. Multiple drafts need per-PRD approval or a clear `save all` / `전부 저장` confirmation.
8. After saving, tell the user that `autoflow run planner` (Plan AI) will pick the PRD up and create a todo ticket on the next tick, and `autoflow run ticket` (Impl AI) will then claim and finish it.

When the user invokes `/order` or `#order`, treat it as an Autoflow quick order trigger (this trigger was previously named `/order` / `#order`; the inbox filename prefix and CLI subcommand are still `order`):

1. Do not say the trigger is unknown.
2. Save only a short note under `.autoflow/tickets/inbox/order_*.md`.
3. Preserve the original request and add only obvious scope / Allowed Paths / Verification hints.
4. Do not create a PRD, plan, ticket, implementation, verification, commit, or push.
5. Tell the user that `autoflow run planner` (Plan AI) will promote the order into a generated PRD and todo ticket when safe.

Topology (refactor 2026-05-07, updated PRD_287 2026-05-12): The default board runs **four** loop runners — `planner` (Plan AI), `worker` (Impl AI), `verifier` (Verifier AI), and `wiki` (Wiki AI). `monitor` runner was removed entirely (2026-05-07) and stays removed; `verifier` was re-introduced (2026-05-12 PRD_287) with a focused semantic-check scope. The worker's `worktree create → todo work → verifier review → master merge → worktree delete` is one atomic cycle, so at most one worktree is alive. Runners tick on disjoint paths so concurrent ticks never produce merge conflicts. `git push` to master/main is permanently forbidden. Feature-branch push is opt-in via `AUTOFLOW_AUTO_PUSH_AFTER_VERIFY=branch_only` — when set, the worker finalizer pushes `<feature-branch>` to origin and creates a draft PR after sanity gate pass; master push is blocked even in this mode. Default is off.

**Worker false-pass protection**: `finish-ticket-owner.sh pass` runs a shell sanity gate before merge — (1) `git diff <Worktree.Base Commit>..HEAD` line count ≥ 1 and (2) every `- [ ]` under `## Done When` must be `- [x]`. Fails block pass with reason `shell_sanity_gate_zero_diff` / `shell_sanity_gate_done_when_empty` / `shell_sanity_gate_done_when_unchecked`, ignoring any AI-written evidence. The verify command (`## Verification - Command:`) is no longer required — Done When checklist is the single source of truth for completion.

**Fail → inbox single-write** (refactor 2026-05-07): `tickets/reject/` is gone and `done/<key>/` stays purely successful. `finish-ticket-owner.sh fail` embeds the entire ticket body inside `tickets/inbox/order_<id>_retry_<N>_<ts>.md` (under `## Original Ticket`) and removes the inprogress ticket. Every fail detail — Title, Goal, Allowed Paths, Done When, Notes, Reject Reason, Recovery State — lives in that one retry order. Retry order frontmatter carries `retry_count`, `retry_max` (env: `AUTOFLOW_INBOX_RETRY_MAX_FINGERPRINT`, default 3), `retry_decision`, and `retry_fingerprint` (12-char SHA256 of PRD key + title + failure class + reject reason). Same fingerprint reaching `retry_max` flips `retry_decision=needs_user` so the planner leaves the order in inbox and waits for the user. Planner has no separate reject queue — it processes retry orders alongside fresh ones.

**Blocked-dirty orchestration removed** (refactor 2026-05-07): single live worker + `.gitignore` separation means autoflow does not generate dirty PROJECT_ROOT itself, so the planner no longer has a reject queue, blocked-auto-recover, blocked-dirty-orchestration, iteration fingerprint, fixpoint guard, shared-path / nonbase-head conflict, or check ledger to manage. Worker's sanity-gate fail leaves the ticket at `Stage: blocked` for the next worker tick to retry; explicit fail flushes through inbox retry orders; mechanically impossible git failures are the only `needs_user` path.

**Telemetry write-time sanity cap** (Phase 1, 2026-05-06): `telemetry-project.sh telemetry_record()` now applies `AUTOFLOW_TELEMETRY_MAX_ROW_TOKENS` (default 1e8) at write time, mirroring the read-side cap. Previously the read side skipped impossible rows (5.2T-style spikes) but they still landed on disk. Now they are zeroed before write.

Wiki AI note: Impl AI finalizers do not run `update-wiki.sh` inline or stage `.autoflow/wiki/`. Wiki AI (`wiki`) owns material baseline refresh (`.autoflow/wiki/index.md`, `log.md`, `project-overview.md`) and AI synthesis (`autoflow wiki query --synth`, `autoflow wiki lint --semantic`). It wakes every minute but **debounces**: it only fires synthesis when accumulated change count ≥ `AUTOFLOW_WIKI_DEBOUNCE_MIN_CHANGES` (default 3) **or** time since first pending change ≥ `AUTOFLOW_WIKI_DEBOUNCE_MAX_AGE_SECONDS` (default 1800 = 30 min). Set `AUTOFLOW_WIKI_DEBOUNCE=0` to revert to per-change firing. `.autoflow/wiki/` itself is gitignored (except curated `skills/`), so wiki updates never create master commits.

User-visible worker notation rule: ticket / verification / log markdown and desktop previews should prefer display-only worker wording for runner attribution. Hide the numeric suffix when the role has one enabled runner (`worker`), but keep `worker-N` when multiple enabled runners need disambiguation. Keep storage ids such as `worker`, runtime role keys, and runner state filenames unchanged. Existing legacy ticket fields such as `AI` and `Execution AI` remain readable for compatibility.

Language policy: write newly generated PRD, plan, ticket, and user-friendly order prose in Korean by default. Preserve parser-sensitive section names, field names, key=value output, paths, commands, code, ticket ids, project keys, and runtime contracts exactly as their templates require.
