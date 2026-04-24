# OpenCode Adapter

## Purpose

Run OpenCode as an alternate local coding-agent runner.

## Detection

- Check whether the configured OpenCode executable exists on `PATH`.
- If missing, mark the runner as `blocked`.

## Expected Inputs

- Role
- Board root
- Project root or ticket worktree root
- Runner id
- Model or provider configuration

## Completion Contract

OpenCode should update the board through the same role contract as every other
adapter. Autoflow should not depend on OpenCode-specific state as the source of
truth.

## Approval Boundary

OpenCode can be used for implementation, planning, or verification, but board
stage remains authoritative and remote Git push remains disabled.

