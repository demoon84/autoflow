# Ticket

## Ticket

- ID: tickets_159
- PRD Key: prd_160
- Plan Candidate: Plan AI handoff from tickets/done/prd_160/prd_160.md
- Title: autoflow learned skill registry phase 1
- Stage: done
- Priority: high
- AI: worker
- Claimed By: worker
- Execution AI: worker
- Verifier AI: worker
- Last Updated: 2026-05-03T13:15:50Z

## Goal

- 이번 작업의 목표: 완료된 Autoflow 작업에서 재사용 가능한 실행 패턴을 `skill` markdown으로 추출하고, 이후 Phase 2의 prompt/RAG 주입이 사용할 수 있는 기본 저장소와 CLI 명령을 만든다.

## References

- PRD: tickets/done/prd_160/prd_160.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_160]]
- Plan Note:
- Ticket Note: [[tickets_159]]

## Allowed Paths

- `packages/cli/skill-project.sh`
- `bin/autoflow`
- `packages/cli/README.md`
- `.autoflow/wiki/skills/`
- `scaffold/board/wiki/skills/`
- `.autoflow/scripts/finish-ticket-owner.sh`
- `runtime/board-scripts/finish-ticket-owner.sh`
- `.autoflow/agents/ticket-owner-agent.md`
- `scaffold/board/agents/ticket-owner-agent.md`
- `AGENTS.md`
- `scaffold/host/AGENTS.md`

## Worktree
- Path: `/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_159`
- Branch: autoflow/tickets_159
- Base Commit: b0c98a128e4a800663de0c2691dfa2c2124f4678
- Worktree Commit: 
- Integration Status: already_in_project_root

## Goal Runtime
- Status: complete
- Started At: 2026-05-03T13:06:15Z
- Started Epoch: 1777813575
- Updated At: 2026-05-03T13:15:51Z
- Tick Count: 3
- Time Used Seconds: 576
- Token Budget: 
- Tokens Used: 
- Continuation Suppressed: false
- Last Event: complete
- Last Progress Fingerprint: 2937645076

## Recovery State

- Status: healthy
- Detected By:
- Failure Class:
- Evidence:
- Planner Decision:
- Owner Resume Instruction:
- Last Recovery At:

## Done When

- [x] `.autoflow/wiki/skills/README.md`, `.autoflow/wiki/skills/skill-template.md`, `.autoflow/wiki/skills/.gitkeep`가 생성되고, 같은 구조가 `scaffold/board/wiki/skills/`에도 반영된다.
- [x] `bin/autoflow skill create "$PWD" .autoflow --from-ticket tickets/done/prd_151/tickets_150.md`가 exit 0으로 끝나고 `.autoflow/wiki/skills/skill_NNN.md` 형식의 파일을 생성한다.
- [x] 생성된 `skill_NNN.md`에는 `title`, `pattern_type`, `applies_to`, `keywords`, `success_count`, `failure_count`, `last_used_at`, `created_from`, `created_at`, `enabled` frontmatter와 `## Trigger`, `## Recommended Procedure`, `## Pitfalls`, `## Verification Pattern`, `## Source Evidence` 섹션이 있다.
- [x] `bin/autoflow skill match "$PWD" .autoflow --keywords "selfHeal runner cache"`가 exit 0으로 끝나고 match 점수, skill id, title을 key=value 또는 표 형태로 출력한다.
- [x] `bin/autoflow skill update-stats "$PWD" .autoflow <skill_NNN> --result pass`가 exit 0으로 끝나고 해당 skill의 `success_count`와 `last_used_at`를 갱신한다.
- [x] `AUTOFLOW_SKILL_AUTO_EXTRACT=off .autoflow/scripts/finish-ticket-owner.sh <ticket-id> pass "<summary>"` 경로에서는 skill auto-extraction을 건너뛰는 guard가 존재한다는 것을 static check로 확인할 수 있다.
- [x] `finish-ticket-owner.sh`의 skill auto-extraction 실패는 pass/finalization 결과를 실패로 바꾸지 않고 warning evidence만 남기는 구조다.
- [x] `packages/cli/run-role.sh`, `.autoflow/scripts/start-plan.sh`, `.autoflow/scripts/start-ticket-owner.sh`, `.autoflow/scripts/common.sh`는 이번 티켓에서 수정하지 않아 현재 진행 중인 `tickets_154`의 idle input manifest 작업과 Allowed Paths가 겹치지 않는다.
- [x] `npm run desktop:check` 통과.

