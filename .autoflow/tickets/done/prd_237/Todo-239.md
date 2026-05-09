# Ticket

## Ticket

- ID: Todo-239
- PRD Key: prd_237
- Plan Candidate: Plan AI handoff from tickets/done/prd_237/prd_237.md
- Title: 변경코드량 / 토큰 사용량 집계 검증 및 보정
- Priority: normal
- Change Type: code
- Stage: done
- AI: worker
- Claimed By: worker
- Execution AI: worker
- Verifier AI:
- Last Updated: 2026-05-09T14:00:57Z

## Goal

- 이번 작업의 목표: `packages/cli/run-role.sh`, `packages/cli/telemetry-project.sh`, `packages/cli/metrics-project.sh`, `apps/desktop/src/main.js`, `apps/desktop/src/renderer/main.tsx` 에 걸친 토큰/변경코드량 집계 파이프라인을 한 tick 기준으로 추적해 부풀림 지점 여부를 확인하고, 실제 왜곡 원인이 과거 telemetry row 라면 현재 집계가 그 legacy row 에 과도하게 끌려가지 않도록 read-side window 또는 동등한 비파괴 보정 1개를 적용한다.

## References

- PRD: tickets/done/prd_237/prd_237.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_237]]
- Plan Note:
- Ticket Note: [[Todo-239]]

## Allowed Paths

- `packages/cli/run-role.sh`
- `runtime/board-scripts/run-role.sh`
- `packages/cli/telemetry-project.sh`
- `packages/cli/metrics-project.sh`
- `apps/desktop/src/main.js`
- `apps/desktop/src/renderer/main.tsx`
- `.autoflow/metrics/`

## Worktree
- Path: `/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_239`
- Branch: autoflow/tickets_239
- Base Commit: 67924129154702bc3b00c0526a587149bfdfdf2e
- Worktree Commit: 
- Integration Status: already_in_project_root

## Goal Runtime
- Status: complete
- Started At: 2026-05-09T13:54:20Z
- Started Epoch: 1778334860
- Updated At: 2026-05-09T14:00:58Z
- Tick Count: 7
- Time Used Seconds: 398
- Token Budget: 
- Tokens Used: 
- Continuation Suppressed: false
- Last Event: complete
- Last Progress Fingerprint: 1360518135

## Recovery State

- Status: healthy
- Detected By:
- Failure Class:
- Evidence:
- Planner Decision:
- Owner Resume Instruction:
- Last Recovery At:

## Done When

- [x] `packages/cli/run-role.sh` 와 `runtime/board-scripts/run-role.sh` 의 `telemetry_extract_token_components_from_logs`에서 Codex는 `turn.completed`/`item.completed` 제외 규칙으로 `turn.completed`만 신뢰하고, `is_codex_intermediate_stream_event`가 `item.completed`/`message_delta`/`tool_use`/`partial` 등을 스킵한다. 같은 경로로 `run_role_record_worker_tick_telemetry`가 한 tick 행으로 기록한다는 근거를 코드에서 확인함.
- [x] `telemetry_extract_token_components_from_logs`가 Claude stream-json에서 `is_claude_intermediate_stream_event`로 `message_delta`/`tool_use`/`partial`를 건너뛰고 final usage만 남기는 것을 코드 확인함. `run-role`/`runtime/board-scripts` 모두 동일 필터를 공유하므로 회귀 방지 경로가 일치.
- [x] `packages/cli/metrics-project.sh` `count_autoflow_token_metrics`에 `AUTOFLOW_TOKEN_BUDGET_MAX_DATA_AGE_SECONDS` 기반 `ended_at` 윈도우를 추가해 최근 window 기준으로만 `autoflow_token_usage_count` 합산되도록 비파괴 보정 적용.
- [x] `packages/cli/metrics-project.sh` `count_autoflow_commit_metrics`가 `find ... tickets/done/tickets_*.md` 대상 커밋 해시만 `git log`/`git show --numstat`로 집계하고, 실시간 워킹트리 파일 경로는 diff source에서 제외되어 dirty 변경이 합산되지 않음을 코드상 확인.
- [x] `apps/desktop/src/main.js`/`apps/desktop/src/renderer/main.tsx`는 기존 key (`autoflow_code_files_changed_count` 등, `autoflow_token_usage_count`) 그대로 사용해 보정 후 값만 반영하도록 유지. UI 변경 없이 key 체인 일관성 유지 확인.
- [x] `cd /Users/demoon2016/Documents/project/autoflow/apps/desktop && npm run check` 실행 결과 `exit 0`.

## Next Action
- Complete: the inline merge finalizer integrated the AI-merged ticket, archived evidence, and prepared the local completion commit.

## Resume Context

- 현재 상태 요약: Plan AI 가 backlog PRD 에서 todo 티켓을 생성한 직후.
- 직전 작업: scripts/start-plan.sh 가 PRD 를 done 으로 보관하고 todo 티켓을 만들었다.
- 재개 시 먼저 볼 것: PRD, Goal, Allowed Paths, Done When.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_237/prd_237.md at 2026-05-09T13:54:12Z.

- Runtime hydrated worktree dependency at 2026-05-09T13:54:19Z: linked apps/desktop/node_modules -> /Users/demoon2016/Documents/project/autoflow/apps/desktop/node_modules
- Runtime hydrated worktree dependency at 2026-05-09T13:54:19Z: linked node_modules -> /Users/demoon2016/Documents/project/autoflow/node_modules
- AI worker prepared todo at 2026-05-09T13:54:18Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_239
- AI worker prepared resume at 2026-05-09T13:58:20Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_239
- Verification run: `telemetry-extract` 스캔 경로(Claud/코덱스 중간 이벤트 스킵), `bin/autoflow metrics /Users/demoon2016/Documents/project/autoflow .autoflow` 출력, `cd /Users/demoon2016/Documents/project/autoflow/apps/desktop && npm run check`(exit 0) 기록으로 증빙.
- 실행 근거 경로: `packages/cli/run-role.sh:1019-1035`, `1109-1200`, `runtime/board-scripts/run-role.sh:1022-1040`, `1114-1202`; `packages/cli/metrics-project.sh:339-380`, `packages/cli/telemetry-project.sh:371-519`, `apps/desktop/src/main.js:2265-2340`, `apps/desktop/src/renderer/main.tsx:548-558`.

- Queued without worktree commit at 2026-05-09T14:00:56Z: PROJECT_ROOT already matches the ticket worktree for all Allowed Paths with code changes.
- Impl AI worker marked verification pass at 2026-05-09T14:00:56Z; runtime finalizer will not perform merge operations.
- Coordinator post-merge cleanup at 2026-05-09T14:00:57Z: worktree_dirty_already_in_project_root=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_239 removed_worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_239 deleted_branch=autoflow/tickets_239.
- Inline merge finalizer (worker worker) finalized this verified ticket at 2026-05-09T14:00:57Z.
## Verification
- Result: passed by worker at 2026-05-09T14:00:56Z
- Log file: pending AI merge finalization

## Result

- Summary:
- Remaining risk: none.
