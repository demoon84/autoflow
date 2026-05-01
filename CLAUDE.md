# CLAUDE.md

@AGENTS.md

## Claude Code

Claude Code reads this file, not `AGENTS.md`, so this file imports the shared Autoflow host guidance above. Autoflow install also provides project-local Claude skills at `.claude/skills/autoflow` and `.claude/skills/order` (renamed from `memo`; the inbox file naming `memo_NNN.md` and the CLI subcommand `autoflow memo create` are intentionally unchanged).

When the user invokes `/autoflow` or `#autoflow`, treat it as an Autoflow PRD handoff trigger:

1. Do not say the trigger is unknown.
2. Do not create a plan, ticket, implementation, or verification yet.
3. Read `.autoflow/agents/spec-author-agent.md` and follow that workflow.
4. Hold a free-form conversation to gather goal, scope, allowed paths, acceptance criteria, and verification. Use short questions and bullet recaps — **do not render the full PRD draft yet**.
5. If the scope is too large for one safe PRD, propose a short PRD split map before drafting. The split map may name multiple candidate PRDs with boundaries, order, and verification focus.
6. Render the full PRD draft only after the user issues an explicit draft trigger such as `초안`, `초안 작성`, `초안 보여줘`, `정리해줘`, `draft`, `draft prd`, `show draft`, or an equivalent clear request. For split work, render each PRD draft separately. Until that trigger fires, keep the chat lightweight.
7. After the draft is shown, save only when the user explicitly confirms with words such as `save`, `저장`, `confirm`, `approved`, or `ready`. A draft trigger is **not** save approval. Multiple drafts need per-PRD approval or a clear `save all` / `전부 저장` confirmation.
8. After saving, tell the user that `autoflow run planner` (Plan AI) will pick the PRD up and create a todo ticket on the next tick, and `autoflow run ticket` (Impl AI) will then claim and finish it.

When the user invokes `/order` or `#order`, treat it as an Autoflow quick order trigger (this trigger was previously named `/memo` / `#memo`; the inbox filename prefix and CLI subcommand are still `memo`):

1. Do not say the trigger is unknown.
2. Save only a short note under `.autoflow/tickets/inbox/memo_NNN.md`.
3. Preserve the original request and add only obvious scope / Allowed Paths / Verification hints.
4. Do not create a PRD, plan, ticket, implementation, verification, commit, or push.
5. Tell the user that `autoflow run planner` (Plan AI) will promote the order into a generated PRD and todo ticket when safe.

Topology note (refactor 2026-04-27): the default board runs **three loop runners** — `planner-1` (Plan AI), `owner-1` (Impl AI), and `wiki-1` (Wiki AI). They tick on disjoint paths so concurrent ticks never produce merge conflicts. Reject auto-replan is Plan AI's responsibility (`start-plan.sh`), not Impl AI's. Up to `AUTOFLOW_REJECT_MAX_RETRIES` attempts, unless `AUTOFLOW_REJECT_AUTO_REPLAN=off`.

Wiki AI note: Impl AI's finish-ticket-owner pass still runs `update-wiki.sh` inline so the deterministic baseline (`.autoflow/wiki/index.md`, `log.md`, `project-overview.md`) is fresh the moment a ticket lands in `done/`. The AI synthesis layer (`autoflow wiki query --synth`, `autoflow wiki lint --semantic`) is delegated to `wiki-1`, which wakes every minute but **debounces**: it only fires synthesis when accumulated change count ≥ `AUTOFLOW_WIKI_DEBOUNCE_MIN_CHANGES` (default 3) **or** time since first pending change ≥ `AUTOFLOW_WIKI_DEBOUNCE_MAX_AGE_SECONDS` (default 1800 = 30 min). Set `AUTOFLOW_WIKI_DEBOUNCE=0` to revert to per-change firing. The inline call no longer triggers the maintainer adapter, keeping a single source of AI invocation.

User-visible worker notation rule: ticket / verification / log markdown and desktop previews should prefer display-only worker wording for runner attribution. Hide the numeric suffix when the role has one enabled runner (`worker`), but keep `worker-N` when multiple enabled runners need disambiguation. Keep storage ids such as `owner-1`, runtime role keys, and runner state filenames unchanged. Existing legacy ticket fields such as `AI`, `Execution AI`, and `Verifier AI` remain readable for compatibility.

Language policy: write newly generated PRD, plan, ticket, and user-friendly memo prose in Korean by default. Preserve parser-sensitive section names, field names, key=value output, paths, commands, code, ticket ids, project keys, and runtime contracts exactly as their templates require.
