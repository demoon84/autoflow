# Codex CLI Adapter

Use this adapter when a runner delegates work to local Codex CLI.

## Contract

- Binary: `codex`.
- Input: a role prompt generated from the Autoflow ticket or PRD.
- Output: stdout, stderr, exit code, and copied prompt/runtime artifacts.
- Best for: Ticket Owner work, code changes, and local verification inside allowed paths.

## Requirements

- The prompt must include board root, project root, ticket path, allowed paths, and no-push rule.
- Durable progress must be written to board files.
- Browser checks should use the Codex built-in browser tool only when needed.

## Safety

- Never push.
- Do not hide state in chat output.
- Respect host `AGENTS.md` instructions.
