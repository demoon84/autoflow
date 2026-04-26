# Claude CLI Adapter

Use this adapter when a runner delegates work to Claude Code.

## Contract

- Binary: `claude`.
- Input: a role prompt generated from the Autoflow ticket or PRD.
- Output: stdout, stderr, exit code, and copied prompt/runtime artifacts.
- Best for: Ticket Owner work and PRD handoff when Claude Code is the chat entry point.

## Requirements

- Claude Code reads `CLAUDE.md`, not `AGENTS.md`. Provide a host `CLAUDE.md` that imports `AGENTS.md`.
- The prompt must include board root, project root, ticket path, allowed paths, and no-push rule.
- Browser checks should use Claude browser tools only when needed.

## Safety

- Never push.
- Preserve board state in files.
- Do not create plans or tickets during `/af` / `/autoflow` / `#af` / `#autoflow` handoff.
