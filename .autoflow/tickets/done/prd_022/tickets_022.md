# Ticket

## Ticket

- ID: tickets_022
- PRD Key: prd_022
- Plan Candidate: Plan AI handoff from tickets/done/prd_022/prd_022.md
- Title: Log-driven self-improvement trial runner — analyze logs, detect repeated issues, emit safe improvement candidates
- Stage: done
- AI: 019dcf2f-4ac4-7672-861d-206083f3e4ec
- Claimed By: 019dcf2f-4ac4-7672-861d-206083f3e4ec
- Execution AI: 019dcf2f-4ac4-7672-861d-206083f3e4ec
- Verifier AI: 019dcf2f-4ac4-7672-861d-206083f3e4ec
- Last Updated: 2026-04-27T13:58:08Z

## Goal

- 이번 작업의 목표: 누적된 Autoflow 로그와 runner 상태를 30분마다 분석해 반복되는 운영 문제를 탐지하고, 증거 기반의 저위험 개선 후보만 PRD/TODO/ticket-owner 흐름에 넘기는 trial self-improvement runner 를 구축한다. 최대 3시간 또는 6 tick 후 자동 만료. 고위험 후보는 `recommend_only` 로 기록만 하고 자동 구현하지 않는다. `git push` 절대 금지.

## References

- PRD: tickets/done/prd_022/prd_022.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Obsidian Links

- Project Note: [[prd_022]]
- Plan Note:
- Ticket Note: [[tickets_022]]

## Allowed Paths

- `runtime/board-scripts/start-self-improve.sh` (new — trial runner runtime script)
- `runtime/board-scripts/common.sh` (add fingerprint/dedup helpers if needed)
- `.autoflow/scripts/start-self-improve.sh` (mirror of runtime script)
- `.autoflow/scripts/common.sh` (mirror)
- `packages/cli/run-role.sh` (add `self-improve` role route)
- `packages/cli/run-role.sh` (runtime copy)
- `runtime/board-scripts/run-role.sh` (add `self-improve` role route)
- `.autoflow/runners/config.toml` (add trial runner entry, disabled by default)
- `.autoflow/logs/` (durable tick logs: `self-improve_*.md`)
- `scaffold/board/runners/config.toml` (scaffold default for new boards)
- `tests/smoke/log-driven-self-improvement-smoke.sh` (new smoke test)
- `bin/autoflow` (CLI help text — add `run self-improve` entry)

## Worktree
- Path: `/Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_022`
- Branch: autoflow/tickets_022
- Base Commit: 049209895508984a9418dc02ff4d7a1cc088088e
- Worktree Commit:
- Integration Status: no_code_changes

## Done When

- [ ] A self-improvement trial runner/config exists with `interval_seconds=1800`, `max_duration_seconds=10800`, and `max_ticks=6` or equivalent settings.
- [ ] Each tick reads recent logs and runner/ticket state, then records a durable `self-improve` log with status, reason, and evidence summary under `.autoflow/logs/self-improve_*.md`.
- [ ] Repeated issues are grouped by stable fingerprints so noisy logs do not create duplicate PRDs or tickets.
- [ ] A candidate is created only when a fingerprint crosses the configured threshold.
- [ ] Candidate output includes source log paths, occurrence count, impact, suspected cause, risk level, proposed allowed paths, and proposed verification command.
- [ ] Existing open PRDs/tickets and recent self-improvement logs are checked before creating new work.
- [ ] Low-risk candidates can be handed to PRD/TODO/ticket-owner flow (via `autoflow prd create` or equivalent board file write).
- [ ] High-risk candidates are logged as `recommend_only` and are not implemented automatically.
- [ ] If the repo has unsafe dirty overlap, active merge/rebase/cherry-pick, or active conflicting ticket work, the tick skips mutation and records the skip reason.
- [ ] After 3 hours or 6 ticks, the runner no longer creates or mutates work and records `status=expired` or equivalent.
- [ ] No path in the flow executes `git push`.
- [ ] `bash -n runtime/board-scripts/start-self-improve.sh` passes.
- [ ] `bash tests/smoke/log-driven-self-improvement-smoke.sh` passes with coverage for: no-log idle, repeated-pattern candidate creation, duplicate suppression, high-risk recommend-only, unsafe dirty-skip, and trial expiry.

