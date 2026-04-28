# CLAUDE.md

@AGENTS.md

## Claude Code

Claude Code reads this file, not `AGENTS.md`, so this file imports the shared Autoflow host guidance above. Autoflow install also provides project-local Claude skills at `.claude/skills/autoflow` and `.claude/skills/af`.

When the user invokes `/af`, `/autoflow`, `#af`, or `#autoflow`, treat it as an Autoflow PRD handoff trigger:

1. Do not say the trigger is unknown.
2. Do not create a plan, ticket, implementation, or verification yet.
3. Read `{{BOARD_DIR}}/agents/spec-author-agent.md` and follow that workflow.
4. Draft the full PRD in the chat first.
5. Save only after the user explicitly confirms with words such as `save`, `confirm`, `approved`, or `ready`.
6. After saving, tell the user that `autoflow run planner` (Plan AI) will pick the PRD up and create a todo ticket on the next tick, and `autoflow run ticket` (Impl AI) will then claim and finish it.
