# Runtime Script TypeScript Migration Inventory

## Current State

- `thin-wrapper + companion`:
  `start-ticket-owner.sh -> .js + .legacy.sh`,
  `finish-ticket-owner.sh -> .js + .legacy.sh`,
  `handoff-todo.sh -> .js + .legacy.sh`,
  `merge-ready-ticket.sh -> .ts + .js + .legacy.sh`,
  `start-plan.sh -> .ts + .legacy.sh`
- `reporting wrapper + companion`:
  `runner-stage.js -> runner-stage.ts`,
  `runner-wake.js -> runner-wake.ts`,
  `runner-tokens.js -> runner-tokens.ts`
- `shell-only runtime`:
  `common.sh`, `runner-common.sh`, `check-stop.sh`,
  `file-watch-common.sh`, `install-stop-hook.sh`, `run-hook.sh`,
  `set-thread-context.sh`, `clear-thread-context.sh`, `verify-ticket-owner.sh`,
  `update-wiki.sh`, `start-todo.sh`, `start-spec.sh`,
  `watch-board.sh`, `run-role.sh`, `runners-project.sh`,
  `start-self-improve.sh`, `wiki-project.sh`

## Packaging Guardrails

- `packages/cli/package-board-common.sh` must install wrapper siblings together.
- `packages/cli/doctor-project.sh` must fail when an installed board is missing a required companion.
- `tests/smoke/runtime-script-companion-smoke.sh` is the regression check for init + doctor coverage.

## Follow-Up Order

1. 작은 보조 스크립트:
   `runner-stage`, `runner-wake`, `runner-tokens`, `path-conflict-check`, `lint-ticket`
2. planner 경로:
   `start-plan`, planner helper scripts, prompt/file inventory around plan generation
3. ticket-owner / finalizer 경로:
   `start-ticket-owner`, `finish-ticket-owner`, `merge-ready-ticket`, `handoff-todo`
4. `packages/cli` 대형 shell:
   `doctor-project.sh`, `run-role.sh`, `runners-project.sh`, `coordinator-project.sh`

## Notes

- `verify-ticket-owner.sh`는 아직 shell-only지만 finalizer/owner 경로와 강하게 결합돼 있으므로 3단계 묶음으로 보는 편이 안전하다.
- `run-role.sh`, `runners-project.sh`, `wiki-project.sh`는 크기가 커서 초기 전환 대상으로 두지 않는다.
