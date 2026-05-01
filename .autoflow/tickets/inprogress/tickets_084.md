# Ticket

## Ticket

- ID: tickets_084
- PRD Key: prd_086
- Plan Candidate: Plan AI handoff from tickets/done/prd_086/prd_086.md
- Title: 진행 카드 헤더 재배치
- Stage: executing
- AI: worker
- Claimed By: worker
- Execution AI: worker
- Verifier AI: worker
- Last Updated: 2026-05-01T21:22:40Z

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
- Base Commit: 3dd36198516aea90c01b2cb12b0871027011feec
- Worktree Commit: 
- Integration Status: pending

## Goal Runtime
- Status: active
- Started At: 2026-05-01T21:22:33Z
- Started Epoch: 1777670553
- Updated At: 2026-05-01T21:22:41Z
- Tick Count: 2
- Time Used Seconds: 8
- Token Budget: 
- Tokens Used: 
- Continuation Suppressed: false
- Last Event: resume
- Last Progress Fingerprint: 792795369

## Recovery State

- Status: healthy
- Detected By:
- Failure Class:
- Evidence:
- Planner Decision:
- Owner Resume Instruction:
- Last Recovery At:

## Done When

- [ ] 각 AI 진행 카드 첫 줄의 왼쪽에 `AgentAppIcon`, runner 표시 이름, 토큰 사용량이 한 줄로 정렬된다.
- [ ] 같은 첫 줄의 오른쪽 끝에 시작 또는 정지 버튼이 정렬된다.
- [ ] `대기 / 구현 / 완료 / 반려` 진행 트랙은 첫 줄 아래 둘째 줄에서 카드 폭 전체를 사용한다.
- [ ] 토큰 사용량이 없거나 `12,345,678 토큰 사용`처럼 긴 값이어도 이름, 토큰, 버튼이 서로 겹치지 않는다.
- [ ] `hideProgressTrack`이 true인 카드도 헤더 정렬과 버튼 위치가 깨지지 않는다.
- [ ] `ai-progress-current` 상태 배지/메시지/활성 티켓 버튼 영역은 기존처럼 진행 트랙 아래에 남는다.
- [ ] 1040px 근처의 데스크톱 최소 폭에서도 진행 카드 내부 텍스트와 버튼이 겹치지 않는다.
- [ ] 구현은 Allowed Paths 안에만 머문다.
- [ ] `npm run desktop:check` 가 통과한다.

## Next Action
- 다음에 바로 이어서 할 일: 한 owner 가 mini-plan, 구현, 검증, 증거 기록, done/reject 이동까지 이어서 처리한다.

## Resume Context

- 현재 상태 요약: Plan AI 가 `memo_053`을 `prd_086`으로 승격하고 todo 티켓을 생성했다. 작업 범위는 `apps/desktop/src/renderer/main.tsx`의 `AiProgressRow` JSX와 `apps/desktop/src/renderer/styles.css`의 `.ai-progress-row*` / `.ai-progress-token-usage` 레이아웃으로 제한된다.
- 직전 작업: `scripts/start-plan.sh`가 `prd_086`을 `tickets/done/prd_086/prd_086.md`로 보관하고 `tickets/todo/tickets_084.md`를 만들었다.
- 재개 시 먼저 볼 것: `tickets/done/prd_086/prd_086.md`, `apps/desktop/src/renderer/main.tsx`의 `AiProgressRow`, `apps/desktop/src/renderer/styles.css`의 `.ai-progress-row-top`, `.ai-progress-agent-title`, `.ai-progress-token-usage`, `.ai-progress-track`, `.ai-progress-actions`.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_086/prd_086.md at 2026-05-01T00:08:46Z.
- Planner wiki context: `./bin/autoflow wiki query . --term '진행 카드 헤더 재배치' --term 'AiProgressRow ai-progress-row-top ai-progress-track token usage' --term 'apps/desktop/src/renderer/main.tsx styles.css' --term 'finish-ticket-owner cleanup_status=ok' --term 'ticket-owner-smoke runner.7.id coordinator-shell-loop' --limit 10` surfaced `tickets/reject/reject_003.md` only as an unrelated cleanup/smoke contract blocker.
- Planner wiki context: `./bin/autoflow wiki query . --term '진행 카드 토큰 사용량 시작 정지 버튼 트랙 아래줄' --term 'AiProgressRow ai-progress-token-usage ai-progress-actions' --term 'desktop runner controls ai-progress-row' --limit 8` returned `result_count=0`, so no existing wiki decision constrains this progress-card layout change.
- Planner decision: follow the PRD's JSX-restructure direction. Put the progress track outside the first-row header flow so the first row can hold agent/name/token on the left and start/stop on the right, with the track consuming the next row full width.
- Planner constraint: do not expand this ticket into `finish-ticket-owner` cleanup/smoke output work; `reject_003` shows that as a separate runtime contract issue outside this ticket's Allowed Paths.

- Runtime hydrated worktree dependency at 2026-05-01T21:22:33Z: linked apps/desktop/node_modules -> /Users/demoon2016/Documents/project/autoflow/apps/desktop/node_modules
- AI worker prepared todo at 2026-05-01T21:22:32Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_084; run=tickets/inprogress/verify_084.md
- AI worker prepared resume at 2026-05-01T21:22:40Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_084; run=tickets/inprogress/verify_084.md
## Verification
- Run file: `tickets/inprogress/verify_084.md`
- Log file: pending
- Result: pending ticket-owner by worker

## Result

- Summary:
- Remaining risk:
