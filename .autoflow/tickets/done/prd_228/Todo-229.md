# Ticket

## Ticket

- ID: Todo-229
- PRD Key: prd_228
- Plan Candidate: Plan AI handoff from tickets/done/prd_228/prd_228.md
- Title: claude 어댑터 stream-json 전환 + LiveTerminalView 실시간 AI 신호
- Priority: high
- Change Type: code
- Stage: done
- AI: worker
- Claimed By: worker
- Execution AI: worker
- Verifier AI:
- Last Updated: 2026-05-09T11:14:00Z

## Goal

- 이번 작업의 목표: 현재 claude `-p --output-format text` 호출은 tick 이 끝날 때까지 stdout 을 buffer 해서 `*_live_stdout.log` 가 0 byte 로 머물고, LiveTerminalView 는 `<runner>.log` 의 event metadata (`adapter_start`, `loop_tick`) 만 1초 폴링으로 보여 사용자에게 "AI 가 일하고 있다" 는 신호가 사라진다. 이를 `--output-format stream-json --include-partial-messages` 로 전환해 partial message / tool_use / message_delta 가 JSONL 한 줄씩 즉시 stdout 으로 흐르게 만들고, post-processor 는 마지막 `result` 이벤트의 `result` 필드를 `*_last_message.txt` 에 기록하며, LiveTerminalView 는 persistent `<runner>.log` + active `live_stdout.log` 두 stream 을 merge 해 JSONL 을 사람이 읽는 한 줄로 변환해 보여준다. 회귀 가드: token usage 추출, sanity gate, output truncation marker, legacy text 모드 fallback 모두 보존.

## References

- PRD: tickets/done/prd_228/prd_228.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_228]]
- Plan Note:
- Ticket Note: [[Todo-229]]

## Allowed Paths

- `packages/cli/run-role.sh`
- `runtime/board-scripts/run-role.sh`
- `packages/cli/wiki-project.sh`
- `packages/cli/runners-project.sh`
- `runtime/board-scripts/runners-project.sh`
- `apps/desktop/src/renderer/main.tsx`
- `apps/desktop/src/main.js`
- `AGENTS.md`

## Worktree
- Path: `/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_229`
- Branch: autoflow/tickets_229
- Base Commit: 295b891b83874db906e9423a0a620328177e7d77
- Worktree Commit: 81e3f1c5046a9ead3d5ce20705ee95faf6e588bd
- Integration Status: no_code_changes

## Goal Runtime
- Status: complete
- Started At: 2026-05-09T10:55:51Z
- Started Epoch: 1778324151
- Updated At: 2026-05-09T11:14:01Z
- Tick Count: 9
- Time Used Seconds: 1090
- Token Budget: 
- Tokens Used: 
- Continuation Suppressed: false
- Last Event: complete
- Last Progress Fingerprint: 3008026835

## Recovery State

- Status: healthy
- Detected By:
- Failure Class:
- Evidence:
- Planner Decision:
- Owner Resume Instruction:
- Last Recovery At:

## Done When

- [x] Implementation stays inside Allowed Paths
- [x] Verification evidence is recorded before done/reject

## Next Action
- Complete: the inline merge finalizer integrated the AI-merged ticket, archived evidence, and prepared the local completion commit.

## Resume Context

- 현재 상태 요약: claude stream-json 기본 호출, result 추출 fallback, LiveTerminalView JSONL 요약 merge, stream-json token usage 우선 파싱, 문서/preview sync 변경이 worktree 와 PROJECT_ROOT 에 반영됐다.
- 직전 작업: worktree 및 PROJECT_ROOT 에서 shell syntax check 와 `apps/desktop npm run check` 를 모두 실행해 exit 0 을 확인했다.
- 재개 시 먼저 볼 것: `finish-ticket-owner.sh pass` 결과. pass finalizer 가 실패하면 아래 Verification evidence 와 diff/status 를 기준으로 AI-led merge 상태를 다시 점검한다.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_228/prd_228.md at 2026-05-09T10:50:50Z.
- Mini-plan (worker, 2026-05-09T11:15Z):
  1. Wiki context pass completed from project root with `autoflow wiki query --rag`: related done work is `tickets/done/prd_126/*` for JSON/stream token usage extraction, `tickets/done/prd_182/*` for `_live_stdout.log` active visibility/final cleanup contracts, and `tickets/done/prd_189/*` for raw stdout noise filtering. These constrain this ticket to preserve fallback token parsing, not persist completed `_stdout.log` artifacts, and keep raw adapter transcripts out of general file pickers.
  2. Finish the partially present claude stream-json adapter changes in `run-role.sh` / synced runtime scripts, then add renderer-side `LiveTerminalView` merging of persistent `<runner>.log` plus active `*_live_stdout.log`.
  3. Add JSONL-to-one-line summaries for `system/init`, text, `tool_use`, `tool_result`, `message_delta`, and `result/success` so raw JSON is not exposed in the terminal view.
  4. Run desktop check from `apps/desktop`, inspect output, manually copy verified changes to PROJECT_ROOT, rerun verification there, then finalize with pass if all criteria and Allowed Paths audit pass.
