# Shell Adapter

Use this adapter for deterministic local commands.

## Contract

- Binary: the current shell.
- Input: command text from runner config or generated prompt wrapper.
- Output: stdout, stderr, and exit code.
- Best for: scripts, smoke checks, local tools, and dry-run previews.

## Safety

- Prefer read-only commands for dry-runs.
- Never push.
- Keep command output in runner logs.
