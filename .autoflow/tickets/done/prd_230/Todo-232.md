# Ticket

## Ticket

- ID: Todo-232
- PRD Key: prd_230
- Plan Candidate: Plan AI handoff from tickets/done/prd_230/prd_230.md
- Title: LiveTerminalView quota toast 분류 개선
- Priority: normal
- Change Type: code
- Stage: done
- AI: worker
- Claimed By: worker
- Execution AI: worker
- Verifier AI:
- Last Updated: 2026-05-09T12:00:27Z

## Goal

- 이번 작업의 목표: LiveTerminalView 의 기존 quota toast 가 `rate limit` 과 `quota exceeded` 를 같은 "토큰 한도 도달" 상태로 묶어 사용자의 실제 한도 소진으로 오인하게 만드는 문제를 해소한다. `apps/desktop/src/renderer/main.tsx` 안에서 신호 패턴을 분리해, 일시적인 API 속도 제한은 `API 속도 제한` 토스트와 자동 재시도 안내로, 실제 사용 한도 소진은 `사용 한도 소진` 토스트와 모델 교체/회복 대기 안내로 각각 구분 표시한다.

## References

- PRD: tickets/done/prd_230/prd_230.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_230]]
- Plan Note:
- Ticket Note: [[Todo-232]]

## Allowed Paths

- `apps/desktop/src/renderer/main.tsx`

## Worktree
- Path: `/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_232`
- Branch: autoflow/tickets_232
- Base Commit: 0f54df66bd16d79eed7e34cbcfcefc4cc2b5a0e5
- Worktree Commit: 
- Integration Status: already_in_project_root

## Goal Runtime
- Status: complete
- Started At: 2026-05-09T11:58:18Z
- Started Epoch: 1778327898
- Updated At: 2026-05-09T12:00:28Z
- Tick Count: 3
- Time Used Seconds: 130
- Token Budget: 
- Tokens Used: 
- Continuation Suppressed: false
- Last Event: complete
- Last Progress Fingerprint: 2583027725

## Recovery State

- Status: healthy
- Detected By:
- Failure Class:
- Evidence:
- Planner Decision:
- Owner Resume Instruction:
- Last Recovery At:

## Done When

- [x] `apps/desktop/src/renderer/main.tsx` 에서 rate-limit 감지와 quota-exhausted 감지가 별도 패턴 또는 분기 로직으로 분리된다.
- [x] rate limit 신호일 때 LiveTerminalView 토스트 제목이 `API 속도 제한` 으로 표시되고, 본문은 일시적 제한 및 자동 재시도 안내를 보여준다.
- [x] quota 소진 신호일 때 LiveTerminalView 토스트 제목이 `사용 한도 소진` 으로 표시되고, 본문은 모델 교체 또는 한도 회복 대기 안내를 보여준다.
- [x] `cd /Users/demoon2016/Documents/project/autoflow/apps/desktop && npm run check` exits 0.

## Next Action
- Complete: the inline merge finalizer integrated the AI-merged ticket, archived evidence, and prepared the local completion commit.

## Resume Context

- 현재 상태 요약: Plan AI 가 backlog PRD 에서 todo 티켓을 생성했고, 구현 범위를 `main.tsx` 단일 파일로 확정했다.
- 직전 작업: `scripts/start-plan.sh` 가 `prd_230` 을 `tickets/done/prd_230/prd_230.md` 로 보관하며 `Todo-232` 를 만들었다.
- 재개 시 먼저 볼 것: `tickets/done/prd_230/prd_230.md`, `apps/desktop/src/renderer/main.tsx` 의 `RUNNER_QUOTA_KEYWORD_PATTERN` / retry-after 추출부 / quota toast copy.
- 현재 진행 반영: `apps/desktop/src/renderer/main.tsx`에서 rate-limit / quota 소진 패턴을 분리하고, toast 제목·본문 분기 로직과 지문(fingerprint) 분기를 적용했다.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_230/prd_230.md at 2026-05-09T11:44:40Z.
- Wiki / done 컨텍스트: `[[prd_227]]`, `[[Todo-230]]` 에서 LiveTerminalView 하단 sticky quota toast 구조와 dismiss fingerprint 패턴이 이미 정착됐다. 이번 티켓은 UI 구조나 스타일을 넓히지 말고, 기존 `main.tsx` 안 signal 분류와 문구만 rate limit / quota exhausted 두 갈래로 세분화한다.
- Mini-Plan: `[[prd_230]]`, `[[prd_227]]` 선행 산출물을 반영해 `RUNNER_RATE_LIMIT_QUOTA_KEYWORD_PATTERN`(`rate limit`, `too many requests`, `429`) 및 `RUNNER_QUOTA_EXHAUSTED_KEYWORD_PATTERN`(`usage limit`, `quota exceeded`, `resource_exhausted`, `model_capacity_exhausted`) 분기를 추가하고, `runnerQuotaToastSignal` 반환값에 `rate_limit` / `quota_exhausted`를 담아 toast 제목·본문을 각각 분기한다.
- Wiki evidence: `autoflow wiki query --rag --term "LiveTerminalView quota toast rate limit quota exceeded"` 결과에서 `prd_230` PRD/order 및 `prd_227` sticky toast 맥락을 조회했고, 기존 구조 유지 + 메시지 분기만 변경하는 방향으로 일치 확인.

- Runtime hydrated worktree dependency at 2026-05-09T11:58:18Z: linked apps/desktop/node_modules -> /Users/demoon2016/Documents/project/autoflow/apps/desktop/node_modules
- Runtime hydrated worktree dependency at 2026-05-09T11:58:18Z: linked node_modules -> /Users/demoon2016/Documents/project/autoflow/node_modules
- AI worker prepared todo at 2026-05-09T11:58:16Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_232
- AI worker prepared resume at 2026-05-09T11:58:39Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_232
- Queued without worktree commit at 2026-05-09T12:00:27Z: PROJECT_ROOT already matches the ticket worktree for all Allowed Paths with code changes.
- Impl AI worker marked verification pass at 2026-05-09T12:00:27Z; runtime finalizer will not perform merge operations.
- Coordinator post-merge cleanup at 2026-05-09T12:00:27Z: worktree_dirty_already_in_project_root=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_232 removed_worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_232 deleted_branch=autoflow/tickets_232.
- Inline merge finalizer (worker worker) finalized this verified ticket at 2026-05-09T12:00:27Z.
## Verification
- Result: passed by worker at 2026-05-09T12:00:27Z
- Log file: pending AI merge finalization

## Result

- Summary: LiveTerminalView quota toast를 rate-limit/quota_exhausted 분리 적용으로 제목/안내 문구 분기 및 fingerprint 정합성 유지 완료
- Remaining risk: 없음 (기존 retry-after 노출은 rate limit 문구에만 유지, quota 소진 문구는 명시 문구 + 모델 교체/회복 안내).
