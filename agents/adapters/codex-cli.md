# Codex CLI Adapter

## Purpose

Run a local Codex CLI process as a planner, todo, verifier, or wiki-maintainer
runner.

## Detection

- Check whether the configured Codex executable exists on `PATH`.
- If missing, mark the runner as `blocked` with an actionable message.

## Expected Inputs

- Role instruction file from `agents/`
- Board root
- Project root or ticket worktree root
- Runner id
- Model name
- Reasoning effort when supported

## Board Context

The adapter should pass only the files needed for the role:

- planner: backlog, plan, reject, roadmap, ticket template
- todo: claimed ticket, referenced spec/plan, allowed paths
- verifier: verifier ticket, verifier rules, verification template
- wiki-maintainer: done tickets, reject tickets, logs, wiki rules

## Completion Contract

The process should leave the board in the expected next state. Runner logs should
capture stdout, stderr, command metadata, and final status.

## Approval Boundary

Codex may modify files only inside the role's allowed project, board, or
worktree scope. Remote Git push is never automatic.

