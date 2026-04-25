# Codex CLI Adapter

Use Codex CLI as a local Autoflow runner.

Inputs:

- role instruction from `agents/`
- board root
- project root or ticket worktree
- runner id
- model name
- reasoning effort when supported

Boundaries:

- follow ticket `Allowed Paths`
- use verifier rules for pass/fail
- never push to remote Git automatically

