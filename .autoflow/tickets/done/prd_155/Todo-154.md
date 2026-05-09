# Ticket

## Ticket

- ID: Todo-154
- PRD Key: prd_155
- Plan Candidate: Plan AI handoff from tickets/done/prd_155/prd_155.md
- Title: idle tick input manifest LLM skip
- Stage: done
- AI: worker
- Claimed By: worker
- Execution AI: worker
- Verifier AI: worker
- Last Updated: 2026-05-03T12:49:15Z

## Goal

- 이번 작업의 목표: planner / worker / verifier runner 의 idle tick 입력 매니페스트 hash 를 비교해 입력이 변하지 않은 경우 adapter LLM 호출을 생략하고, state/log 에 `*_inputs_unchanged` 결과를 남긴다.

## References

- PRD: tickets/done/prd_155/prd_155.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_155]]
- Plan Note:
- Ticket Note: [[Todo-154]]

## Allowed Paths

- `packages/cli/run-role.sh`
- `.autoflow/scripts/start-plan.sh`
- `.autoflow/scripts/start-ticket-owner.sh`
- `.autoflow/scripts/start-verifier.sh`
- `.autoflow/scripts/common.sh`
- `packages/cli/README.md`
- `AGENTS.md`

## Worktree
- Path: `/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/Todo-154`
- Branch: autoflow/Todo-154
- Base Commit: de798df806ad0ce50e3deedaa7b9a54f4a2bed22
- Worktree Commit: 
- Integration Status: already_in_project_root

## Goal Runtime
- Status: complete
- Started At: 2026-05-03T12:44:56Z
- Started Epoch: 1777812296
- Updated At: 2026-05-03T12:49:16Z
- Tick Count: 3
- Time Used Seconds: 260
- Token Budget: 
- Tokens Used: 
- Continuation Suppressed: false
- Last Event: complete
- Last Progress Fingerprint: 4212696534

## Recovery State

- Status: healthy
- Detected By:
- Failure Class:
- Evidence:
- Planner Decision:
- Owner Resume Instruction:
- Last Recovery At:

## Done When

- [x] planner idle tick 에서 `tickets/inbox`, `tickets/backlog`, `tickets/reject`, `tickets/todo`, `tickets/inprogress`, `tickets/done` 입력 hash 가 직전 tick 과 같으면 adapter 호출 전 종료되고 runner state 에 `last_result=planner_inputs_unchanged`가 남는다.
- [x] worker/ticket-owner idle tick 에서 자기 입력 hash 가 직전 tick 과 같으면 adapter 호출 전 종료되고 runner state 에 `last_result=ticket_inputs_unchanged`가 남는다.
- [x] verifier idle tick 에도 같은 패턴이 적용되어 verifier 입력 변경 없음이 adapter 호출 전 종료되고 runner state/log 에 verifier 전용 `*_inputs_unchanged` 결과가 남는다.
- [x] 입력 파일이 추가/수정/삭제된 직후 첫 tick 은 LLM 호출을 정상 진행하고 새 fingerprint 를 기록한다.
- [x] hash 계산 실패, manifest read 실패, 명시적 수동 실행 같은 애매한 경우에는 skip 하지 않고 기존 LLM 호출로 fail-safe 동작한다.
- [x] skip 된 tick 은 runner log 에 `adapter_skip` 이벤트와 fingerprint 를 남기고, 1원칙에 맞게 다음 tick 에서 정상 재평가된다.
- [x] 24h 운영 후 idle skip 비율과 토큰 누계를 비교할 수 있도록 기존 telemetry/state 기록 경로를 깨지 않는다.
- [x] `npm run desktop:check` 통과.

## Next Action
- Complete: the inline merge finalizer integrated the AI-merged ticket, archived evidence, and prepared the local completion commit.

## Resume Context