## Next Action
- Complete: the inline merge finalizer integrated the AI-merged ticket, archived evidence, and prepared the local completion commit.

## Resume Context

- 현재 상태 요약: Plan AI 가 `order_146`을 `prd_160`과 `tickets_159`로 승격했다. 작업은 Hermes self-learning loop 중 Phase 1, 즉 skill 저장소/CLI/완료 후 best-effort 추출 trigger까지만 포함한다.
- 직전 작업: `.autoflow/scripts/start-plan.sh` first returned `source=order-inbox`, `order_id=146`; after generated PRD creation, `.autoflow/scripts/start-plan.sh 160` returned `source=backlog-to-todo`, `lint_status=ok`, `lint_vagueness_score=0`.
- 재개 시 먼저 볼 것: `tickets/done/prd_160/prd_160.md`, `packages/cli/wiki-project.sh`의 CLI argument/style 패턴, `bin/autoflow`의 subcommand dispatch, `.autoflow/scripts/finish-ticket-owner.sh`와 `runtime/board-scripts/finish-ticket-owner.sh`의 pass finalization 경계.
- Wiki/ticket constraints: wiki RAG는 직접 관련 결과 0건이었다. `tickets/done/prd_129/prd_129.md`는 향후 skill 효과 측정 source인 token telemetry 선례이고, `tickets/done/prd_157/prd_157.md`/`tickets/done/prd_158/prd_158.md`는 후속 prompt 주입/토큰 절감 시너지일 뿐 Phase 1 의존성은 아니다. `tickets/done/prd_143/order_135.md`의 `check_NNN.md` 패턴은 markdown ledger 선례로 참고하되, 이번 티켓은 `.autoflow/wiki/skills/` registry에만 집중한다.
- Active queue constraint: `tickets/inprogress/tickets_154.md` owns `packages/cli/run-role.sh`, `.autoflow/scripts/start-plan.sh`, `.autoflow/scripts/start-ticket-owner.sh`, `.autoflow/scripts/start-verifier.sh`, and `.autoflow/scripts/common.sh`; this ticket must not edit those paths. `order_145` remains in `tickets/inbox/` for a later planner tick.
- Guard warning: `bin/autoflow guard . .autoflow` returned `error_count=0`, `warning_count=1`; leftover `autoflow/tickets_119` worktree at `/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_119` is a cleanup candidate only. Planner did not delete or reset that worktree.
- 이번 tick 계획: worker가 직접 `skill create/match/update-stats` 저장소와 완료 후 auto-extract plumbing을 구현한다. wiki query 재실행은 현재 환경에서 응답이 지연됐고, 신규 hit를 확보하지 못했으므로 planner가 남긴 `result_count=0` 제약과 관련 done-ticket 선례만 계획 근거로 유지한다.
- Owner mini-plan at 2026-05-03T13:20:00Z: 1) `packages/cli/wiki-project.sh`와 `bin/autoflow` 패턴을 따라 `packages/cli/skill-project.sh` 및 `skill` subcommand를 추가한다. 2) `.autoflow/wiki/skills/`와 `scaffold/board/wiki/skills/` 저장소/템플릿을 만들고, `finish-ticket-owner.sh` 양쪽 경로에 `AUTOFLOW_SKILL_AUTO_EXTRACT` guard + warning-only best-effort 호출을 넣는다. 3) 문서/agent 정책을 갱신한 뒤 `skill create/match/update-stats`와 `npm run desktop:check`로 검증한다.
- Implementation evidence (worker, 2026-05-03T13:14:32Z): `packages/cli/skill-project.sh`가 `create`, `match`, `update-stats`를 제공하고, `bin/autoflow` dispatch/CLI README/skill registry templates/agent docs/finish finalizer guard가 모두 연결되었다.
- Verification evidence (worker, 2026-05-03T13:14:32Z): acceptance command를 ticket worktree와 PROJECT_ROOT에서 모두 직접 실행해 exit 0을 확인했다. 최신 registry artifact는 `.autoflow/wiki/skills/skill_003.md`이며 required frontmatter와 섹션을 포함한다.
- Static guard evidence (worker, 2026-05-03T13:14:32Z): `.autoflow/scripts/finish-ticket-owner.sh`와 `runtime/board-scripts/finish-ticket-owner.sh` 모두 `AUTOFLOW_SKILL_AUTO_EXTRACT=off` skip 경로와 `skill_auto_extract.status=warning` warning-only 경로를 가진다.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_160/prd_160.md at 2026-05-03T12:50:09Z.
- Planner runtime: `.autoflow/scripts/start-plan.sh` first returned `source=order-inbox`, `order_id=146`; after generated PRD creation, `.autoflow/scripts/start-plan.sh 160` returned `source=backlog-to-todo`, `todo_ticket=tickets_159.md`, `lint_status=ok`, `lint_vagueness_score=0`.
- Planner wiki pass: `bin/autoflow wiki query --term "Hermes self learning skill auto-extraction RAG injection closed loop wiki skills" --term "wiki learnings answers skill create skill match finish-ticket-owner auto-extraction" --term "PRD 158 prompt caching PRD 157 reasoning dynamic PRD 129 token aggregation order_135 check_NNN" --limit 12 --rag` returned `result_count=0`.
- Scope decision: do not implement prompt RAG injection, Desktop skill UI, semantic embeddings, planner-side reject/blocked skill extraction, or managed wiki baseline rewrites in this ticket. Keep implementation to Phase 1 storage/CLI/completion-trigger plumbing.
- Conflict decision: active `tickets_154` owns runner input manifest files, so this ticket intentionally excludes `packages/cli/run-role.sh`, `.autoflow/scripts/start-plan.sh`, `.autoflow/scripts/start-ticket-owner.sh`, `.autoflow/scripts/start-verifier.sh`, and `.autoflow/scripts/common.sh`.
- Planner guard pass: `bin/autoflow guard . .autoflow` returned `status=warning`, `error_count=0`, `warning_count=1`; unresolved warning is the existing `tickets_119` leftover worktree with no board ticket.

