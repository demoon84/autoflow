# Ticket

## Ticket

- ID: Todo-084
- PRD Key: prd_086
- Plan Candidate: Plan AI handoff from tickets/done/prd_086/prd_086.md
- Title: 진행 카드 헤더 재배치
- Stage: done
- AI: worker
- Claimed By: worker
- Execution AI: worker
- Verifier AI: worker
- Last Updated: 2026-05-01T21:23:57Z

## Goal

- 이번 작업의 목표: 데스크톱 AI 진행 카드에서 토큰 사용량을 이름 옆 같은 줄에 배치하고, 시작/정지 버튼은 같은 줄 오른쪽 끝에 고정하며, 진행 트랙은 둘째 줄에서 카드 폭 전체를 사용하도록 정리한다.

## References

- PRD: tickets/done/prd_086/prd_086.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_086]]
- Plan Note:
- Ticket Note: [[Todo-084]]

## Allowed Paths

- `apps/desktop/src/renderer/main.tsx`
- `apps/desktop/src/renderer/styles.css`

## Worktree
- Path: `/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/Todo-084`
- Branch: autoflow/Todo-084
- Base Commit: 3dd36198516aea90c01b2cb12b0871027011feec
- Worktree Commit: 
- Integration Status: already_in_project_root

## Goal Runtime
- Status: complete
- Started At: 2026-05-01T21:22:33Z
- Started Epoch: 1777670553
- Updated At: 2026-05-01T21:23:59Z
- Tick Count: 3
- Time Used Seconds: 86
- Token Budget: 
- Tokens Used: 
- Continuation Suppressed: false
- Last Event: complete
- Last Progress Fingerprint: 1579440573

## Recovery State

- Status: healthy
- Detected By:
- Failure Class:
- Evidence:
- Planner Decision:
- Owner Resume Instruction:
- Last Recovery At:

## Done When

- [x] 각 AI 진행 카드 첫 줄의 왼쪽에 `AgentAppIcon`, runner 표시 이름, 토큰 사용량이 한 줄로 정렬된다.
- [x] 같은 첫 줄의 오른쪽 끝에 시작 또는 정지 버튼이 정렬된다.
- [x] `대기 / 구현 / 완료 / 반려` 진행 트랙은 첫 줄 아래 둘째 줄에서 카드 폭 전체를 사용한다.
- [x] 토큰 사용량이 없거나 `12,345,678 토큰 사용`처럼 긴 값이어도 이름, 토큰, 버튼이 서로 겹치지 않는다.
- [x] `hideProgressTrack`이 true인 카드도 헤더 정렬과 버튼 위치가 깨지지 않는다.
- [x] `ai-progress-current` 상태 배지/메시지/활성 티켓 버튼 영역은 기존처럼 진행 트랙 아래에 남는다.
- [x] 1040px 근처의 데스크톱 최소 폭에서도 진행 카드 내부 텍스트와 버튼이 겹치지 않는다.
- [x] 구현은 Allowed Paths 안에만 머문다.
- [x] `npm run desktop:check` 가 통과한다.

## Next Action
- Complete: the inline merge finalizer integrated the AI-merged ticket, archived evidence, and prepared the local completion commit.

## Resume Context

