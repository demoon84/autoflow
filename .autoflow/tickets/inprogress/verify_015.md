# Verification Record Template

## Meta

- Ticket ID: 015
- Project Key: project_NNN
- Verifier:
- Status: pass
- Started At: 2026-04-27T07:34:49Z
- Finished At: 2026-04-27T07:35:20Z
- Working Root: /mnt/d/lab/.autoflow-worktrees/autoflow/tickets_015

- Target: tickets_015.md
- PRD Key: prd_windows_validation
## Obsidian Links
- Project Note: [[prd_windows_validation]]
- Plan Note:
- Ticket Note: [[tickets_015]]
- Verification Note: [[verify_015]]

## Criteria Checked

- [x] Done When items were checked.
- [x] Acceptance criteria were checked.
- [x] Allowed Paths were checked.
- [x] Verification command was run.

## Command

- Command: `bash tests/smoke/ticket-owner-adapter-worktree-cwd-smoke.sh; bash tests/smoke/doctor-blocked-ticket-smoke.sh; bash tests/smoke/ticket-owner-reject-replan-same-loop-smoke.sh; bash tests/smoke/coordinator-wiki-self-runner-skip-smoke.sh`
- Exit Code: 0

## Output

### stdout

```text

```

### stderr

```text

```

## Evidence

- Result: passed
- Observations: All four Windows-relevant smoke scripts returned `status=ok` with temporary project roots.

## Findings

- Finding:

## Blockers

- Blocker:

## Next Fix Hint

- Hint:

## Result

- Verdict: pass
- Summary: Regression smoke set covering adapter worktree CWD, doctor blocked-ticket behavior, reject same-loop replan, and coordinator wiki skip passed.
