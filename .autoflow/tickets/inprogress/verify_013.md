# Verification Record Template

## Meta

- Ticket ID: 013
- Project Key: project_NNN
- Verifier:
- Status: pass
- Started At: 2026-04-27T07:34:31Z
- Finished At: 2026-04-27T07:34:48Z
- Working Root: /mnt/d/lab/.autoflow-worktrees/autoflow/tickets_013

- Target: tickets_013.md
- PRD Key: prd_windows_validation
## Obsidian Links
- Project Note: [[prd_windows_validation]]
- Plan Note:
- Ticket Note: [[tickets_013]]
- Verification Note: [[verify_013]]

## Criteria Checked

- [x] Done When items were checked.
- [x] Acceptance criteria were checked.
- [x] Allowed Paths were checked.
- [x] Verification command was run.

## Command

- Command: `./bin/autoflow.ps1 status D:\lab\autoflow .autoflow; ./bin/autoflow.ps1 doctor D:\lab\autoflow .autoflow; ./bin/autoflow.ps1 metrics D:\lab\autoflow .autoflow; ./bin/autoflow.ps1 run ticket D:\lab\autoflow .autoflow --runner owner-3 --dry-run`
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
- Observations: Status, doctor, metrics, and owner-3 dry-run all completed from Windows PowerShell. The dry-run emitted a Gemini adapter prompt. Doctor still reports expected warnings for claude-backed owner-1/owner-2 not being on PATH.

## Findings

- Finding:

## Blockers

- Blocker:

## Next Fix Hint

- Hint:

## Result

- Verdict: pass
- Summary: Core Windows CLI baseline is responsive and app-visible tickets are present.
