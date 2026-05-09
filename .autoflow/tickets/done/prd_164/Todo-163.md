# Ticket

## Ticket

- ID: Todo-163
- PRD Key: prd_164
- Plan Candidate: Plan AI handoff from tickets/done/prd_164/prd_164.md
- Title: AI work for prd_164
- Stage: blocked
- AI: worker
- Claimed By: worker
- Execution AI: worker
- Verifier AI: worker
- Last Updated: 2026-05-03T22:28:01Z

## Goal

- 이번 작업의 목표: Implement the approved spec for prd_164.

## References

- PRD: tickets/done/prd_164/prd_164.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_164]]
- Plan Note:
- Ticket Note: [[Todo-163]]

## Allowed Paths

- `apps/desktop/src/renderer/main.tsx`
- `apps/desktop/src/renderer/styles.css`
- `apps/desktop/src/main.js`
- `apps/desktop/src/preload.js`
- `packages/cli/skill-project.sh`
- `packages/cli/cli.sh`
- `.autoflow/tickets/inprogress/Todo-163.md`
- `.autoflow/tickets/inprogress/verify_163.md`

## Worktree
- Path: `/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/Todo-163`
- Branch: autoflow/Todo-163
- Base Commit: 24b56a2fbd0fbefbd59db067c8190231936c82ac
- Worktree Commit: 
- Integration Status: blocked_dirty_project_root

## Goal Runtime
- Status: blocked
- Started At: 2026-05-03T22:28:04Z
- Started Epoch: 1777847284
- Updated At: 2026-05-04T00:20:15Z
- Tick Count: 0
- Time Used Seconds: 6731
- Token Budget: 
- Tokens Used: 
- Continuation Suppressed: true
- Last Event: ticket_stage_blocked
- Last Progress Fingerprint: 454911048

## Recovery State

- Status: needs_user
- Detected By: runtime
- Failure Class: leftover_worktree
- Evidence: planner wake-up reported active_recovery_reason=resolved_ticket_worktree_dirty for done ticket `tickets/done/prd_164/Todo-163.md`; worktree `/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/Todo-163` is dirty with unstaged paths `.autoflow/wiki/skills/skill_001.md`, `apps/desktop/src/main.js`, `apps/desktop/src/preload.js`, `apps/desktop/src/renderer/main.tsx`, `apps/desktop/src/renderer/vite-env.d.ts`, `bin/autoflow`, and `packages/cli/skill-project.sh`; staged diff is empty; wiki RAG query for `Todo-163 prd_164 leftover_worktree resolved_ticket_worktree_dirty skill hub self-refresh deadlock` returned result_count=0.
- Planner Decision: No safe board-only repair exists for a dirty leftover worktree attached to an already archived done ticket. Planner will not delete, reset, stash, or otherwise manage the worktree; preserve it as a cleanup candidate and allow other planner work to proceed.
- Owner Resume Instruction: Human or an explicit cleanup-capable owner should inspect the leftover worktree, salvage or discard the dirty files outside this planner turn, then remove/repair the worktree metadata so future planner ticks no longer surface `resolved_ticket_worktree_dirty`.
- Last Recovery At: 2026-05-04T00:30:02Z

## Done When

- [ ] 사이드바에 "스킬" 메뉴 추가, 클릭 시 페이지 정상 동작.
- [ ] in-repo / agent-created / archived skill 모두 목록에 표시 (탭 또는 필터로 분리).
- [ ] 각 skill 카드에 통계 (success_rate, last_used_at) 표시.
- [ ] 본문 미리보기 (markdown render + frontmatter 메타).
- [ ] Pin / Archive / Restore / Edit / Disable 액션 모두 동작 (백엔드 파일 시스템 반영).
- [ ] Pin 토글한 skill 이 Curator (Phase 2) lifecycle transition 에서 우회됨.
- [ ] Disable 한 skill 이 매칭 (Phase 3) 에서 제외됨.
- [ ] 빈 상태 안내 정상 노출.
- [ ] 좁은 viewport 회귀 없음.
- [ ] `npm run desktop:check` 통과.

## Next Action
- Park this archived ticket as `needs_user` for leftover dirty worktree cleanup; planner must not delete/reset the worktree or call owner/finalizer helpers from this recovery turn.

## Resume Context

