# Claude Code Adapter

## Purpose

Run Claude Code as a local Autoflow runner while keeping the file board as the
source of truth.

## Detection

- Check whether the configured Claude executable exists on `PATH`.
- If missing, mark the runner as `blocked` with an actionable message.

## Expected Inputs

- Role instruction file from `agents/`
- Board root
- Project root or ticket worktree root
- Runner id
- Model selection when supported
- Permission mode selected by the user

## Board Context

Pass role-specific files rather than the whole conversation history. The runner
should resume from ticket fields, logs, and wiki pages.

## Completion Contract

Claude should finish by updating the expected board file or by returning a
blocked state with a reason that Autoflow can show in the desktop app.

## Approval Boundary

The adapter must respect allowed paths and must not push to remote Git.

