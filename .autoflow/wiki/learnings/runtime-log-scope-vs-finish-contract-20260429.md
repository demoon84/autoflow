# Runtime-Log Scope vs Finish Contract (2026-04-29)

## Overview

`prd_049` successfully moved low-value runtime bookkeeping out of AI-facing `## Notes` and into a capped `## Runtime Log`, but the ticket still failed because the required smoke depended on an out-of-scope `finish-ticket-owner.sh` pass-output contract.

## Lesson

- Prompt-hygiene changes in runtime helpers can still be blocked by downstream smoke expectations that validate finalizer output shape.
- When a ticket changes runtime note/log behavior, verify whether the declared smoke also depends on `finish-ticket-owner.sh`, `verify-ticket-owner.sh`, or their installed board copies before freezing `Allowed Paths`.
- If the failure is outside the current ticket scope, preserve the implemented learning and replan with the missing contract path instead of broadening the wiki claim to "done".

## Reusable Guidance

- Treat output-shape contracts as part of runtime surface area, not just implementation detail.
- For note/log compaction work, inspect both the source runtime script and the installed `.autoflow/scripts/` mirror plus any smoke assertions that read their stdout.
- Keep partial wins queryable in the wiki even when the board stage is reject, but cite the reject evidence explicitly so future planning does not mistake the learning for completed feature delivery.

## Sources

- Verification evidence: `tickets/reject/verify_049.md`
- Failure log: `logs/verifier_049_20260429_070409Z_fail.md`
- Related completed constraint: `wiki/features/finish-pass-inline-merge-summary.md`
