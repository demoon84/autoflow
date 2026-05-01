# Verification Record Template

## Meta

- Ticket ID: 086
- Project Key: prd_NNN
- Verifier:
- Status: pass
- Started At:
- Finished At:
- Working Root: /Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_086

- Target: tickets_086.md
- PRD Key: prd_088
## Reference Notes
- Project Note: [[prd_088]]
- Plan Note:
- Ticket Note: [[tickets_086]]
- Verification Note: [[verify_086]]

## Criteria Checked

- [ ] Done When items were checked.
- [ ] Acceptance criteria were checked.
- [ ] Allowed Paths were checked.
- [ ] Verification command was run.

## Command
- Started At: 2026-05-01T19:40:18Z
- Finished At: 2026-05-01T19:40:37Z
- Working Root: `/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_086`
- Command: `cd /Users/demoon2016/Documents/project/autoflow && rg -n "Done When|\[x\]|\[ \]" .autoflow/agents .autoflow/reference runtime/board-scripts .autoflow/scripts && bash tests/smoke/ticket-owner-smoke.sh`
- Exit Code: 0

## Output
### stdout

```text
.autoflow/agents/todo-queue-agent.md:48:6. When `Done When` appears satisfied, update the ticket summary.
.autoflow/reference/plan-template.md:41:- [ ] 실행 가능한 후보 작업 1
.autoflow/reference/plan-template.md:42:- [ ] 실행 가능한 후보 작업 2
.autoflow/reference/plan-template.md:43:- [ ] 실행 가능한 후보 작업 3
.autoflow/agents/verifier-agent.md:35:2. Use the PRD acceptance criteria and ticket `Done When` as primary criteria.
.autoflow/agents/verifier-agent.md:65:- every `Done When` item is satisfied,
.autoflow/scripts/handoff-todo.sh:112:- Next reader: verifier should review Done When, Verification command, Notes, and the ticket worktree."
runtime/board-scripts/handoff-todo.sh:112:- Next reader: verifier should review Done When, Verification command, Notes, and the ticket worktree."
.autoflow/reference/tickets-board.md:65:  - Requires clear `Goal`, `References`, `Allowed Paths`, and `Done When`.
.autoflow/reference/tickets-board.md:138:- `Goal`, `References`, `Allowed Paths`, `Done When`
runtime/board-scripts/start-plan.sh:268:  [ -n "$done_when" ] || done_when="- [ ] Implementation stays inside Allowed Paths
runtime/board-scripts/start-plan.sh:269:- [ ] Verification evidence is recorded before done/reject"
runtime/board-scripts/start-plan.sh:340:## Done When
runtime/board-scripts/start-plan.sh:346:- 다음에 바로 이어서 할 일: Plan AI 가 Allowed Paths 와 Done When 을 PRD 기준으로 더 좁힌다. Impl AI 는 이 티켓을 todo 에서 claim 한 뒤 mini-plan, 구현, 검증, 머지까지 한 턴에 끝낸다.
runtime/board-scripts/start-plan.sh:352:- 재개 시 먼저 볼 것: PRD, Goal, Allowed Paths, Done When.
runtime/board-scripts/board-guard.sh:247:  local required_sections=("Ticket" "Goal" "Allowed Paths" "Worktree" "Goal Runtime" "Recovery State" "Done When" "Next Action" "Resume Context" "Verification" "Result")
.autoflow/scripts/run-hook.sh:204:6. Board stage is authoritative. If a ticket is in \`${BOARD_PROMPT_ROOT}/tickets/todo/\` or \`${BOARD_PROMPT_ROOT}/tickets/inprogress/\`, treat it as todo implementation work even when the Title, Goal, or Done When sounds like checking or verification.
.autoflow/scripts/run-hook.sh:205:7. If Done When is satisfied, fill Result.Summary and run \`${BOARD_PROMPT_ROOT}/scripts/handoff-todo.sh <ticket-id-or-path>\`. The handoff runtime moves the ticket to \`${BOARD_PROMPT_ROOT}/tickets/verifier/\`, marks Verification pending, and clears only the active ticket context so the todo role can continue with the next ticket.
.autoflow/scripts/start-plan.sh:268:  [ -n "$done_when" ] || done_when="- [ ] Implementation stays inside Allowed Paths
.autoflow/scripts/start-plan.sh:269:- [ ] Verification evidence is recorded before done/reject"
[... truncated: 29 lines omitted between first 20 and last 20 lines ...]
.autoflow/scripts/common.sh:1301:        sub(/^- \[ \] /, "- [x] ")
.autoflow/scripts/common.sh:1623:  done_when="$(extract_section_text "$file" "Done When" | sed '/^[[:space:]]*$/d')"
.autoflow/scripts/common.sh:1644:Done When:
.autoflow/scripts/common.sh:1657:- Map every Goal, Done When, Verification, and Allowed Paths requirement to observable evidence.
.autoflow/agents/spec-author-agent.md:80:- [ ] The user issued an explicit draft trigger before the full PRD draft(s) were rendered.
.autoflow/agents/spec-author-agent.md:81:- [ ] The full draft was shown in chat for every PRD being saved.
.autoflow/agents/spec-author-agent.md:82:- [ ] The user explicitly approved saving every PRD, either individually or with a clear save-all confirmation (separate from the draft trigger).
.autoflow/agents/spec-author-agent.md:83:- [ ] Host constraints were checked.
.autoflow/agents/spec-author-agent.md:84:- [ ] The PRD is not a duplicate, and split PRDs do not overlap scope accidentally.
.autoflow/agents/spec-author-agent.md:85:- [ ] Acceptance criteria are observable.
.autoflow/agents/spec-author-agent.md:86:- [ ] Allowed paths or module targets are concrete.
.autoflow/agents/spec-author-agent.md:87:- [ ] No plan, ticket, code, verification, commit, or push was created.
.autoflow/reference/project-spec-template.md:30:- [ ] 명령, UI 관찰, 또는 파일 검토로 확인할 수 있는 완료 조건.
.autoflow/reference/project-spec-template.md:31:- [ ] 사용자에게 보이는 동작 또는 시스템에 보이는 결과를 설명하는 완료 조건.
.autoflow/agents/plan-to-ticket-agent.md:43:- Markdown-only reads/writes under `tickets/inprogress/` only when updating `Recovery State`, `Next Action`, `Resume Context`, `Notes`, `Allowed Paths`, `Done When`, or `Verification` for recovery orchestration. Do not edit product code or worktree files.
.autoflow/agents/plan-to-ticket-agent.md:55:7. Enrich ticket `Title`, `Goal`, `Done When`, and `Verification` from the PRD and plan.
.autoflow/agents/plan-to-ticket-agent.md:73:5. If `source=memo-inbox`, read the memo and run `autoflow wiki query` with terms from its title/request. Treat the memo as an implementation directive, infer concrete narrow `Allowed Paths`, observable `Done When`, and a verification command from repository context, then write a generated PRD to `tickets/backlog/prd_NNN.md` with Korean human-readable prose, move the consumed memo to `tickets/done/<project-key>/memo_NNN.md` after the todo ticket exists, and rerun `scripts/start-plan.*` once so the generated PRD becomes a todo ticket. Do not turn memo intake into a human-question loop; only refuse ticket creation for unsafe requests.
status=ok
project_root=/var/folders/2m/1h0f_h1x6mq5mlbcf33glf0h0000gn/T/tmp.6DM53RxRUQ
commit_hash=481ca65d2737b8358626565eb0b03b058c0a5bba
```

### stderr

```text

```

## Evidence
- Result: passed
- Exit Code: 0
- Completed At: 2026-05-01T19:40:37Z

## Findings
- blocker:
- warning:

## Blockers

- Blocker:

## Next Fix Hint
- If failed, fix in the same ticket-owner loop when inside scope; otherwise finish with `scripts/finish-ticket-owner.sh 086 fail "<reason>"`.

## Result

- Verdict: pending
- Summary:

## Checks
- [x] PRD reference confirmed
- [x] allowed paths respected by ticket scope
- [x] implementation completed or intentionally unchanged
- [x] automated verification passed
