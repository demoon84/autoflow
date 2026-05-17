# Todo Template

Use this for `tickets/todo/Todo-NNN.md` files emitted by the planner runner.

Todo tickets are implementation contracts. They must have concrete `Allowed
Paths`, a non-empty `## Done When` checklist, and verification instructions.

```md
# Todo-NNN: <title>

## Ticket

- ID: Todo-NNN
- PRD Key: prd_NNN
- Plan Candidate:
- Title: <title>
- Priority: normal
- Change Type: code
- Stage: todo
- AI: planner
- Claimed By:
- Execution AI:
- Verifier Runner:
- Last Updated:

## Goal

- <one concrete implementation goal>

## References

- PRD: tickets/prd/prd_NNN.md
- Order: tickets/order/order_NNN.md
- Related: <optional done/wiki references>

## Reference Notes

- Project Note: <why this ticket exists>
- Plan Note: <scope narrowing or sequencing note>
- Ticket Note: <worker-facing caution>

## Allowed Paths

- path/to/file-or-folder

## Worktree

- Branch:
- Path:
- Base:
- Created At:

## Goal Runtime

- Status:
- Started At:
- Started Epoch:
- Updated At:
- Tick Count: 0
- Token Budget:
- Tokens Used:
- Continuation Suppressed: false
- Last Event:
- Last Progress Fingerprint:
- Iteration Fingerprints: []
- Last Lint Status:
- Last Lint Vagueness Score:

## Recovery State

- Status: healthy
- Detected By:
- Failure Class:
- Evidence:
- Planner Decision:
- Worker Resume Instruction:
- Last Recovery At:

## Done When

- [ ] <observable implementation result>
- [ ] <verification or evidence result>
- [ ] <regression/reset/error behavior that must still hold>

## Next Action

- <the next concrete worker action>

## Resume Context

- Current state: <current state>
- Last completed action: <last completed action>
- First thing to inspect on resume: <first file, command, or ticket section>

## Notes

- Mini-plan: <short worker plan>
- Progress: <progress/evidence notes>

## Verification

- Command: npm run test
- Run file:
- Result:

## Result

- Summary:
- Commit:
```

## Notes

- `Done When` belongs here and in PRDs, not in ordinary orders.
- Every checked item must be backed by implementation diff, verification output,
  deterministic evidence, or a clear manual observation note.
