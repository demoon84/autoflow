# Verification Record Template

## Meta

- Ticket ID: 012
- Project Key: project_NNN
- Verifier:
- Status: superseded
- Started At:
- Finished At:
- Working Root: /Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_012

- Target: tickets_012.md
- PRD Key: prd_012
## Obsidian Links
- Project Note: [[prd_012]]
- Plan Note:
- Ticket Note: [[tickets_012]]
- Verification Note: [[verify_012]]

## Criteria Checked

- [x] Done When items were checked.
- [x] Acceptance criteria were checked.
- [x] Allowed Paths were checked.
- [x] Verification command was run.

## Command

- Command: `sed -n '1,80p' .autoflow/runners/config.toml && sed -n '1,80p' .autoflow/automations/heartbeat-set.toml`
- Exit Code: 0

## Output

### stdout

```text

```

### stderr

```text

```

## Evidence

- Result: superseded
- Observations: Current `main` intentionally keeps `planner-1`, `owner-1`, and `wiki-1`; applying the stale dirty worktree rename would conflict with current AGENTS and active runner config.

## Findings

- Finding:

## Blockers

- Blocker:

## Next Fix Hint

- Hint:

## Result

- Verdict: superseded
- Summary: Worktree resolved by preserving current topology rather than applying stale runner id rename.