- vibe-terminal 패턴 인용 (PRD Notes 의 Phase 2 / 패턴 비교 섹션 참고): LiveTerminalView 의 xterm 옵션 (`scrollback: 50000`, `lineHeight: 1.2`, debounce 50ms RAF flush, theme `#2d323b`) 은 이미 vibe `renderer.js:5389~5413` 와 1:1 매칭. 본 ticket 은 데이터 소스 한 군데 (text → stream-json) 만 바꾼다.
- 사전 검증 (이미 확인): `script -q /dev/null claude -p --output-format text "..."` 는 PTY 안에서도 buffer (스트리밍 X). `claude -p --output-format stream-json --include-partial-messages "..."` 는 `content_block_delta` 가 즉시 흘러옴. fallback 정책 (`AUTOFLOW_CLAUDE_STREAM=0` 또는 CLI 미지원) 도 함께 구현.
- 구현 완료 (worker, 2026-05-09T11:10Z):
  - `packages/cli/run-role.sh` / `runtime/board-scripts/run-role.sh`: `claude --help` stream-json 감지 + `AUTOFLOW_CLAUDE_STREAM=0` rollback, 기본 `--output-format stream-json --include-partial-messages --verbose`, final `result` / assistant text / raw stdout 순서의 `*_last_message.txt` fallback 추출을 구현했다.
  - `packages/cli/wiki-project.sh`: wiki claude adapter 에 동일한 stream-json 기본 + legacy fallback + result extraction 을 적용했다.
  - `apps/desktop/src/renderer/main.tsx`: LiveTerminalView 가 persistent `<runner>.log` 에 active `*_live_stdout.log` 를 추가 tail 하고, Claude JSONL (`system/init`, text, `tool_use`, `tool_result`, `stream_event`/`message_delta`, `result/success`) 을 사용자용 한 줄 요약으로 변환하도록 했다.
  - `apps/desktop/src/main.js`: final `result.usage` 를 우선 사용하고 중간 stream-json usage 는 skip 해 token 중복 집계를 방지하며 기존 regex/Gemini/Codex fallback 은 유지했다.
  - `packages/cli/runners-project.sh`, `runtime/board-scripts/runners-project.sh`, `AGENTS.md`: stream-json 기본 표시와 rollback 규약을 sync 했다.
  - Allowed Paths audit: `git status --short -- <Allowed Paths>` 결과 변경 파일은 티켓 Allowed Paths 8개뿐이며, worktree 와 PROJECT_ROOT 의 해당 파일은 `cmp -s` 기준 모두 동일했다.

- Runtime hydrated worktree dependency at 2026-05-09T10:55:50Z: linked apps/desktop/node_modules -> /Users/demoon2016/Documents/project/autoflow/apps/desktop/node_modules
- Runtime hydrated worktree dependency at 2026-05-09T10:55:50Z: linked node_modules -> /Users/demoon2016/Documents/project/autoflow/node_modules
- AI worker prepared todo at 2026-05-09T10:55:49Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_229
- AI worker prepared resume at 2026-05-09T11:09:30Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_229
- Finish paused at 2026-05-09T11:11:37Z: worktree HEAD 295b891b83874db906e9423a0a620328177e7d77 does not contain PROJECT_ROOT HEAD f8931e682ae548a85dfb238c253289367c6e67af. AI must perform the rebase/merge; script did not run git rebase.
- AI merge/rebase 완료 (worker, 2026-05-09T11:13Z): ticket snapshot commit 을 PROJECT_ROOT `main` HEAD `f8931e682ae548a85dfb238c253289367c6e67af` 위로 rebase 했다. `packages/cli/run-role.sh` 와 `runtime/board-scripts/run-role.sh` 충돌은 PROJECT_ROOT 에 이미 반영되어 검증된 최종 파일 내용과 동일하게 해소했고, rebase 후 worktree HEAD 는 `81e3f1c5046a9ead3d5ce20705ee95faf6e588bd` 다. Allowed Paths 전체는 worktree 와 PROJECT_ROOT 사이에서 `cmp -s` 기준 동일하다.
- No staged code changes found in worktree during merge preparation at 2026-05-09T11:13:17Z.
- Impl AI worker marked verification pass at 2026-05-09T11:13:16Z; runtime finalizer will not perform merge operations.
- Coordinator post-merge cleanup at 2026-05-09T11:13:17Z: worktree_unfinished=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_229:rebase_head_present branch_delete_failed=autoflow/tickets_229.
- Inline merge blocked at 2026-05-09T11:13:16Z: post_merge_cleanup_failed
- No staged code changes found in worktree during merge preparation at 2026-05-09T11:13:34Z.
- Impl AI worker marked verification pass at 2026-05-09T11:13:34Z; runtime finalizer will not perform merge operations.
- Inline merge blocked at 2026-05-09T11:13:34Z: post_merge_cleanup_failed
- No staged code changes found in worktree during merge preparation at 2026-05-09T11:14:00Z.
- Impl AI worker marked verification pass at 2026-05-09T11:13:59Z; runtime finalizer will not perform merge operations.
- Coordinator post-merge cleanup at 2026-05-09T11:14:00Z: worktree_processes_stopped=0 removed_worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_229 deleted_branch=autoflow/tickets_229.
- Inline merge finalizer (worker worker) finalized this verified ticket at 2026-05-09T11:14:00Z.
## Verification
- Result: passed by worker at 2026-05-09T11:13:59Z
- Log file: pending AI merge finalization

## Result

- Summary: claude stream-json adapter and LiveTerminalView live signal implemented
- Remaining risk: 실제 장시간 Claude adapter tick 의 5분 이상 실시간 UI 관찰은 이번 headless owner tick 에서 수행하지 못했다. 구현은 active `*_live_stdout.log` tail + JSONL 요약 경로와 build 검증으로 확인했다.
