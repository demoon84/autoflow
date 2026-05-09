# Ticket

## Ticket

- ID: Todo-106
- PRD Key: prd_108
- Plan Candidate: Plan AI handoff from tickets/done/prd_108/prd_108.md
- Title: AI-led tool contract 1차 - thin CLI/script catalog
- Stage: done
- AI: worker
- Claimed By: worker
- Execution AI: worker
- Verifier AI: worker
- Last Updated: 2026-05-02T06:08:35Z

## Goal

- 이번 작업의 목표: planner/worker/wiki가 shell/runtime을 정책 엔진이 아니라 호출 가능한 thin tool 모음으로 다루도록, tool catalog entrypoint와 helper contract를 먼저 정리한다.

## References

- PRD: tickets/done/prd_108/prd_108.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_108]]
- Plan Note:
- Ticket Note: [[Todo-106]]

## Allowed Paths

- bin/autoflow
- packages/cli/run-role.sh
- runtime/board-scripts/common.sh
- .autoflow/scripts/common.sh
- runtime/board-scripts/start-plan.sh
- .autoflow/scripts/start-plan.sh
- runtime/board-scripts/run-role.sh
- .autoflow/agents/plan-to-ticket-agent.md
- .autoflow/agents/ticket-owner-agent.md
- .autoflow/protocols/board-orchestration.md
- .autoflow/protocols/recovery.md
- scaffold/board/agents/plan-to-ticket-agent.md
- scaffold/board/agents/ticket-owner-agent.md
- scaffold/board/protocols/board-orchestration.md
- scaffold/board/protocols/recovery.md
- tests/smoke/planner-orchestrator-recovery-wake-smoke.sh
- tests/smoke/ticket-owner-replan-smoke.sh
- tests/smoke/board-guard-recovery-protocol-sync-smoke.sh

## Worktree
- Path: `/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/Todo-106`
- Branch: autoflow/Todo-106
- Base Commit: de1a593c496407ce36b98dfe8017308fbb296aa9
- Worktree Commit: 
- Integration Status: already_in_project_root

## Goal Runtime
- Status: complete
- Started At: 2026-05-02T06:02:24Z
- Started Epoch: 1777701744
- Updated At: 2026-05-02T06:08:36Z
- Tick Count: 3
- Time Used Seconds: 372
- Token Budget: 
- Tokens Used: 
- Continuation Suppressed: false
- Last Event: complete
- Last Progress Fingerprint: 3494213591

## Recovery State

- Status: healthy
- Detected By:
- Failure Class:
- Evidence:
- Planner Decision:
- Owner Resume Instruction:
- Last Recovery At:

## Done When

- [x] thin tool 목록을 확인하는 안정된 entrypoint가 추가되거나 정리되어 planner/worker/wiki가 동일한 catalog를 볼 수 있다.
- [x] board/worktree/guard/wiki 관련 helper contract가 "정책 결정 없이 결과만 반환"하도록 코드/문서에서 드러난다.
- [x] `status`, `source`, `replan_skipped.*`, `failure_class`, `recovery_state`, `board_root`, `project_root` 출력 계약은 유지된다.
- [x] planner/worker agent/protocol 문서가 shell/runtime을 workflow brain으로 설명하지 않고 AI가 도구를 조합해 결정한다고 정렬된다.
- [x] 관련 smoke 또는 contract 검증이 통과한다.

## Next Action
- Complete: the inline merge finalizer integrated the AI-merged ticket, archived evidence, and prepared the local completion commit.

## Resume Context

- 현재 상태 요약: memo_062의 전체 구조 전환 요청은 매우 넓어서, planner는 이번 티켓을 thin tool catalog와 helper contract를 먼저 드러내는 1차 구현 슬라이스로 축소했다.
- 직전 작업: `bin/autoflow tool list`를 추가하고 helper/runtime contract 주석, planner/worker agent/protocol, scaffold mirror, smoke를 정렬했다. 워크트리와 `PROJECT_ROOT` 양쪽에서 `tool list`, `bash -n`, smoke 3종을 모두 통과시켰다.
- 재개 시 먼저 볼 것: `tickets/inprogress/verify_106.md`, `git status --short` 대상 파일, 그리고 `finish-ticket-owner pass` 결과의 done/log/commit evidence.

## Notes

- Created by planner (Plan AI) from tickets/inbox/memo_062.md at 2026-05-02T11:15:00Z.
- Planning constraint: `Todo-105`가 이미 memo_061의 문서/프롬프트 1차 정렬을 담당하므로, 이 티켓은 실제 tool entrypoint와 helper contract 쪽에 집중해야 한다.
- Planning constraint: `prd_106`이 retry limit과 recovery parser output 계약을 유지한 채 자동 복구를 좁게 추가했으므로, 이 티켓도 기존 runtime output을 깨지 않는 방향으로 진행해야 한다.
- Safety reminder: AI-led 원칙을 강화하더라도 `git push` 금지, destructive git 미추가, dirty-root/retry-limit safety boundary 유지가 선행 조건이다.
- Wiki context: `wiki/answers/autoflow-first-principle-and-tool-contract.md`, `wiki/answers/planner-worker-lifecycle-boundaries-20260502.md`, `wiki/answers/planner-recovery-automation-policy.md`, `wiki/answers/worker-isolation-and-retry-strategy.md`를 다시 확인했다. 이번 슬라이스는 shell 정책을 재설계하는 것이 아니라, planner/worker/wiki가 공통으로 볼 수 있는 thin tool catalog와 AI-owned decision boundary를 명시하는 데 집중해야 한다.
- Mini-plan:
  1. `bin/autoflow`에 안정된 `tool list` entrypoint를 추가하고 planner/worker/wiki가 공통으로 참조할 catalog를 노출한다.
  2. catalog 항목은 `start-plan`, `start-ticket-owner`, `verify-ticket-owner`, `finish-ticket-owner`, `guard`, `wiki query`, `run-role` 및 board/worktree helper contract를 "결정 없이 결과만 반환"하는 도구로 설명한다.
  3. planner/worker agent 및 board/recovery protocol 문서, scaffold mirror를 같은 wording으로 정렬하고 smoke로 회귀를 확인한다.

- Runtime hydrated worktree dependency at 2026-05-02T06:02:23Z: linked apps/desktop/node_modules -> /Users/demoon2016/Documents/project/autoflow/apps/desktop/node_modules
- AI worker prepared todo at 2026-05-02T06:02:22Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/Todo-106; run=tickets/inprogress/verify_106.md
- AI worker prepared resume at 2026-05-02T06:02:49Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/Todo-106; run=tickets/inprogress/verify_106.md
- Queued without worktree commit at 2026-05-02T06:08:34Z: PROJECT_ROOT already matches the ticket worktree for all Allowed Paths with code changes.
- Impl AI worker marked verification pass at 2026-05-02T06:08:34Z; runtime finalizer will not perform merge operations.
- Coordinator post-merge cleanup at 2026-05-02T06:08:35Z: removed_worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/Todo-106 deleted_branch=autoflow/Todo-106.
- Inline merge finalizer (worker worker) finalized this verified ticket at 2026-05-02T06:08:35Z.
## Verification
- Run file: `tickets/done/prd_108/verify_106.md`
- Log file: `logs/verifier_106_20260502_060836Z_pass.md`
- Result: passed

## Result

- Summary: thin tool catalog contract aligned
- Remaining risk: catalog는 현재 정적 key=value inventory이므로, 후속 단계에서 helper coverage가 늘어나면 항목 추가가 필요하다. 기존 key 이름은 parser 호환을 위해 유지해야 한다.
