---
name: "runner-live-log-finalize-cleanup-3"
description: "runner live log finalize cleanup"
pattern_type: orchestration_cleanup
applies_to:
  module: "packages/cli/run-role.sh"
  keywords:
    - "runner"
    - "live"
    - "log"
    - "finalize"
    - "cleanup"
    - "packages"
    - "cli"
    - "run"
    - "role"
    - "runtime"
    - "board"
    - "scripts"
pinned: false
created_from:
  prd: "prd_182"
  ticket: "tickets_181"
created_at: "2026-05-05T23:04:52Z"
---

# runner live log finalize cleanup

## Trigger

- Reuse when: runner live log finalize cleanup
- Source ticket: `tickets/inprogress/tickets_181.md`

## Recommended Procedure

- fake adapter 정상 종료 fixture에서 adapter 실행 중에는 `_live_stdout.log`가 관찰되고, adapter 종료 후 해당 invocation의 `*_live_stdout.log` / `*_live_stderr.log`가 남지 않는다.
- fake adapter non-zero 종료와 timeout exit `124` fixture에서도 완료된 `*_live_stdout.log` / `*_live_stderr.log`가 남지 않고, runner state/log에는 기존 result 계약과 cleanup evidence가 남는다.
- active-running fixture(`active_stage=adapter_running`, current `last_stdout_log` 또는 `last_stderr_log`, 최근 mtime)는 stale janitor가 삭제하거나 rename하지 않는다.
- stale janitor는 runner state가 가리키지 않고 active loop PID도 없는 오래된 `_live_stdout.log` / `_live_stderr.log`만 정리하며, `cleaned_count=` 또는 동등한 key=value evidence를 출력한다.
- 현재 보드에서 active live file을 제외한 stale `*_live_stdout.log` 수가 정리 전보다 감소하거나, 감소하지 않는 경우 각 파일의 보존 사유가 verification evidence에 기록된다.

## Pitfalls

- None known after PROJECT_ROOT verification; finalizer bookkeeping remains.

## Verification Pattern

- Command: ``bash -lc 'bash -n packages/cli/run-role.sh runtime/board-scripts/run-role.sh packages/cli/runners-project.sh runtime/board-scripts/runners-project.sh packages/cli/cleanup-runner-logs.sh && bash tests/smoke/runner-live-log-finalize-smoke.sh && tmp="$(mktemp)"; awk "/^run_with_timeout\\(\\)/,/^}/ { print }" packages/cli/run-role.sh > "$tmp"; . "$tmp"; rm -f "$tmp"; output="$(printf "data\\n" | run_with_timeout 5 1 cat -)"; [ "$output" = data ]; set +e; run_with_timeout 1 1 bash -c "sleep 5"; rc=$?; set -e; [ "$rc" -eq 124 ]; npm run desktop:check'``

## Source Evidence

- Ticket: `tickets/inprogress/tickets_181.md`
- PRD: `tickets/done/prd_182/prd_182.md`
- Verification: `tickets/inprogress/verify_181.md`
- Result summary: runner live log finalize cleanup
