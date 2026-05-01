# Ticket

## Ticket

- ID: tickets_084
- PRD Key: prd_086
- Plan Candidate: Plan AI handoff from tickets/done/prd_086/prd_086.md
- Title: 진행 카드 헤더 재배치
- Stage: done
- AI: worker
- Claimed By: worker
- Execution AI: worker
- Verifier AI: worker
- Last Updated: 2026-05-01T19:31:19Z

## Goal

- 이번 작업의 목표: 데스크톱 AI 진행 카드에서 토큰 사용량을 이름 옆 같은 줄에 배치하고, 시작/정지 버튼은 같은 줄 오른쪽 끝에 고정하며, 진행 트랙은 둘째 줄에서 카드 폭 전체를 사용하도록 정리한다.

## References

- PRD: tickets/done/prd_086/prd_086.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_086]]
- Plan Note:
- Ticket Note: [[tickets_084]]

## Allowed Paths

- `apps/desktop/src/renderer/main.tsx`
- `apps/desktop/src/renderer/styles.css`

## Worktree
- Path: `/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_084`
- Branch: autoflow/tickets_084
- Base Commit: 8532b7d65292ae381eb83b71623fa76ea82766e2
- Worktree Commit:
- Integration Status: already_in_project_root

## Goal Runtime
- Status: complete
- Started At: 2026-05-01T19:30:02Z
- Started Epoch: 1777663802
- Updated At: 2026-05-01T19:31:21Z
- Tick Count: 3
- Time Used Seconds: 79
- Token Budget: 
- Tokens Used: 
- Continuation Suppressed: false
- Last Event: complete
- Last Progress Fingerprint: 362751710

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

- 현재 진행: `AiProgressRow` 헤더/트랙 분리와 `ai-progress-agent-title` 긴 텍스트 보호를 반영해 중간 상태.
- 다음 확인: `npm run desktop:check` 실행 후 위크 상태/검증 로그 확정.

- 현재 상태 요약: Plan AI 가 `memo_053`을 `prd_086`으로 승격하고 todo 티켓을 생성했다. 작업 범위는 `apps/desktop/src/renderer/main.tsx`의 `AiProgressRow` JSX와 `apps/desktop/src/renderer/styles.css`의 `.ai-progress-row*` / `.ai-progress-token-usage` 레이아웃으로 제한된다.
- 직전 작업: `scripts/start-plan.sh`가 `prd_086`을 `tickets/done/prd_086/prd_086.md`로 보관하고 `tickets/todo/tickets_084.md`를 만들었다.
- 재개 시 먼저 볼 것: `tickets/done/prd_086/prd_086.md`, `apps/desktop/src/renderer/main.tsx`의 `AiProgressRow`, `apps/desktop/src/renderer/styles.css`의 `.ai-progress-row-top`, `.ai-progress-agent-title`, `.ai-progress-token-usage`, `.ai-progress-track`, `.ai-progress-actions`.

## Notes

- 미니 플랜: `AiProgressRow`의 첫 줄을 `runner 표시 이름 + 토큰 사용량 + 시작/중지 버튼`이 한 행으로 배치되도록 JSX 정렬하고, 진행 트랙을 두 번째 줄에서 폭 전체로 렌더한다.
- 위키 조사 결과: `autoflow wiki query`(term: `진행 카드 헤더 재배치`, `AiProgressRow`, `apps/desktop/src/renderer/main.tsx`)에서 본 티켓의 레이아웃 제약을 막는 선행 결정은 확인되지 않았고 `[[tickets/done/prd_086/prd_086.md]]`의 범위/목표만 유효.
- 관련 위험 표기: `[[tickets/reject/reject_003.md]]`은 현재 티켓의 UI Allowed Paths와 다른 `finish-ticket-owner` 후처리 계약 이슈여서 직접 제약으로 반영되지 않음.

- Created by planner (Plan AI) from tickets/done/prd_086/prd_086.md at 2026-05-01T00:08:46Z.
- Planner wiki context: `./bin/autoflow wiki query . --term '진행 카드 헤더 재배치' --term 'AiProgressRow ai-progress-row-top ai-progress-track token usage' --term 'apps/desktop/src/renderer/main.tsx styles.css' --term 'finish-ticket-owner cleanup_status=ok' --term 'ticket-owner-smoke runner.7.id coordinator-shell-loop' --limit 10` surfaced `tickets/reject/reject_003.md` only as an unrelated cleanup/smoke contract blocker.
- Planner wiki context: `./bin/autoflow wiki query . --term '진행 카드 토큰 사용량 시작 정지 버튼 트랙 아래줄' --term 'AiProgressRow ai-progress-token-usage ai-progress-actions' --term 'desktop runner controls ai-progress-row' --limit 8` returned `result_count=0`, so no existing wiki decision constrains this progress-card layout change.
- Planner decision: follow the PRD's JSX-restructure direction. Put the progress track outside the first-row header flow so the first row can hold agent/name/token on the left and start/stop on the right, with the track consuming the next row full width.
- Planner constraint: do not expand this ticket into `finish-ticket-owner` cleanup/smoke output work; `reject_003` shows that as a separate runtime contract issue outside this ticket's Allowed Paths.

- Runtime hydrated worktree dependency at 2026-05-01T19:30:01Z: linked apps/desktop/node_modules -> /Users/demoon2016/Documents/project/autoflow/apps/desktop/node_modules
- AI worker prepared todo at 2026-05-01T19:30:01Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_084; run=tickets/inprogress/verify_084.md
- AI worker prepared resume at 2026-05-01T19:30:19Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_084; run=tickets/inprogress/verify_084.md
- Queued without worktree commit at 2026-05-01T19:31:19Z: PROJECT_ROOT already matches the ticket worktree for all Allowed Paths with code changes.
- Impl AI worker marked verification pass at 2026-05-01T19:31:19Z; runtime finalizer will not perform merge operations.
- Inline merge finalizer (worker worker) finalized this verified ticket at 2026-05-01T19:31:19Z.
- Coordinator post-merge cleanup at 2026-05-01T19:31:19Z: removed_worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_084 deleted_branch=autoflow/tickets_084.
## Verification
- Run file: `tickets/done/prd_086/verify_084.md`
- Log file: `logs/verifier_084_20260501_193120Z_pass.md`
- Result: passed

## Result

- Summary: AiProgressRow 헤더/버튼/트랙 재배치 완료: 토큰 사용량 + 시작/정지 버튼 동행 배치 및 트랙 2행 분리 적용, desktop:check 통과
- Remaining risk: 없음 (현재 CSS 기준으로 1040px 인근 오버플로우는 토큰 label ellipsis 처리로 완화됨).
