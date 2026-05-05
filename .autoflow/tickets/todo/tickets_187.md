# Ticket

## Ticket

- ID: tickets_187
- PRD Key: prd_188
- Plan Candidate: Plan AI handoff from tickets/done/prd_188/prd_188.md
- Title: desktop response delay severity labels
- Stage: todo
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated: 2026-05-05T01:42:58Z

## Goal

- 이번 작업의 목표: 데스크톱 AI 진행 현황 카드가 긴 정상 LLM 호출을 즉시 위험 상태처럼 보이지 않게 하고, 실제 멈춤 가능성은 임계값과 단계별 라벨/tooltip 으로 구분해 표시한다.

## References

- PRD: tickets/done/prd_188/prd_188.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_188]]
- Plan Note:
- Ticket Note: [[tickets_187]]

## Allowed Paths

- `apps/desktop/src/renderer/main.tsx`
- `apps/desktop/src/renderer/styles.css`
- `apps/desktop/src/renderer/vite-env.d.ts`
- `apps/desktop/src/main.js`

## Worktree

- Path:
- Branch:
- Base Commit:
- Worktree Commit:
- Integration Status: pending_claim

## Goal Runtime

- Status:
- Started At:
- Started Epoch:
- Updated At:
- Tick Count: 0
- Time Used Seconds: 0
- Token Budget:
- Tokens Used:
- Continuation Suppressed: false
- Last Event:
- Last Progress Fingerprint:
- Iteration Fingerprints: []
- Last Lint Status: ok
- Last Lint Vagueness Score: 0

## Recovery State

- Status: healthy
- Detected By:
- Failure Class:
- Evidence:
- Planner Decision:
- Owner Resume Instruction:
- Last Recovery At:

## Done When

- [ ] `runnerHeartbeatStale` 또는 후속 helper 는 `lastEventAt` 과 `lastAdapterChunkAt` 중 최신 시각을 기준으로 단계 정보를 계산하고, `activeStage="adapter_running"` 인 runner 가 최근 heartbeat/chunk 를 내는 동안 destructive `응답 지연` 라벨을 표시하지 않는다.
- [ ] 기본 설정에서 runner 의 최신 freshness 가 600초 미만이면 destructive `응답 지연` 라벨이 표시되지 않는다.
- [ ] `AUTOFLOW_HEARTBEAT_STALE_THRESHOLD_SECONDS=300` 또는 renderer 가 받는 동등 설정을 적용하면 `응답 지연 의심` 단계가 약 300초 기준으로 시작되는 것을 코드 레벨에서 확인할 수 있다.
- [ ] 단계 라벨은 최소 세 가지 의미를 구분한다: `LLM 응답 대기 중`, `응답 지연 의심`, `멈춤 가능`.
- [ ] `LLM 응답 대기 중` 은 정보성/중립 톤, `응답 지연 의심` 은 warning 톤, `멈춤 가능` 은 destructive 톤으로 표시되고 CSS class 가 서로 분리되어 있다.
- [ ] tooltip 은 각 단계의 의미, 경과 시간 또는 freshness age, 기본 timeout 1200초 기준의 위험도를 한국어로 설명한다.
- [ ] 활성 티켓 badge, `runnerProgressDetail`, 진행 트랙, start/stop/config 버튼의 레이아웃과 클릭 동작이 회귀하지 않는다.
- [ ] `lastAdapterChunkAt` 이 `AutoflowRunner` renderer type 에 포함되어 불필요한 type cast 없이 사용할 수 있다.
- [ ] `npm run desktop:check` exits 0.

## Next Action

- 다음에 바로 이어서 할 일: Plan AI 가 Allowed Paths 와 Done When 을 PRD 기준으로 더 좁힌다. Impl AI 는 이 티켓을 todo 에서 claim 한 뒤 mini-plan, 구현, 검증, 머지까지 한 턴에 끝낸다.

## Resume Context

- 현재 상태 요약: Plan AI 가 backlog PRD 에서 todo 티켓을 생성한 직후.
- 직전 작업: scripts/start-plan.sh 가 PRD 를 done 으로 보관하고 todo 티켓을 만들었다.
- 재개 시 먼저 볼 것: PRD, Goal, Allowed Paths, Done When.
- Planner guard evidence: `bin/autoflow guard` returned `error_count=0`, `warning_count=2` after this handoff. Existing cleanup candidates are `autoflow/tickets_119` leftover worktree without a board ticket and dirty done-ticket worktree `autoflow/tickets_163`; they are unrelated to this ticket and were left untouched.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_188/prd_188.md at 2026-05-05T01:42:58Z.
- Wiki context: `wiki/operations/runner-timing.md` shows recent long runner durations (`planner` p95 700000ms, `worker` p95 632000ms), so worker should avoid restoring the old 180초 destructive threshold.
- Prior ticket constraint: `tickets/done/prd_178/tickets_177.md` already implemented adapter-running heartbeat and `lastAdapterChunkAt` freshness; this ticket should only consume those signals in the desktop UI and not rework `packages/cli/run-role.sh`.
- Related policy note: `tickets/done/prd_185/prd_185.md` cites `order_159` for conservative stuck thresholds; keep the UI default aligned with 600초 without changing monitor behavior.

## Verification

- Run file:
- Log file:
- Result: pending

## Result

- Summary:
- Remaining risk:
