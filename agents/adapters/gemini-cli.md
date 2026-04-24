# Gemini CLI Adapter

## Purpose

Run Gemini CLI as a local runner, especially for planning, verification, or wiki
maintenance where a second model perspective can be useful.

## Detection

- Check whether the configured Gemini executable exists on `PATH`.
- If missing, mark the runner as `blocked`.

## Expected Inputs

- Role
- Board root
- Project root or ticket worktree root
- Runner id
- Model name

## Completion Contract

Gemini should emit or produce a board state change that Autoflow can verify from
files. The adapter should record final runner status in runner logs.

## Approval Boundary

The same role boundaries apply: allowed paths for todo work, verifier-only
pass/fail decisions, and no remote Git push.