- 현재 상태 요약: Plan AI 가 backlog PRD 에서 todo 티켓을 생성한 직후.
- 직전 작업: scripts/start-plan.sh 가 PRD 를 done 으로 보관하고 todo 티켓을 만들었다.
- 재개 시 먼저 볼 것: PRD, Goal, Allowed Paths, Done When.
- Planner recovery note (2026-05-04T00:30:02Z): ticket is archived under `tickets/done/prd_164/` with `## Manual Resolution`, but runtime still detects dirty leftover worktree `/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/Todo-163`. Treat the worktree as human/cleanup-owner evidence, not as active implementation state.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_164/prd_164.md at 2026-05-03T13:07:02Z.

- Runtime hydrated worktree dependency at 2026-05-03T14:40:10Z: linked apps/desktop/node_modules -> /Users/demoon2016/Documents/project/autoflow/apps/desktop/node_modules
- AI worker prepared todo at 2026-05-03T14:40:09Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/Todo-163; run=tickets/inprogress/verify_163.md

- Mini-plan (2026-05-03):
  1. CLI 확장 (`packages/cli/skill-project.sh`, `packages/cli/cli.sh`) — `pin`/`unpin`/`disable`/`enable`/`restore` subcommand 추가, `list` 출력에 `disabled`/`description`/`pattern_type` 노출, `match` 가 `disabled: true` skill 을 제외, archive refusal 동일 처리.
  2. Desktop 백엔드 (`apps/desktop/src/main.js`, `preload.js`) — `autoflow:listSkills`, `autoflow:viewSkill`, `autoflow:controlSkill` (action: pin/unpin/archive/restore/disable/enable/edit), `autoflow:writeSkillBody` IPC 추가. autoflow CLI 호출 + `.autoflow/wiki/skills*` 경로 가드.
  3. Desktop 렌더러 (`apps/desktop/src/renderer/main.tsx`) — `settingsNavigation` 에 `skills` 추가, `SkillsHubPage` 컴포넌트 신설 (탭/필터/검색/카드 목록 + 우측 markdown 미리보기 + 액션 버튼). MarkdownViewer 재사용.
  4. 스타일 (`apps/desktop/src/renderer/styles.css`) — 좁은 viewport 대응 grid + 카드/뱃지 스타일.
  5. 검증: `npm run desktop:check` 통과 + 수동 smoke (skill list/view/pin/disable/archive/restore round-trip).
