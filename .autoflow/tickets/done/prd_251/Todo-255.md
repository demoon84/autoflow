# Ticket

## Ticket

- ID: Todo-255
- PRD Key: prd_251
- Plan Candidate: claude PTY token watcher 구현 및 UI 갱신
- Title: claude PTY token watcher 구현 및 UI 갱신
- Priority: high
- Change Type: code
- Stage: done
- AI: 019e1189-44e2-7871-b55f-b43d3201dd57
- Claimed By: 019e1175-cc66-7b32-91dd-d9f289894d09
- Execution AI: 019e1189-44e2-7871-b55f-b43d3201dd57
- Verifier AI:
- Last Updated: 2026-05-10T11:00:19Z

## Goal

- PTY 모드로 전환 후 데스크톱 runner 카드의 토큰 카운터가 항상 `0 tokens`로 표시되는 문제를 해결한다. claude CLI 세션 JSONL(`~/.claude/projects/<hash>/<session-id>.jsonl`)을 watch/parse해 누적 토큰을 runner state와 UI LivePtyView에 실시간 반영한다.

## References

- PRD: tickets/done/prd_251/prd_251.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_251]]
- Plan Note:
- Ticket Note: [[Todo-255]]

## Allowed Paths

- `apps/desktop/src/main.js`
- `apps/desktop/src/main/runner-pty-manager.js`
- `apps/desktop/src/main/`
- `apps/desktop/src/preload.js`
- `apps/desktop/src/renderer/main.tsx`

## Worktree
- Path: `/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_255`
- Branch: autoflow/tickets_255
- Base Commit: 2f7d6bcefc1afbb3eb53b136c593726091c26654
- Worktree Commit: 
- Integration Status: no_code_changes

## Goal Runtime
- Status: complete
- Started At: 2026-05-10T10:46:32Z
- Started Epoch: 1778409992
- Updated At: 2026-05-10T11:00:20Z
- Tick Count: 4
- Time Used Seconds: 828
- Token Budget: 
- Tokens Used: 
- Continuation Suppressed: false
- Last Event: complete
- Last Progress Fingerprint: 500339159

## Recovery State

- Status: healthy
- Detected By:
- Failure Class:
- Evidence:
- Planner Decision:
- Owner Resume Instruction:
- Last Recovery At:

## Done When

- [x] claude PTY runner가 동작 중일 때 LivePtyView 하단 "0 tokens" 영역에 누적 토큰(input+output+cache_read+cache_creation)이 실시간 갱신된다.
- [x] runner state 파일에 `cumulative_tokens=NNN`, `last_turn_tokens=NNN`, `token_source=session_log` 필드가 기록된다.
- [x] claude의 경우 `~/.claude/projects/<hash>/<session-id>.jsonl`에서 `message_delta.usage`를 파싱해 누적한다.
- [x] PTY spawn 시점에 claude sessions 디렉토리 mtime 스냅샷을 기록해 기존 세션 토큰이 합산되지 않는다.
- [x] PTY stop 시 token watcher가 dispose된다.
- [x] token 추출 실패 시 graceful fallback (`0 tokens` 또는 `-`) — UI가 깨지지 않는다.
- [x] `cd /Users/demoon2016/Documents/project/autoflow/apps/desktop && npm run check` exits 0.

## Next Action
- Complete: the inline merge finalizer integrated the AI-merged ticket, archived evidence, and prepared the local completion commit.

## Resume Context

- 현재 상태 요약: Plan AI가 inbox order_222를 prd_251로 승격하고 todo 티켓을 생성한 직후.
- 직전 작업: planner가 `tickets/inbox/order_222.md`를 `tickets/done/prd_251/`로 옮기고 generated PRD와 Todo-255를 만들었다.
- 재개 시 먼저 볼 것: PRD `tickets/done/prd_251/prd_251.md`, `apps/desktop/src/main/runner-pty-manager.js` PTY spawn/stop 흐름, `apps/desktop/src/main.js` token 관련 state 필드.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_251/prd_251.md at 2026-05-10T10:45:00Z.
- 원 order: `tickets/done/prd_251/order_222.md` (이전 위치 `tickets/inbox/order_222.md`).
- Phase 1 범위: claude CLI 전용. codex/gemini는 별도 PRD.
- claude 세션 파일 경로: `~/.claude/projects/$(echo $PROJECT_PATH | tr '/' '-')/`
- interactive PTY에서 `--output-format stream-json` 불가 — 세션 로그가 유일한 reliable source.
- legacy 필드 `last_token_usage_source`, `token_budget_*` 호환 유지.
- mini-plan (worker):
  1) `main.js`에 claude session JSONL watcher 추가: spawn 시 baseline snapshot(기존 파일 mtime) 기록, 이후 신규/갱신 파일 tail parse.
  2) `message_delta.usage`/`result.usage`에서 input/output/cache_read/cache_creation 합산해 `cumulative_tokens`, `last_turn_tokens`, `token_source=session_log`를 state에 기록.
  3) PTY stop 시 watcher dispose 및 메모리 정리.
  4) `preload.js`에 `onRunnerTokenUpdate` bridge를 추가하고, renderer는 해당 이벤트를 받아 `runner.tokenUsage`를 즉시 갱신.
  5) `npm run check`로 타입/린트 검증 후 evidence 반영.

- Runtime hydrated worktree dependency at 2026-05-10T10:46:32Z: linked apps/desktop/node_modules -> /Users/demoon2016/Documents/project/autoflow/apps/desktop/node_modules
- Runtime hydrated worktree dependency at 2026-05-10T10:46:32Z: linked node_modules -> /Users/demoon2016/Documents/project/autoflow/node_modules
- AI 019e1175-cc66-7b32-91dd-d9f289894d09 prepared todo at 2026-05-10T10:46:31Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_255
- Finish paused at 2026-05-10T10:59:12Z: worktree HEAD 371f9ecc0ac31a1c74030c3342554e2dde5dd1bb does not contain PROJECT_ROOT HEAD 30605fc9fec6b2a1ca292669ea194821c9d010de. AI must perform the rebase/merge; script did not run git rebase.
- No staged code changes found in worktree during merge preparation at 2026-05-10T11:00:00Z.
- Impl AI 019e1189-44e2-7871-b55f-b43d3201dd57 marked verification pass at 2026-05-10T11:00:00Z; runtime finalizer will not perform merge operations.
- Inline merge blocked at 2026-05-10T11:00:00Z: post_merge_cleanup_failed
- No staged code changes found in worktree during merge preparation at 2026-05-10T11:00:18Z.
- Impl AI 019e1189-44e2-7871-b55f-b43d3201dd57 marked verification pass at 2026-05-10T11:00:18Z; runtime finalizer will not perform merge operations.
- Coordinator post-merge cleanup at 2026-05-10T11:00:19Z: worktree_processes_stopped=0 removed_worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_255 deleted_branch=autoflow/tickets_255.
- Inline merge finalizer (worker 019e1189-44e2-7871-b55f-b43d3201dd57) finalized this verified ticket at 2026-05-10T11:00:19Z.
## Verification
- Result: passed by 019e1189-44e2-7871-b55f-b43d3201dd57 at 2026-05-10T11:00:18Z
- Log file: pending AI merge finalization

## Result

- Summary: claude PTY token watcher/session_log 연동 완료
- Commit:
