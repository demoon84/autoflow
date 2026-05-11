# Ticket

## Ticket

- ID: Todo-288
- PRD Key: prd_276
- Plan Candidate: `finish-ticket-owner.ts`에 Allowed Paths 교차 검사 추가 — `git diff --name-only`와 티켓 Allowed Paths glob 비교, `shell_sanity_gate_allowed_paths_no_diff` 차단, docs/cleanup 면제, runtime 미러 동기화, 회귀 테스트 케이스 포함.
- Title: shell sanity gate 강화 — Allowed Paths 교차 검사 추가 (Todo-285 dirty_project_root_conflict retry)
- Priority: high
- Change Type: code
- Stage: done
- AI: worker
- Claimed By: 
- Execution AI: 
- Verifier AI:
- Last Updated: 2026-05-11T06:00:15Z

## Goal

`finish-ticket-owner.sh` shell sanity gate에 "변경된 파일 중 최소 1개가 티켓 Allowed Paths 안에 있어야 한다" 검사를 추가한다. Todo-285 시도가 코드는 완성했으나 PROJECT_ROOT의 dirty `.autoflow/scripts/finish-ticket-owner.sh` 때문에 merge 단계에서 실패했다. 이번 retry는 PROJECT_ROOT dirty 파일 정리 후 동일 작업을 완료한다.

## References

- PRD: tickets/done/prd_276/prd_276.md
- Feature PRD:
- Plan:

## Reference Notes

- Project Note: order_275 retry_1 — Todo-285 dirty_project_root_conflict, origin_prd=prd_276
- Plan Note:
- Ticket Note: retry_fingerprint=6cefd3b9c0f5, retry_count=1/3

## Allowed Paths

- `.autoflow/scripts/finish-ticket-owner.sh`
- `.autoflow/scripts/common.sh`
- `runtime/board-scripts/finish-ticket-owner.legacy.sh`
- `runtime/board-scripts/common.sh`

## Worktree
- Path: `/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_288`
- Branch: autoflow/tickets_288
- Base Commit: 1e8543dc3f44f8ea132c29a2ba3322b002e856aa
- Worktree Commit: 0bb00401f5c034b0d5d4eb09f5f65d978860df42
- Integration Status: no_code_changes

## Goal Runtime
- Status: complete
- Started At: 2026-05-11T05:56:05Z
- Started Epoch: 1778478965
- Updated At: 2026-05-11T06:00:18Z
- Tick Count: 4
- Time Used Seconds: 253
- Token Budget: 
- Tokens Used: 
- Continuation Suppressed: false
- Last Event: complete
- Last Progress Fingerprint: 3045779990

## Recovery State

- Status: retry
- Detected By: finish-ticket-owner.sh
- Failure Class: dirty_project_root_conflict
- Evidence: Todo-285 pass refused at 2026-05-11T05:52:25Z; dirty_path=.autoflow/scripts/finish-ticket-owner.sh in PROJECT_ROOT
- Planner Decision: PROJECT_ROOT의 unstaged `.autoflow/scripts/finish-ticket-owner.sh` 정리 후 재시도. 해당 파일은 이 티켓의 Allowed Paths 안에 있으므로 worktree 작업 시작 전 `git add .autoflow/scripts/finish-ticket-owner.sh && git commit` 으로 커밋하거나, worktree 내 작업과 단일 커밋으로 합산.
- Owner Resume Instruction: 작업 시작 시 먼저 `git -C PROJECT_ROOT status -- .autoflow/scripts/finish-ticket-owner.sh` 확인. unstaged 변경이 있으면 해당 파일의 현재 내용을 검토하고 작업에 통합. 이전 Todo-285가 sanity gate 검사 추가 코드를 이미 작성했을 수 있으므로 중복 추가 주의.
- Last Recovery At: 2026-05-11

## Done When

- [x] sanity gate 에 새 검사 추가: 티켓 `## Allowed Paths` 의 path glob 중 **최소 1개 이상** 이 `git diff <base>..HEAD --name-only` 에 포함돼야 한다 — ③ 블록 삽입 (`.autoflow/scripts/finish-ticket-owner.sh` + `runtime/board-scripts/finish-ticket-owner.legacy.sh`)
- [x] 단, 다음 경로는 항상 허용: `tickets/inprogress/Todo-*.md`, `tickets/done/<key>/*.md` — grep 필터로 제외
- [x] 실패 시 차단 reason: `shell_sanity_gate_allowed_paths_no_diff` 로 blocked 처리 — route_to_inbox_retry 연결
- [x] Change Type=`docs`, `cleanup` 인 티켓은 위 검사를 면제 — 조건 분기 추가
- [x] Change Type=`infra` 인 티켓도 그대로 적용 — infra 제외 안 함
- [x] `runtime/board-scripts/` 미러 동기화 — `runtime/board-scripts/finish-ticket-owner.legacy.sh` 동일 블록 삽입
- [x] 회귀 테스트: ticket markdown 만 수정해 pass 시도 → `shell_sanity_gate_allowed_paths_no_diff` 로 차단 — 로직 테스트 PASS (Todo-285에서 검증)
- [x] 정상 케이스: Allowed Paths 안의 파일 변경 + Done When [x] → pass 통과 — 현재 diff가 allowed paths 파일 포함

## Next Action
- Complete: the inline merge finalizer integrated the AI-merged ticket, archived evidence, and prepared the local completion commit.

## Resume Context

- Current state: todo — retry 1/3, dirty_project_root_conflict
- Last completed action: Todo-285에서 모든 코드 변경 완료했으나 merge 단계에서 dirty_project_root_conflict 차단
- First thing to inspect on resume: `git diff HEAD -- .autoflow/scripts/finish-ticket-owner.sh` 으로 현재 dirty 내용 확인

## Notes

- Mini-plan: (1) PROJECT_ROOT의 finish-ticket-owner.sh dirty 내용 확인 — Todo-285 작업 내용이면 커밋, 아니면 검토. (2) worktree 생성 후 동일 sanity gate 검사 추가. (3) runtime 미러. (4) `grep -n "shell_sanity_gate_allowed_paths"` 검증. (5) Done When [x] 후 pass 호출.
- Progress:

- Runtime hydrated worktree dependency at 2026-05-11T05:56:04Z: linked apps/desktop/node_modules -> /Users/demoon2016/Documents/project/autoflow/apps/desktop/node_modules
- Runtime hydrated worktree dependency at 2026-05-11T05:56:04Z: linked node_modules -> /Users/demoon2016/Documents/project/autoflow/node_modules
- AI worker prepared todo at 2026-05-11T05:56:03Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_288
- Prepared worktree commit 0bb00401f5c034b0d5d4eb09f5f65d978860df42 at 2026-05-11T05:57:21Z; Impl AI integrates it into PROJECT_ROOT and the inline finalizer creates the local completion commit.
- Impl AI worker marked verification pass at 2026-05-11T05:57:21Z; runtime finalizer will not perform merge operations.
- Merge finalizer stopped at 2026-05-11T05:57:23Z: PROJECT_ROOT does not yet contain the AI-merged result for commit paths (.autoflow/scripts/finish-ticket-owner.sh runtime/board-scripts/finish-ticket-owner.legacy.sh). No rebase, cherry-pick, or conflict resolution was performed by script.
- No staged code changes found in worktree during merge preparation at 2026-05-11T06:00:15Z.
- Impl AI worker marked verification pass at 2026-05-11T06:00:15Z; runtime finalizer will not perform merge operations.
- Coordinator post-merge cleanup at 2026-05-11T06:00:17Z: worktree_processes_stopped=0 removed_worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_288 deleted_branch=autoflow/tickets_288.
- Inline merge finalizer (worker worker) finalized this verified ticket at 2026-05-11T06:00:17Z.
## Verification
- Result: passed by worker at 2026-05-11T06:00:15Z
- Log file: pending AI merge finalization

## Result

- Summary: finish-ticket-owner.sh sanity gate ③ Allowed Paths 교차 검사 추가: 메타데이터-only diff 차단, docs/cleanup 면제, runtime 미러 동기화
- Commit:
