# Claude Code Adapter

Use Claude Code as a local Autoflow runner while the file board remains the
source of truth.

Inputs:

- role instruction from `agents/`
- board root
- project root or ticket worktree
- runner id
- model or permission settings when supported

The adapter should return an actionable blocked state if the local executable is
missing or cannot satisfy the requested role.

