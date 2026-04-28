# CLAUDE.md

@AGENTS.md

## Claude Code

Claude Code reads this file, not `AGENTS.md`, so this file imports the shared Autoflow host guidance above. Autoflow install also provides project-local Claude skills at `.claude/skills/autoflow`, `.claude/skills/af`, and `.claude/skills/memo`.

When the user invokes `/af`, `/autoflow`, `#af`, or `#autoflow`, treat it as an Autoflow PRD handoff trigger:

1. Do not say the trigger is unknown.
2. Do not create a plan, ticket, implementation, or verification yet.
3. Read `{{BOARD_DIR}}/agents/spec-author-agent.md` and follow that workflow.
4. Draft the full PRD in the chat first.
5. Save only after the user explicitly confirms with words such as `save`, `confirm`, `approved`, or `ready`.
6. After saving, tell the user that `autoflow run planner` (Plan AI) will pick the PRD up and create a todo ticket on the next tick, and `autoflow run ticket` (Impl AI) will then claim and finish it.

When the user invokes `/memo` or `#memo`, treat it as an Autoflow quick memo trigger:

1. Do not say the trigger is unknown.
2. Save only a short memo under `{{BOARD_DIR}}/tickets/inbox/memo_NNN.md`.
3. Preserve the original request and add only obvious scope / Allowed Paths / Verification hints.
4. Do not create a PRD, plan, ticket, implementation, verification, commit, or push.
5. Tell the user that `autoflow run planner` (Plan AI) will promote the memo into a generated PRD and todo ticket when safe.
