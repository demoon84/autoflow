---
name: "worktree-bound-runner-loop-orphan-cleanup"
description: "worktree-bound runner loop orphan cleanup"
pattern_type: ticket_completion
applies_to:
  module: "packages/cli/runners-project.sh"
  keywords:
    - "worktree"
    - "bound"
    - "runner"
    - "loop"
    - "orphan"
    - "cleanup"
    - "packages"
    - "cli"
    - "runners"
    - "project"
    - "runtime"
    - "board"
pinned: false
created_from:
  prd: "prd_186"
  ticket: "tickets_185"
created_at: "2026-05-06T00:46:30Z"
---

# worktree-bound runner loop orphan cleanup

## Trigger

- Reuse when: worktree-bound runner loop orphan cleanup
- Source ticket: `tickets/done/prd_186/tickets_185.md`

## Recommended Procedure

- `cleanup_completed_ticket_worktree` 또는 같은 완료 cleanup 경로가 `git worktree remove --force <ticket-worktree>` 호출 전에 `<ticket-worktree>` 경로를 command/cwd/script path 로 참조하는 fixture process tree 에 SIGTERM 후 필요 시 SIGKILL 을 보내고, cleanup 뒤 해당 fixture process count 가 `0` 이다.
- stale todo worktree cleanup 경로가 이미 merged 된 stale worktree를 제거하기 전에 같은 worktree 경로를 참조하는 fixture process tree 를 정리하고, cleanup 뒤 해당 fixture process count 가 `0` 이다.
- `loop-worker`는 `SCRIPT_DIR/run-role.sh` 또는 `runtime_scripts_root/runner-common.sh`가 사라진 fixture 상황에서 다음 tick을 무한 반복하지 않고 `last_result=loop_runtime_missing` 또는 동등한 key=value evidence 를 남긴 뒤 exit code `0` 으로 종료한다.
- 완료 cleanup / stale cleanup 이 정리 대상으로 삼는 process 는 ticket worktree path prefix 와 매칭되는 fixture process 로 제한되며, host project root 또는 다른 ticket worktree path 를 참조하는 fixture process 는 종료하지 않는다.
- cleanup helper 는 같은 worktree path 를 command/cwd 로 참조하더라도 현재 finalizer/adapter 의 self/ancestor process chain 은 종료하지 않는다.

## Pitfalls

- Low; process matching is limited to absolute worktree path prefix via command/cwd and the smoke verifies sibling worktree processes survive.

## Verification Pattern

- Command: ``bash -lc 'bash -n packages/cli/runners-project.sh runtime/board-scripts/runners-project.sh runtime/board-scripts/merge-ready-ticket.sh .autoflow/scripts/merge-ready-ticket.sh runtime/board-scripts/common.sh .autoflow/scripts/common.sh tests/smoke/runner-worktree-orphan-cleanup-smoke.sh && diff -q runtime/board-scripts/merge-ready-ticket.sh .autoflow/scripts/merge-ready-ticket.sh && diff -q runtime/board-scripts/common.sh .autoflow/scripts/common.sh && bash tests/smoke/runner-worktree-orphan-cleanup-smoke.sh'``

## Source Evidence

- Ticket: `tickets/done/prd_186/tickets_185.md`
- PRD: `tickets/done/prd_186/prd_186.md`
- Verification: `tickets/done/prd_186/verify_185.md`
- Result summary: worktree-bound runner loop orphan cleanup