- Runtime hydrated worktree dependency at 2026-05-03T13:06:14Z: linked apps/desktop/node_modules -> /Users/demoon2016/Documents/project/autoflow/apps/desktop/node_modules
- AI worker prepared todo at 2026-05-03T13:06:13Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_159; run=tickets/inprogress/verify_159.md
- AI worker prepared resume at 2026-05-03T13:06:50Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_159; run=tickets/inprogress/verify_159.md
- Queued without worktree commit at 2026-05-03T13:15:49Z: PROJECT_ROOT already matches the ticket worktree for all Allowed Paths with code changes.
- Impl AI worker marked verification pass at 2026-05-03T13:15:49Z; runtime finalizer will not perform merge operations.
- Coordinator post-merge cleanup at 2026-05-03T13:15:50Z: removed_worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_159 deleted_branch=autoflow/tickets_159.
- Inline merge finalizer (worker worker) finalized this verified ticket at 2026-05-03T13:15:50Z.
## Verification
- Run file: `tickets/done/prd_160/verify_159.md`
- Log file: `logs/verifier_159_20260503_131551Z_pass.md`
- Result: passed

## Result

- Summary: learned skill registry CLI and auto-extract guard
- Remaining risk: Phase 1은 deterministic keyword matching과 best-effort extraction까지만 포함하므로, skill dedupe/ranking 개선과 prompt/RAG injection은 후속 PRD에서 이어서 다뤄야 한다.
