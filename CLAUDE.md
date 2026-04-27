# CLAUDE.md

@AGENTS.md

## Claude Code

Claude Code reads this file, not `AGENTS.md`, so this file imports the shared Autoflow host guidance above. Autoflow install also provides project-local Claude skills at `.claude/skills/autoflow` and `.claude/skills/af`.

When the user invokes `/af`, `/autoflow`, `#af`, or `#autoflow`, treat it as an Autoflow PRD handoff trigger:

1. Do not say the trigger is unknown.
2. Do not create a plan, ticket, implementation, or verification yet.
3. Read `.autoflow/agents/spec-author-agent.md` and follow that workflow.
4. Draft the full PRD in the chat first.
5. Save only after the user explicitly confirms with words such as `save`, `confirm`, `approved`, or `ready`.
6. After saving, tell the user that `autoflow run planner` (Plan AI) will pick the PRD up and create a todo ticket on the next tick, and `autoflow run ticket` (Impl AI) will then claim and finish it.

Topology note (refactor 2026-04-27): the default board runs **three loop runners** — `planner-1` (Plan AI), `owner-1` (Impl AI), and `wiki-1` (Wiki AI). They tick on disjoint paths so concurrent ticks never produce merge conflicts. Reject auto-replan is Plan AI's responsibility (`start-plan.sh`), not Impl AI's. Up to `AUTOFLOW_REJECT_MAX_RETRIES` attempts, unless `AUTOFLOW_REJECT_AUTO_REPLAN=off`.

Wiki AI note: Impl AI's finish-ticket-owner pass still runs `update-wiki.sh` inline so the deterministic baseline (`.autoflow/wiki/index.md`, `log.md`, `project-overview.md`) is fresh the moment a ticket lands in `done/`. The AI synthesis layer (`autoflow wiki query --synth`, `autoflow wiki lint --semantic`) is delegated to `wiki-1` which polls done/reject for changes; the inline call no longer triggers the maintainer adapter, keeping a single source of AI invocation.

User-visible worker notation rule: ticket / verification / log markdown and desktop previews should render runner ids as `AI-N`. Keep storage ids such as `owner-1`, runtime role keys, and runner state filenames unchanged.