- 위험: skill 파일 frontmatter 갱신은 atomic write 로 처리 (tmp + rename). archived skill 의 disabled toggle 은 허용하지 않음.
- Curator pin 우회 검증: 기존 `archive_only_for_agent_created` + `pinned_skill_bypasses_lifecycle` 분기 유지 (skill-project.sh:858).
- Runtime auto-blocked: dirty_project_root_conflict at 2026-05-03T14:50:51Z; dirty_paths=.autoflow/tickets/inprogress/Todo-163.md, .autoflow/tickets/inprogress/verify_163.md
- Planner blocked-dirty orchestration at 2026-05-04: integrated dirty paths into 3 local commits (0ddc0f8 group A: Todo-163 todo→inprogress + verify_163; a759ecb group B: Todo-162 refresh; d99cc62 group C: misc housekeeping = check records, prd_168/prd_169 archives, telemetry, runner-health wiki, order_149 inbox, Todo-167/168 todos). Working tree now clean for this ticket's Allowed Paths. Awaiting blocked-auto-recover on next planner tick.
- Planner blocked-dirty orchestration at 2026-05-04T01:00:00Z: bundled telemetry/runs.jsonl + Todo-163.md refresh + check_065/check_066 records into commit a718c12. git status clean afterward.
- Planner blocked-dirty orchestration at 2026-05-03T23:55:45Z: wiki RAG returned result_count=0; committed ticket runtime metadata as 6fcaf9f and telemetry/wiki/check housekeeping as e22b70d. Awaiting blocked-auto-recover on the next planner tick if PROJECT_ROOT remains clean.
- Guard after planner cleanup returned warning-only: `autoflow/Todo-119` has a leftover ticket worktree without a board ticket. Planner did not delete or reset the worktree; this remains cleanup evidence for a separate recovery turn.
- Planner blocked-dirty orchestration at 2026-05-04T01:30:00Z: bundled telemetry/runs.jsonl + Todo-163.md refresh + check_067/check_068 records into commit 7fecfe8. Allowed Paths clean afterward; residual wiki dirt (.autoflow/wiki/operations/runner-health.md) is Wiki AI's lane and outside this ticket's scope.
- Planner blocked-dirty orchestration at 2026-05-04T02:00:00Z: bundled telemetry/runs.jsonl + Todo-163.md refresh + check_079/check_080 records into a single PRD_164/ticket_163 cleanup commit. Recurring telemetry churn is expected until worker Goal Runtime status clears.
- Planner blocked-dirty orchestration at 2026-05-04T02:30:00Z: bundled telemetry/runs.jsonl + Todo-163.md refresh + check_085/check_086 records into commit ea30cb6 ([PRD_164][ticket_163] orchestration cleanup: telemetry + ticket runtime + check ledger). git status clean afterward.
- Planner blocked-dirty orchestration at 2026-05-04T03:00:00Z: bundled telemetry/runs.jsonl + Todo-163.md refresh + check_093/check_094 records into [PRD_164][ticket_163] cleanup commit; bundled wiki/runner-health.md + inbox/order_151.md into [ticket_163] misc housekeeping commit. order_151 reports the underlying self-refresh deadlock and will be promoted to PRD/todo on a subsequent planner tick.
- Planner blocked-dirty orchestration at 2026-05-04T03:30:00Z: bundled telemetry/runs.jsonl + Todo-163.md refresh + check_103/check_104 records into commit 4aa1cc9 ([PRD_164][ticket_163] orchestration cleanup: telemetry + ticket markdown + check ledger). git status clean for this ticket's Allowed Paths afterward.
- Planner blocked-dirty orchestration at 2026-05-04T04:00:00Z: bundled telemetry/runs.jsonl + Todo-163.md refresh + check_105/check_106 records into a [PRD_164][ticket_163] orchestration cleanup commit. Recurring telemetry churn continues while worker Goal Runtime stays blocked.
- Planner blocked-dirty orchestration at 2026-05-04T04:30:00Z: bundled telemetry/runs.jsonl + Todo-163.md refresh + check_109 record into a [PRD_164][ticket_163] orchestration cleanup commit. Recurring churn persists while worker Goal Runtime remains blocked.
- Planner blocked-dirty orchestration at 2026-05-04T05:00:00Z: Todo-163.md refresh into commit f123087 ([PRD_164][ticket_163] orchestration cleanup: ticket markdown timestamp refresh); telemetry/runs.jsonl + check_123 + check_124 into commit dbfcb23 ([ticket_163] orchestration cleanup: misc housekeeping (3 paths)). Allowed Paths clean afterward; residual dirty wiki paths are Wiki AI scope.
- Planner blocked-dirty orchestration at 2026-05-04T05:30:00Z: Todo-163.md refresh into commit 73fd63d ([PRD_164][ticket_163] orchestration cleanup: ticket markdown refresh); telemetry/runs.jsonl + wiki/operations/runner-health.md + check_125 + check_126 into commit 9f8d55e ([ticket_163] orchestration cleanup: misc housekeeping (4 paths)). Runtime-listed dirty paths clean afterward; residual dirty wiki paths (runner-timing.md, prompt-evolution.md) are Wiki AI scope.
- Planner blocked-dirty orchestration at 2026-05-04T06:00:00Z: Todo-163.md refresh into [PRD_164][ticket_163] orchestration cleanup commit; telemetry/runs.jsonl + check_135 + check_136 into [ticket_163] orchestration cleanup misc housekeeping commit. Allowed Paths clean afterward.
- Planner blocked-dirty orchestration at 2026-05-04T06:30:00Z: Todo-163.md refresh into [PRD_164][ticket_163] orchestration cleanup commit; telemetry/runs.jsonl + wiki/index.md + check_142/143/144 + wiki-raw/prd_169 + wiki/sources/prd_169 into [ticket_163] misc housekeeping commit. Wiki paths listed by runtime are bundled per blocked-dirty default-integrate rule; underlying ticket remains blocked while worker Goal Runtime hasn't cleared.
- Planner blocked-dirty orchestration at 2026-05-03T23:27:24Z: telemetry/runs.jsonl + check_149/check_150 into commit 37bdc90 ([ticket_163] orchestration cleanup: misc housekeeping (6 paths)); Todo-163.md runtime refresh is being recorded in the paired PRD_164/ticket_163 cleanup commit. Wiki query for `Todo-163 dirty_root runner-health runner-timing prompt-evolution telemetry runs check_149` returned result_count=0, so no prior wiki constraint changed this recovery decision.
- Planner blocked-dirty orchestration at 2026-05-03T23:31:12Z: runtime-listed misc paths were bundled into commit 3cca588 ([ticket_163] orchestration cleanup: misc housekeeping (6 paths)); this ticket markdown records the paired PRD_164/ticket_163 recovery decision. Wiki query returned result_count=0, so no prior wiki constraint changed this recovery decision.
- Guard warning at 2026-05-03T23:31:12Z: `autoflow guard` reported orphan worktree cleanup candidate `/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/Todo-119` with no board ticket. Planner did not delete or reset it; this remains human/owner cleanup evidence.
- Planner blocked-dirty orchestration at 2026-05-03T23:35:43Z: runtime-listed misc paths were bundled into commit 33a35c9 ([ticket_163] orchestration cleanup: misc housekeeping (6 paths)); this ticket markdown refresh is being recorded in the paired PRD_164/ticket_163 cleanup commit. Wiki RAG queries for order_149/order_150/order_151 root-cause terms returned result_count=0, so no prior wiki constraint changed this recovery decision.
- Planner blocked-dirty orchestration at 2026-05-03T23:39:18Z: runtime-listed misc paths were bundled into commit a16e4fb ([ticket_163] orchestration cleanup: misc housekeeping (5 paths)); this ticket markdown refresh is being recorded in the paired PRD_164/ticket_163 cleanup commit. Wiki RAG query returned result_count=33 and confirmed related prd_143 check-ledger helper, desktop-runner-terminal-streaming answer, and prd_150 safety-kernel context; these support recording check evidence and not managing runner/processes, but do not change the rule 13a integrate decision.
- Post-guard telemetry append at 2026-05-03T23:39:18Z: runtime-listed `.autoflow/telemetry/runs.jsonl` received one verifier event during this tick and was integrated as commit cc58de1 ([ticket_163] orchestration cleanup: telemetry append). Residual `.autoflow/wiki/index.md` dirt is outside the runtime dirty list and remains Wiki AI scope.
- Planner blocked-dirty orchestration at 2026-05-03T23:43:54Z: runtime-listed misc paths `.autoflow/telemetry/runs.jsonl`, `.autoflow/wiki/index.md`, `.autoflow/wiki/project-overview.md`, and `.autoflow/tickets/check/check_157.md` were bundled into commit 92f7411 ([ticket_163] orchestration cleanup: misc housekeeping (4 paths)). Wiki RAG query returned result_count=0, so no prior wiki constraint changed this recovery decision. This ticket markdown refresh is being recorded in the paired PRD_164/ticket_163 cleanup commit.
- Planner blocked-dirty orchestration at 2026-05-03T23:48:03Z: runtime-listed misc paths `.autoflow/telemetry/runs.jsonl`, `.autoflow/wiki/agents/prompt-evolution.md`, `.autoflow/wiki/operations/runner-health.md`, `.autoflow/wiki/operations/runner-timing.md`, `.autoflow/wiki/project-overview.md`, `.autoflow/tickets/check/check_159.md`, and check file `.autoflow/tickets/check/check_160.md` were bundled into commit ca53fb4 ([ticket_163] orchestration cleanup: misc housekeeping (7 paths)). Wiki RAG query returned result_count=0, so no prior wiki constraint changed this recovery decision. This ticket markdown refresh is being recorded in the paired PRD_164/ticket_163 cleanup commit.
- Planner blocked-dirty orchestration at 2026-05-03T23:51:49Z: runtime-listed misc paths `.autoflow/telemetry/runs.jsonl`, `.autoflow/tickets/check/check_161.md`, and check file `.autoflow/tickets/check/check_162.md` were bundled into commit 66ed32d ([ticket_163] orchestration cleanup: misc housekeeping (3 paths)). Wiki RAG query returned result_count=0, so no prior wiki constraint changed this recovery decision. This ticket markdown refresh is being recorded in the paired PRD_164/ticket_163 cleanup commit.
- Planner blocked-dirty orchestration at 2026-05-03T23:59:32Z: runtime-listed misc paths `.autoflow/telemetry/runs.jsonl`, `.autoflow/tickets/check/check_165.md`, and check file `.autoflow/tickets/check/check_166.md` were bundled into commit b113e8b ([ticket_163] orchestration cleanup: misc housekeeping (3 paths)). Wiki RAG query returned result_count=0; grep context only confirmed existing telemetry/check-ledger contracts (`prd_121`, `prd_123`, `prd_143`, `prd_150`, `prd_168`) and did not change the rule 13a integrate decision. This ticket markdown refresh is being recorded in the paired PRD_164/ticket_163 cleanup commit.
- Planner blocked-dirty orchestration at 2026-05-04T00:01:20Z: follow-up runtime dirty set named wiki telemetry synthesis paths and check file `.autoflow/tickets/check/check_167.md`; check ledger evidence was committed as a79cce5. The wiki paths had no net content diff by commit time, while new telemetry/ticket runtime appends are being recorded in the paired PRD_164/ticket_163 cleanup commit. Guard remained warning-only for orphan worktree `autoflow/Todo-119`; planner did not delete or reset it.
- Planner blocked-dirty orchestration at 2026-05-04T00:05:01Z: runtime-listed misc paths `.autoflow/telemetry/runs.jsonl`, `.autoflow/wiki/agents/prompt-evolution.md`, `.autoflow/wiki/operations/runner-health.md`, `.autoflow/wiki/operations/runner-timing.md`, `.autoflow/tickets/check/check_168.md`, and check file `.autoflow/tickets/check/check_169.md` were bundled into commit efac438 ([ticket_163] orchestration cleanup: misc housekeeping (6 paths)). Wiki RAG query returned result_count=0, so no prior wiki constraint changed this recovery decision. This ticket markdown refresh is being recorded in the paired PRD_164/ticket_163 cleanup commit.
- Planner blocked-dirty orchestration follow-up at 2026-05-04T00:06:22Z: post-cleanup telemetry/wiki summary churn stayed within the runtime-listed dirty path set and was integrated as commits acb546e, 949403d, 0f49888, and 9aea869; ticket Goal Runtime refresh was committed as 82fad5a. `autoflow guard` returned warning-only for orphan worktree `autoflow/Todo-119`; planner did not delete or reset it.
- Planner blocked-dirty orchestration at 2026-05-04T00:09:43Z: runtime-listed misc paths `.autoflow/telemetry/runs.jsonl`, auto-generated wiki telemetry summaries, and check ledger files `check_170.md`/`check_171.md` were bundled into commit a6c5198 ([ticket_163] orchestration cleanup: misc housekeeping (6 paths)); this ticket recovery refresh is recorded in the paired PRD_164/ticket_163 cleanup commit. Wiki RAG query returned result_count=0, so no prior wiki constraint changed the rule 13a integrate decision.

