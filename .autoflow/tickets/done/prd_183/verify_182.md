# Verification Record Template

## Meta

- Ticket ID: 182
- Project Key: prd_NNN
- Verifier:
- Status: pass
- Started At:
- Finished At:
- Working Root: /Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_182

- Target: tickets_182.md
- PRD Key: prd_183
## Reference Notes
- Project Note: [[prd_183]]
- Plan Note:
- Ticket Note: [[tickets_182]]
- Verification Note: [[verify_182]]

## Criteria Checked

- [x] Done When items were checked and reflected in the ticket `## Done When` checklist state.
- [x] Acceptance criteria were checked.
- [x] Allowed Paths were checked.
- [x] Verification command was run.

## Command
- Started At: 2026-05-05T23:36:20Z
- Finished At: 2026-05-05T23:37:12Z
- Working Root: `/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_182`
- Command: `bash -lc 'bash -n packages/cli/run-role.sh runtime/board-scripts/run-role.sh packages/cli/wiki-project.sh .autoflow/scripts/update-wiki.sh && bash tests/smoke/wiki-meaningful-commit-gate-smoke.sh && bash tests/smoke/wiki-ai-owned-update-smoke.sh && bash tests/smoke/planner-wiki-scoped-autocommit-smoke.sh'`
- Exit Code: 0

## Output
### stdout

```text
status=ok
status=ok
project_root=/var/folders/2m/1h0f_h1x6mq5mlbcf33glf0h0000gn/T/tmp.4ZomEHFFzl
status=ok
project_root=/var/folders/2m/1h0f_h1x6mq5mlbcf33glf0h0000gn/T/tmp.xLdAjBh5Yg
```

### stderr

```text

```

## Evidence
- Result: passed
- Exit Code: 0
- Completed At: 2026-05-05T23:37:12Z

## Findings
- blocker:
- warning:

## Blockers

- Blocker:

## Next Fix Hint
- If failed, fix in the same ticket-owner loop when inside scope; otherwise finish with `scripts/finish-ticket-owner.sh 182 fail "<reason>"`.

## Result

- Verdict: pass
- Summary: Worktree verification command exited 0 and covers syntax checks plus wiki meaningful commit gate, AI-owned unchanged, and planner/wiki scoped autocommit smoke tests.

## Checks
- [x] PRD reference confirmed
- [x] allowed paths respected by ticket scope
- [x] implementation completed or intentionally unchanged
- [x] automated verification passed