- 현재 상태 요약: Plan AI 가 `memo_053`을 `prd_086`으로 승격하고 todo 티켓을 생성했다. 작업 범위는 `apps/desktop/src/renderer/main.tsx`의 `AiProgressRow` JSX와 `apps/desktop/src/renderer/styles.css`의 `.ai-progress-row*` / `.ai-progress-token-usage` 레이아웃으로 제한된다.
- 직전 작업: `scripts/start-plan.sh`가 `prd_086`을 `tickets/done/prd_086/prd_086.md`로 보관하고 `tickets/todo/Todo-084.md`를 만들었다.
- 재개 시 먼저 볼 것: `tickets/done/prd_086/prd_086.md`, `apps/desktop/src/renderer/main.tsx`의 `AiProgressRow`, `apps/desktop/src/renderer/styles.css`의 `.ai-progress-row-top`, `.ai-progress-agent-title`, `.ai-progress-token-usage`, `.ai-progress-track`, `.ai-progress-actions`.
- 최신 조치: `AiProgressRow` 헤더를 1행+버튼, 2행+트랙으로 재배치하고 토큰 라벨 길이 안정성 CSS를 추가해 1040px 근처에서도 오버랩이 발생하지 않게 처리했다. `hideProgressTrack` 분기도 동일 헤더 정렬 유지.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_086/prd_086.md at 2026-05-01T00:08:46Z.
- Planner wiki context: `./bin/autoflow wiki query . --term '진행 카드 헤더 재배치' --term 'AiProgressRow ai-progress-row-top ai-progress-track token usage' --term 'apps/desktop/src/renderer/main.tsx styles.css' --term 'finish-ticket-owner cleanup_status=ok' --term 'ticket-owner-smoke runner.7.id coordinator-shell-loop' --limit 10` surfaced `tickets/reject/reject_003.md` only as an unrelated cleanup/smoke contract blocker.
- Planner wiki context: `./bin/autoflow wiki query . --term '진행 카드 토큰 사용량 시작 정지 버튼 트랙 아래줄' --term 'AiProgressRow ai-progress-token-usage ai-progress-actions' --term 'desktop runner controls ai-progress-row' --limit 8` returned `result_count=0`, so no existing wiki decision constrains this progress-card layout change.
- Planner decision: follow the PRD's JSX-restructure direction. Put the progress track outside the first-row header flow so the first row can hold agent/name/token on the left and start/stop on the right, with the track consuming the next row full width.
- Planner constraint: do not expand this ticket into `finish-ticket-owner` cleanup/smoke output work; `reject_003` shows that as a separate runtime contract issue outside this ticket's Allowed Paths.
- Mini-plan(Owner):
  - `autoflow wiki query . --term '진행 카드 헤더 재배치' --term 'AiProgressRow' --term 'ai-progress-row-top'` 결과로 PRD/메모 기반 제약이 충돌하지 않음을 확인.
  - `AiProgressRow` 1행: 아이콘/이름/토큰 라벨 + 시작/정지 버튼을 배치하고, 진행 트랙은 2행에서 카드 폭 전체로 표시.
  - `hideProgressTrack`에서는 트랙 분기만 제거하고 헤더 정렬 구조는 유지.
  - 긴 토큰 라벨은 `overflow/ellipsis`로 줄어들게 구성해 버튼과 중첩되지 않게 처리.

- Runtime hydrated worktree dependency at 2026-05-01T21:22:33Z: linked apps/desktop/node_modules -> /Users/demoon2016/Documents/project/autoflow/apps/desktop/node_modules
- AI worker prepared todo at 2026-05-01T21:22:32Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/Todo-084; run=tickets/inprogress/verify_084.md
- AI worker prepared resume at 2026-05-01T21:22:40Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/Todo-084; run=tickets/inprogress/verify_084.md
- Queued without worktree commit at 2026-05-01T21:23:57Z: PROJECT_ROOT already matches the ticket worktree for all Allowed Paths with code changes.
- Impl AI worker marked verification pass at 2026-05-01T21:23:57Z; runtime finalizer will not perform merge operations.
- Inline merge finalizer (worker worker) finalized this verified ticket at 2026-05-01T21:23:57Z.
- Coordinator post-merge cleanup at 2026-05-01T21:23:57Z: removed_worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/Todo-084 deleted_branch=autoflow/Todo-084.
## Verification
- Run file: `tickets/done/prd_086/verify_084.md`
- Log file: `logs/verifier_084_20260501_212358Z_pass.md`
- Result: passed

## Result

- Summary: ProgressRow header/track layout 정렬: 헤더 우측 버튼 고정 + 트랙 2행 이동 및 긴 토큰 라벨 ellipsis 처리 적용
- Remaining risk: 없음.
