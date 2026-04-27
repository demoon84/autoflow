# Auto-Resume Recovery

## Overview
The Auto-Resume Recovery feature provides self-healing for tickets that become stuck in the `inprogress` stage. Specifically, it addresses the failure mode where a ticket has successfully passed verification (`Result: passed`) but the runner was interrupted before it could commit the changes and trigger the finish-pass.

## Behavior
- **Detection**: The `ticket-owner` runtime checks for any ticket markdown files in the in-progress directory that have `Result: passed` but no corresponding commit or merge.
- **Diagnostics**: `bin/autoflow doctor` reports `check.passed_inprogress_recovery_pending=warning` if such tickets exist, and `ok` otherwise.
- **Recovery**: On the next tick, the runner automatically resumes the finish-pass for the stuck ticket. It commits the worktree changes and completes the inline merge flow, moving the ticket to the `done/` directory.
- **Logging**: A `source=auto_resumed_finish_pass` key is emitted in the logs and is visible in the desktop progress card as `last_result`.
- **Safety**: Tickets with other statuses (e.g., `pending`, `failed`, or `blocked`) are ignored by this recovery branch and follow their normal flow.

## Origins
- **Issue**: Tickets like `tickets_012` and `tickets_015` were reported as stuck with `Result: passed` without finishing.
- **Resolution**: Implemented via `tickets_020` to ensure robust progression through the final verification and merge steps without manual intervention.