# Verification Record Template

## Meta

- Ticket ID: 047
- Project Key: prd_047
- Verifier: worker-1
- Status: pass
- Started At:
- Finished At:
- Working Root: /Users/demoon2016/Documents/project/.autoflow-worktrees/autoflow/tickets_047

- Target: tickets_047.md
- PRD Key: prd_047
## Obsidian Links
- Project Note: [[prd_047]]
- Plan Note:
- Ticket Note: [[tickets_047]]
- Verification Note: [[verify_047]]

## Criteria Checked

- [x] Done When items were checked.
- [x] Acceptance criteria were checked.
- [x] Allowed Paths were checked.
- [x] Verification command was run.

## Command
- Started At: 2026-04-29T06:45:23Z
- Finished At: 2026-04-29T06:45:23Z
- Working Root: `/Users/demoon2016/Documents/project/.autoflow-worktrees/autoflow/tickets_047`
- Command: `bash -n .autoflow/scripts/verify-ticket-owner.sh runtime/board-scripts/verify-ticket-owner.sh && rg -n "AUTOFLOW_VERIFY_PASS_OUTPUT_LINES|first|last|truncated|omitted" .autoflow/scripts/verify-ticket-owner.sh runtime/board-scripts/verify-ticket-owner.sh && rg -n "AUTOFLOW_VERIFY_OUTPUT_LINES:-200|AUTOFLOW_VERIFY_FAIL_OUTPUT_LINES" .autoflow/scripts/verify-ticket-owner.sh runtime/board-scripts/verify-ticket-owner.sh`
- Exit Code: 0

## Output
### stdout

```text
.autoflow/scripts/verify-ticket-owner.sh:119:  local max_lines total_lines first_lines last_lines omitted_lines
.autoflow/scripts/verify-ticket-owner.sh:124:    max_lines="$(positive_int_or_default "${AUTOFLOW_VERIFY_PASS_OUTPUT_LINES:-40}" "40")"
.autoflow/scripts/verify-ticket-owner.sh:132:    first_lines=$((max_lines / 2))
.autoflow/scripts/verify-ticket-owner.sh:133:    last_lines=$((max_lines - first_lines))
.autoflow/scripts/verify-ticket-owner.sh:134:    if [ "$first_lines" -lt 1 ]; then
.autoflow/scripts/verify-ticket-owner.sh:135:      first_lines=1
.autoflow/scripts/verify-ticket-owner.sh:136:      last_lines=$((max_lines - first_lines))
.autoflow/scripts/verify-ticket-owner.sh:138:    if [ "$last_lines" -lt 1 ]; then
.autoflow/scripts/verify-ticket-owner.sh:139:      last_lines=1
.autoflow/scripts/verify-ticket-owner.sh:140:      first_lines=$((max_lines - last_lines))
.autoflow/scripts/verify-ticket-owner.sh:142:    omitted_lines=$((total_lines - first_lines - last_lines))
.autoflow/scripts/verify-ticket-owner.sh:144:    head -n "$first_lines" "$file"
.autoflow/scripts/verify-ticket-owner.sh:145:    printf '[... truncated: %s lines omitted between first %s and last %s lines ...]\n' "$omitted_lines" "$first_lines" "$last_lines"
.autoflow/scripts/verify-ticket-owner.sh:146:    tail -n "$last_lines" "$file"
runtime/board-scripts/verify-ticket-owner.sh:119:  local max_lines total_lines first_lines last_lines omitted_lines
runtime/board-scripts/verify-ticket-owner.sh:124:    max_lines="$(positive_int_or_default "${AUTOFLOW_VERIFY_PASS_OUTPUT_LINES:-40}" "40")"
runtime/board-scripts/verify-ticket-owner.sh:132:    first_lines=$((max_lines / 2))
runtime/board-scripts/verify-ticket-owner.sh:133:    last_lines=$((max_lines - first_lines))
runtime/board-scripts/verify-ticket-owner.sh:134:    if [ "$first_lines" -lt 1 ]; then
runtime/board-scripts/verify-ticket-owner.sh:135:      first_lines=1
runtime/board-scripts/verify-ticket-owner.sh:136:      last_lines=$((max_lines - first_lines))
runtime/board-scripts/verify-ticket-owner.sh:138:    if [ "$last_lines" -lt 1 ]; then
runtime/board-scripts/verify-ticket-owner.sh:139:      last_lines=1
runtime/board-scripts/verify-ticket-owner.sh:140:      first_lines=$((max_lines - last_lines))
runtime/board-scripts/verify-ticket-owner.sh:142:    omitted_lines=$((total_lines - first_lines - last_lines))
runtime/board-scripts/verify-ticket-owner.sh:144:    head -n "$first_lines" "$file"
runtime/board-scripts/verify-ticket-owner.sh:145:    printf '[... truncated: %s lines omitted between first %s and last %s lines ...]\n' "$omitted_lines" "$first_lines" "$last_lines"
runtime/board-scripts/verify-ticket-owner.sh:146:    tail -n "$last_lines" "$file"
runtime/board-scripts/verify-ticket-owner.sh:148:    tail -n "$(positive_int_or_default "${AUTOFLOW_VERIFY_FAIL_OUTPUT_LINES:-${AUTOFLOW_VERIFY_OUTPUT_LINES:-200}}" "200")" "$file"
.autoflow/scripts/verify-ticket-owner.sh:148:    tail -n "$(positive_int_or_default "${AUTOFLOW_VERIFY_FAIL_OUTPUT_LINES:-${AUTOFLOW_VERIFY_OUTPUT_LINES:-200}}" "200")" "$file"
```

### stderr

```text

```

## Evidence
- Result: passed
- Exit Code: 0
- Completed At: 2026-04-29T06:45:23Z
- Functional truncation sample: pass command with 80 stdout lines and 70 stderr lines recorded first/last excerpts plus explicit omitted-line markers in both `### stdout` and `### stderr`.
- Post-merge verification: same PRD command passed from PROJECT_ROOT after manually applying the verified Allowed Path changes.

## Findings
- blocker:
- warning:

## Blockers

- Blocker:

## Next Fix Hint
- If failed, fix in the same ticket-owner loop when inside scope; otherwise finish with `scripts/finish-ticket-owner.sh 047 fail "<reason>"`.

## Result

- Verdict: pass
- Summary: Worktree and PROJECT_ROOT verification passed; output sections remain present and successful over-cap streams are compacted with explicit truncation markers.

## Checks
- [x] PRD reference confirmed
- [x] allowed paths respected by ticket scope
- [x] implementation completed or intentionally unchanged
- [x] automated verification passed