- Auto-recovery at 2026-05-03T22:28:00Z: dirty_project_root_conflict cleared; ticket returned to todo for fresh claim.
- Blocked stale todo worktree at 2026-05-03T22:28:01Z: /Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/Todo-163 still has unmerged or dirty state, so the runtime refused to reuse it silently.
- Planner blocked-dirty orchestration at 2026-05-04T00:13:46Z: runtime-listed misc paths `.autoflow/telemetry/runs.jsonl`, `.autoflow/tickets/check/check_172.md`, and check file `.autoflow/tickets/check/check_173.md` were bundled into commit a6a7eb7 ([ticket_163] orchestration cleanup: misc housekeeping (3 paths)). Wiki RAG query returned result_count=0, so no prior wiki constraint changed the rule 13a integrate decision. This ticket markdown refresh is recorded in the paired PRD_164/ticket_163 cleanup commit.
- Planner blocked-dirty orchestration at 2026-05-04T00:17:35Z: runtime-listed misc paths `.autoflow/telemetry/runs.jsonl`, `.autoflow/wiki/agents/prompt-evolution.md`, `.autoflow/wiki/operations/runner-health.md`, `.autoflow/wiki/operations/runner-timing.md`, `.autoflow/tickets/check/check_174.md`, and check file `.autoflow/tickets/check/check_175.md` were bundled into commit 7901167 ([ticket_163] orchestration cleanup: misc housekeeping (6 paths)). Wiki RAG queries returned result_count=0, so no prior wiki constraint changed the rule 13a integrate decision. This ticket markdown refresh is recorded in the paired PRD_164/ticket_163 cleanup commit.
- Planner recovery at 2026-05-04T00:30:02Z: active recovery changed from PROJECT_ROOT dirty orchestration to `resolved_ticket_worktree_dirty` on archived ticket `Todo-163`. Worktree dirty paths are preserved as evidence; no board-only repair is safe, so Recovery State is parked as `needs_user` / `leftover_worktree`. `start-plan.sh` returned `status=idle reason=no_actionable_plan_input`; wiki RAG returned `result_count=0`.
## Verification
- Run file: `tickets/inprogress/verify_163.md`
- Log file: pending
- Result: pending ticket-owner by worker

## Result

- Summary:
- Remaining risk:


## Manual Resolution

- Resolved At: 2026-05-04T00:20:55Z
- Resolution: 사용자 명시 요청으로 manual mitigate. self-refresh dirty deadlock / needs_user / cleanup live-lock 으로 자율 회복 불가 → done/prd_164/ 로 archive.
- Notes: 17 orders (121-151) 발행 완료. order_151 (worker self-refresh deadlock fix) 머지 후 재실행 권장.