## Next Action
- Complete: coordinator integrated the verified ticket, archived evidence, and prepared the local completion commit.

## Resume Context

- 현재 상태 요약: Plan AI 가 Allowed Paths, Title, Goal, Notes, Verification 을 PRD 기준으로 구체화 완료.
- 직전 작업: Plan AI 가 PRD 의 In Scope / Modules / Verification 에서 구체적 파일 경로를 도출하고, wiki 에서 선행 작업과 충돌 여부를 확인함.
- 재개 시 먼저 볼 것: Notes 의 mini-plan 7단계. `runtime/board-scripts/common.sh` 의 기존 헬퍼 패턴, `packages/cli/run-role.sh` 의 role-route 패턴, `.autoflow/runners/config.toml` 의 runner entry 형식.

## Notes

- Created by demoon@gomgom:90846 (Plan AI) from tickets/done/prd_022/prd_022.md at 2026-04-27T13:06:55Z.
- Plan AI refined at 2026-04-27T13:35:00Z: narrowed Allowed Paths to 12 concrete entries, enriched Title/Goal/Verification from PRD, added mini-plan and wiki context.
- Wiki context: No prior attempt or reject for a self-improvement runner. The log directory `.autoflow/logs/` already accumulates blocked/coordinator/owner logs — the new runner reads these as input. `common.sh` already has fingerprint-adjacent helpers (`display_worker_id`, reject-replan infra from tickets_008). `run-role.sh` role-route pattern is well established (see planner/ticket/todo/verifier/wiki/coordinator cases).
- Wiki context: tickets_020 (prd_020) adds `recover_passed_inprogress_ticket` — a similar pattern of scanning board state for stuck tickets. The self-improvement runner can reuse the scan approach but must not overlap scope.
- PRD scope constraints: Trial runner only. No infinite loops, no reason-free refactors, no git push, no destructive cleanup. Maximum 3h / 6 ticks. One candidate per tick max.
- Mini-plan:
  1. Create `runtime/board-scripts/start-self-improve.sh`: the core trial runner script. On each tick: scan `.autoflow/logs/`, `.autoflow/runners/logs/`, `tickets/reject/`, `tickets/inprogress/`; fingerprint repeated errors/blocks/failures; check threshold; if threshold crossed AND not duplicate of existing PRD/ticket/recent self-improve log, emit candidate; write durable tick log to `.autoflow/logs/self-improve_*.md`.
  2. Add `self-improve` role route to `packages/cli/run-role.sh` and `runtime/board-scripts/run-role.sh`: `self-improve` -> `public_role=self-improve`, `runtime_role=self-improve`, `default_runner_id=self-improve-1`, `runtime_script=start-self-improve.sh`.
  3. Add trial runner entry to `.autoflow/runners/config.toml` (disabled by default): `id=self-improve-1`, `role=self-improve`, `agent=shell`, `mode=one-shot`, `interval_seconds=1800`, `enabled=false`, plus custom keys `max_duration_seconds=10800`, `max_ticks=6`.
  4. Add scaffold default to `scaffold/board/runners/config.toml` if it exists.
  5. Mirror `start-self-improve.sh` to `.autoflow/scripts/start-self-improve.sh`.
  6. Create `tests/smoke/log-driven-self-improvement-smoke.sh` covering: idle (no logs), repeated-pattern detection, candidate creation, duplicate suppression, high-risk recommend-only, unsafe dirty-state skip, trial expiry.
  7. Update `bin/autoflow` CLI help text with `run self-improve` entry.
  8. Run verification: `bash -n` syntax check + smoke test.