- 현재 상태 요약: Plan AI 가 `prd_155`의 generic todo 티켓을 idle tick LLM skip 보강 범위로 좁혔다.
- 직전 작업: `.autoflow/scripts/start-plan.sh` 가 `source=backlog-to-todo`로 `Todo-154`를 생성했고, planner 가 `Allowed Paths`, 완료 조건, 검증 힌트를 구체화했다.
- 재개 시 먼저 볼 것: `tickets/done/prd_155/prd_155.md`, `packages/cli/run-role.sh`의 `idle_preflight_inputs_hash_stream`, `maybe_skip_unchanged_idle_preflight`, `wiki_inputs_hash_stream`, `.autoflow/scripts/start-verifier.sh`의 idle 출력 계약.
- Wiki/ticket constraints: wiki RAG는 관련 선례를 찾지 못했다(`result_count=0`). 현재 코드에는 planner/ticket `planner_inputs_unchanged`/`ticket_inputs_unchanged`와 wiki `wiki_inputs_unchanged` 경로가 이미 있으므로, 구현은 기존 telemetry/state/log 계약을 깨지 않는 보강으로 한정한다.
- Guard warning: `bin/autoflow guard . .autoflow` returned `error_count=0`, `warning.1=autoflow/Todo-119 has a ticket worktree but no board ticket: /Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/Todo-119`. Planner did not delete or reset that worktree.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_155/prd_155.md at 2026-05-03T12:25:54Z.
- Planner runtime: `.autoflow/scripts/start-plan.sh` returned `source=backlog-to-todo`, `todo_ticket=Todo-154.md`, `lint_status=warn`, `lint_vagueness_score=1`.
- Planner wiki pass: `bin/autoflow wiki query --term "idle tick LLM skip input manifest hash inputs_unchanged run-role start-plan start-ticket-owner start-verifier" --term "wiki_inputs_unchanged planner_inputs_unchanged ticket_inputs_unchanged verifier_inputs_unchanged" --term "packages/cli/run-role.sh .autoflow/scripts/start-plan.sh .autoflow/scripts/start-ticket-owner.sh .autoflow/scripts/common.sh" --limit 12 --rag` returned `result_count=0`.
- Code context: `packages/cli/run-role.sh` already contains `idle_preflight_inputs_hash_stream`, `maybe_skip_unchanged_idle_preflight`, `planner_inputs_unchanged`, `ticket_inputs_unchanged`, and the wiki-specific `wiki_inputs_unchanged` path. Preserve these names unless a verifier-specific state reason is added consistently.
- Scope decision: do not change runner topology, model selection, PRD/ticket generation semantics, or wiki synthesis policy. This ticket owns only input manifest skip mechanics, state/log evidence, and documentation.
- Planner guard pass: `bin/autoflow guard . .autoflow` returned `error_count=0`, `warning_count=1`; leftover `Todo-119` worktree is a cleanup candidate only.

- Runtime hydrated worktree dependency at 2026-05-03T12:44:55Z: linked apps/desktop/node_modules -> /Users/demoon2016/Documents/project/autoflow/apps/desktop/node_modules
- AI worker prepared todo at 2026-05-03T12:44:55Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/Todo-154; run=tickets/inprogress/verify_154.md
- Mini-plan (2026-05-03T21:46:29 KST): `run-role.sh`의 idle preflight가 planner/ticket만 `*_inputs_unchanged`로 skip 하므로 verifier 분기를 추가한다. 구현 범위는 verifier idle 입력 hash 대상 정의, `verifier_inputs_unchanged` state/log 기록, README 계약 보강으로 제한한다. Wiki 재조회는 선례 없음(`result_count=0`)으로 유지하되, 기존 `wiki_inputs_unchanged`/`planner_inputs_unchanged` 패턴을 그대로 재사용한다.
- AI worker prepared resume at 2026-05-03T12:45:31Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/Todo-154; run=tickets/inprogress/verify_154.md
- Implemented (2026-05-03T21:51:32 KST): `packages/cli/run-role.sh`에 verifier idle 입력 매니페스트(`tickets/verifier`), `verifier_inputs_unchanged` skip reason, `verifier:idle:no_unblocked_verification_ticket` unchanged gate 를 추가했다. 같은 변경을 `PROJECT_ROOT`에 수동 통합했고 `packages/cli/README.md`에 공통 idle preflight fingerprint 계약을 문서화했다.
- Verification (2026-05-03T21:51:32 KST): `PROJECT_ROOT`에서 `npm run desktop:check`가 exit 0으로 통과했다. 직접 loop runner 재현은 로컬 verifier adapter의 `sonnet-4.6` 접근 문제 때문에 skip 경로까지 자동 관찰하지 못했지만, 코드 경로와 state/log 기록 분기는 diff로 확인했다.
- Queued without worktree commit at 2026-05-03T12:49:14Z: PROJECT_ROOT already matches the ticket worktree for all Allowed Paths with code changes.
- Impl AI worker marked verification pass at 2026-05-03T12:49:14Z; runtime finalizer will not perform merge operations.
- Coordinator post-merge cleanup at 2026-05-03T12:49:15Z: removed_worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/Todo-154 deleted_branch=autoflow/Todo-154.
- Inline merge finalizer (worker worker) finalized this verified ticket at 2026-05-03T12:49:15Z.
## Verification
- Run file: `tickets/done/prd_155/verify_154.md`
- Log file: `logs/verifier_154_20260503_124916Z_pass.md`
- Result: passed

## Result

- Summary: verifier idle unchanged skip 보강
- Remaining risk: 실제 legacy verifier loop 환경에서 `verifier.state`/`verifier.log`에 `adapter_skip` 증거가 남는 운영 관찰은 아직 남아 있다. 로컬 worktree 복제본에서는 configured Claude model 접근 오류로 end-to-end idle skip 재현이 제한됐다.
