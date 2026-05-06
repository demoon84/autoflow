---
name: "desktop-detached-runner-reconnect-policy"
description: "desktop detached runner reconnect policy"
pattern_type: blocked_recovery
applies_to:
  module: "apps/desktop/src/main.js"
  keywords:
    - "desktop"
    - "detached"
    - "runner"
    - "reconnect"
    - "policy"
    - "apps"
    - "src"
    - "main"
    - "renderer"
    - "tsx"
    - "styles"
    - "css"
pinned: false
created_from:
  prd: "prd_184"
  ticket: "tickets_183"
created_at: "2026-05-05T23:44:22Z"
---

# desktop detached runner reconnect policy

## Trigger

- Reuse when: desktop detached runner reconnect policy
- Source ticket: `tickets/todo/tickets_183.md`

## Recommended Procedure

- With a fixture board containing enabled loop runners whose state files have alive `pid` values, desktop runner list/start logic treats those runners as reconnected/attached and does not spawn duplicate `loop-worker` processes.
- If the desktop sends `autoflow runners start <runner>` and stdout contains `status=ok` plus `result=already_running`, the renderer sees a successful running runner state and runner list cache refreshes before the next displayed status.
- A normal desktop close/Cmd+Q path preserves detached runners by default; graceful stop is called only after an explicit user-selected close policy, and that policy is visible in the renderer UI.
- A previous desktop session without a clean shutdown marker is reported as an unclean desktop exit with detached runner reattach evidence; the app does not kill, restart, or delete runner state as part of that report.
- Existing memory ceiling relaunch behavior remains separate from user close policy and still has a bounded cleanup timeout before `app.relaunch()`.

## Pitfalls

- Allowed Paths 밖으로 확장하지 말고, 추출 실패가 finalization을 막지 않게 유지한다.

## Verification Pattern

- Command: ``bash -lc 'npm --prefix apps/desktop run check && bash -n packages/cli/runners-project.sh && bash tests/smoke/desktop-detached-runner-reconnect-smoke.sh'``

## Source Evidence

- Ticket: `tickets/todo/tickets_183.md`
- PRD: `tickets/done/prd_184/prd_184.md`