- Runtime hydrated worktree dependency at 2026-04-27T13:45:08Z: linked apps/desktop/node_modules -> /Users/demoon/Documents/project/autoflow/apps/desktop/node_modules
- Runtime hydrated worktree dependency at 2026-04-27T13:45:08Z: linked node_modules -> /Users/demoon/Documents/project/autoflow/node_modules
- AI 019dcf2f-4ac4-7672-861d-206083f3e4ec prepared todo at 2026-04-27T13:45:08Z; worktree=/Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_022; run=tickets/inprogress/verify_022.md
- Owner wiki pass at 2026-04-27T13:46:27Z: `./bin/autoflow wiki query /Users/demoon/Documents/project/autoflow .autoflow --term "self-improvement runner" --term "log fingerprints" --term "run-role" --term "tickets_022" --limit 8 --synth` found the current PRD/handoff plus tickets/done/prd_012/prd_012.md, which reinforces keeping established role-to-runtime mapping patterns stable.
- Owner implementation plan at 2026-04-27T13:46:27Z: implement a conservative one-shot shell runner, record every tick under `.autoflow/logs/self-improve_*.md`, persist fingerprint counters under `.autoflow/logs/self-improve-state/`, create low-risk PRDs only after threshold and duplicate checks, log high-risk findings as `recommend_only`, and skip mutations when git or active board state is unsafe.
- Owner implementation completed at 2026-04-27T13:57:12Z: added the self-improve runtime and board mirror, role routing, disabled runner config entries, CLI help, and smoke coverage for idle, candidate creation, duplicate suppression, high-risk recommend-only, unsafe dirty skip, expiry, and CLI route execution.
- Ticket owner verification passed by 019dcf2f-4ac4-7672-861d-206083f3e4ec at 2026-04-27T13:55:43Z: command exited 0
- Ticket owner verification passed by 019dcf2f-4ac4-7672-861d-206083f3e4ec at 2026-04-27T13:57:12Z: command exited 0
- Allowed path was not present in worktree during merge preparation at 2026-04-27T13:58:08Z, so it was skipped: runtime/board-scripts/start-self-improve.sh (new — trial runner runtime script)
- Allowed path was not present in worktree during merge preparation at 2026-04-27T13:58:08Z, so it was skipped: runtime/board-scripts/common.sh (add fingerprint/dedup helpers if needed)
- Allowed path was not present in worktree during merge preparation at 2026-04-27T13:58:08Z, so it was skipped: .autoflow/scripts/start-self-improve.sh (mirror of runtime script)
- Allowed path was not present in worktree during merge preparation at 2026-04-27T13:58:08Z, so it was skipped: .autoflow/scripts/common.sh (mirror)
- Allowed path was not present in worktree during merge preparation at 2026-04-27T13:58:08Z, so it was skipped: packages/cli/run-role.sh (add self-improve role route)
- Allowed path was not present in worktree during merge preparation at 2026-04-27T13:58:08Z, so it was skipped: packages/cli/run-role.sh (runtime copy)
- Allowed path was not present in worktree during merge preparation at 2026-04-27T13:58:08Z, so it was skipped: runtime/board-scripts/run-role.sh (add self-improve role route)
- Allowed path was not present in worktree during merge preparation at 2026-04-27T13:58:08Z, so it was skipped: .autoflow/runners/config.toml (add trial runner entry, disabled by default)
- Allowed path was not present in worktree during merge preparation at 2026-04-27T13:58:08Z, so it was skipped: .autoflow/logs/ (durable tick logs: self-improve_*.md)
- Allowed path was not present in worktree during merge preparation at 2026-04-27T13:58:08Z, so it was skipped: scaffold/board/runners/config.toml (scaffold default for new boards)
- Allowed path was not present in worktree during merge preparation at 2026-04-27T13:58:08Z, so it was skipped: tests/smoke/log-driven-self-improvement-smoke.sh (new smoke test)
- Allowed path was not present in worktree during merge preparation at 2026-04-27T13:58:08Z, so it was skipped: bin/autoflow (CLI help text — add run self-improve entry)
- No staged code changes found in worktree during merge preparation at 2026-04-27T13:58:08Z.
- Impl AI 019dcf2f-4ac4-7672-861d-206083f3e4ec marked verification pass at 2026-04-27T13:58:08Z and triggered inline merge.
- Coordinator 019dcf2f-4ac4-7672-861d-206083f3e4ec finalized this verified ticket at 2026-04-27T13:58:08Z.
- Coordinator post-merge cleanup at 2026-04-27T13:58:08Z: removed_worktree=/Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_022 deleted_branch=autoflow/tickets_022.
## Verification
- Run file: `tickets/done/prd_022/verify_022.md`
- Log file: `logs/verifier_022_20260427_135808Z_pass.md`
- Result: passed

## Result

- Summary: self-improvement trial runner implemented and verified
- Remaining risk: New board init copies the disabled scaffold runner config; the smoke test provisions the new runtime script into temp boards because package script manifest changes were outside this ticket's Allowed Paths.
