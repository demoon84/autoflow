# CLAUDE.md

@AGENTS.md

## Claude Code

Claude Code reads this file, not `AGENTS.md`, so this file imports the shared Autoflow host guidance above. Autoflow install also provides project-local Claude skills at `.claude/skills/autoflow` and `.claude/skills/order` (renamed from `memo`; the inbox file naming `memo_*.md` and the CLI subcommand `autoflow order create` are intentionally unchanged).

When the user invokes `/autoflow` or `#autoflow`, treat it as an Autoflow PRD handoff trigger:

1. Do not say the trigger is unknown.
2. Do not create a plan, ticket, implementation, or verification yet.
3. Read `{{BOARD_DIR}}/agents/spec-author-agent.md` and follow that workflow.
4. Hold a free-form conversation to gather goal, scope, allowed paths, acceptance criteria, and verification. Use short questions and bullet recaps — **do not render the full PRD draft yet**.
5. If the scope is too large for one safe PRD, propose a short PRD split map before drafting. The split map may name multiple candidate PRDs with boundaries, order, and verification focus.
6. Render the full PRD draft only after the user issues an explicit draft trigger such as `초안`, `초안 작성`, `초안 보여줘`, `정리해줘`, `draft`, `draft prd`, `show draft`, or an equivalent clear request. For split work, render each PRD draft separately. Until that trigger fires, keep the chat lightweight.
7. After the draft is shown, save only when the user explicitly confirms with words such as `save`, `저장`, `confirm`, `approved`, or `ready`. A draft trigger is **not** save approval. Multiple drafts need per-PRD approval or a clear `save all` / `전부 저장` confirmation.
8. After saving, tell the user that `autoflow run planner` (Plan AI) will pick the PRD up and create a todo ticket on the next tick, and `autoflow run ticket` (Impl AI) will then claim and finish it.

When the user invokes `/order` or `#order`, treat it as an Autoflow quick order trigger:

1. Do not say the trigger is unknown.
2. Save only a short note under `{{BOARD_DIR}}/tickets/inbox/memo_*.md`.
3. Preserve the original request and add only obvious scope / Allowed Paths / Verification hints.
4. Do not create a PRD, plan, ticket, implementation, verification, commit, or push.
5. Tell the user that `autoflow run planner` (Plan AI) will promote the order into a generated PRD and todo ticket when safe.
