# Ticket

## Ticket

- ID: Todo-145
- PRD Key: prd_146
- Plan Candidate: Plan AI handoff from tickets/done/prd_146/prd_146.md
- Title: order create priority field and order skill inference
- Stage: done
- AI: worker
- Claimed By: worker
- Execution AI: worker
- Verifier AI: worker
- Last Updated: 2026-05-03T11:47:13Z

## Goal

- 이번 작업의 목표: `autoflow order create`와 `/order` 계열 스킬이 order 본문에 `Priority:` 필드를 표준으로 남겨 queue priority sorting이 입력 단계부터 같은 메타데이터를 사용할 수 있게 한다.

## References

- PRD: tickets/done/prd_146/prd_146.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_146]]
- Plan Note:
- Ticket Note: [[Todo-145]]

## Allowed Paths

- `packages/cli/order-project.sh`
- `.claude/skills/order/SKILL.md`
- `.codex/skills/order/SKILL.md`
- `integrations/claude/skills/order/SKILL.md`
- `integrations/codex/skills/order/SKILL.md`

## Worktree
- Path: `/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/Todo-145`
- Branch: autoflow/Todo-145
- Base Commit: c749a7106d1f5b4842e90629bed6845a6037efba
- Worktree Commit: 
- Integration Status: already_in_project_root

## Goal Runtime
- Status: complete
- Started At: 2026-05-03T11:43:42Z
- Started Epoch: 1777808622
- Updated At: 2026-05-03T11:47:14Z
- Tick Count: 3
- Time Used Seconds: 212
- Token Budget: 
- Tokens Used: 
- Continuation Suppressed: false
- Last Event: complete
- Last Progress Fingerprint: 1452564914

## Recovery State

- Status: healthy
- Detected By:
- Failure Class:
- Evidence:
- Planner Decision:
- Owner Resume Instruction:
- Last Recovery At:

## Done When

- [x] `packages/cli/order-project.sh create` accepts `--priority critical`, `--priority high`, `--priority normal`, and `--priority low`, and rejects any other value before writing an order file.
- [x] A CLI-created order with `--priority critical` contains exactly one `- Priority: critical` line in the `## Order` section, directly after `- Status: inbox`.
- [x] A CLI-created order without `--priority` contains exactly one `- Priority: normal` line in the `## Order` section, directly after `- Status: inbox`.
- [x] `.claude/skills/order/SKILL.md`, `.codex/skills/order/SKILL.md`, `integrations/claude/skills/order/SKILL.md`, and `integrations/codex/skills/order/SKILL.md` describe when to pass `--priority critical`, `--priority high`, and when to omit the flag for `normal`.
- [x] The order skill guidance states that explicit user priority wins over automatic keyword inference.
- [x] Implementation stays inside the Allowed Paths.
- [x] `bash -lc 'bash -n packages/cli/order-project.sh && tmp="$(mktemp -d)" && trap "rm -rf \"$tmp\"" EXIT && bin/autoflow init "$tmp" .autoflow >/dev/null && bin/autoflow order create "$tmp" .autoflow --title "test critical" --request "body" --priority critical >/dev/null && grep -q "^- Priority: critical$" "$tmp/.autoflow/tickets/inbox/order_001.md" && bin/autoflow order create "$tmp" .autoflow --title "test normal" --request "body" >/dev/null && grep -q "^- Priority: normal$" "$tmp/.autoflow/tickets/inbox/order_002.md" && if bin/autoflow order create "$tmp" .autoflow --title "bad" --request "body" --priority bogus >/tmp/autoflow-priority-bogus.out 2>/tmp/autoflow-priority-bogus.err; then exit 1; fi && npm run desktop:check'` exits 0.

## Next Action
- Complete: the inline merge finalizer integrated the AI-merged ticket, archived evidence, and prepared the local completion commit.

## Resume Context

- 현재 상태 요약: Plan AI 가 `order_138`을 `prd_146`과 `Todo-145`로 승격했다.
- 직전 작업: `.autoflow/scripts/start-plan.sh 146`이 `prd_146`을 `tickets/done/prd_146/prd_146.md`로 보관하고 `tickets/todo/Todo-145.md`를 만들었다.
- 재개 시 먼저 볼 것: `tickets/done/prd_146/prd_146.md`, `packages/cli/order-project.sh`의 option parsing과 `## Order` 출력 블록, `.claude/skills/order/SKILL.md`, `.codex/skills/order/SKILL.md`, `integrations/claude/skills/order/SKILL.md`, `integrations/codex/skills/order/SKILL.md`.
- Wiki/ticket constraints: wiki RAG command failed with exit 128 (`fork: Resource temporarily unavailable`) during planner context pass. Use `tickets/done/prd_145/prd_145.md` as the relevant ticket boundary: queue priority sorting belongs to `Todo-144`; this ticket owns only input-side priority metadata and skill guidance.
- 현재 상태 요약: 구현과 worktree/root 검증이 통과했고, 검증된 Allowed Paths 다섯 파일이 `PROJECT_ROOT`에 수동 반영됐다. `tickets/inprogress/verify_145.md`에 evidence를 기록했다.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_146/prd_146.md at 2026-05-03T11:34:43Z.
- Planner runtime: `.autoflow/scripts/start-plan.sh` first returned `source=order-inbox`, `order_id=138`; after PRD creation, `.autoflow/scripts/start-plan.sh 146` returned `source=backlog-to-todo`, `lint_status=ok`, `lint_vagueness_score=0`.
- Planner wiki pass: `bin/autoflow wiki query --term "autoflow order create priority critical high normal low order skill input standard" --term "priority order PRD todo verify list_matching_files extract_priority_rank" --term "resource exhaustion DOS fork-bomb priority critical order input" --term "order_138 order create priority field" --limit 12 --rag` exited 128 after `fork: Resource temporarily unavailable`; no RAG result was available.
- Relevant prior ticket: `tickets/done/prd_145/prd_145.md` explicitly left `autoflow order create --priority` and `/order` priority auto-assignment out of scope while implementing priority-aware queue selection; do not edit `.autoflow/scripts/common.sh`, `start-plan.sh`, `start-ticket-owner.sh`, `start-verifier.sh`, or desktop priority sorting for this ticket.
- Relevant active ticket: `tickets/inprogress/Todo-143.md` owns Desktop `listRunners` IPC fork-bomb cleanup; do not edit `apps/desktop/src/main.js` or `packages/cli/runners-project.sh` for this ticket.
- Related pending order: `tickets/inbox/order_140.md` also touches order CLI/skills for format normalization and `## Request` duplication, but that broader format cleanup is intentionally out of scope here.
- Guard warning after planner creation: `bin/autoflow guard . .autoflow` returned `status=warning`, `error_count=0`, `warning.1=autoflow/Todo-119 has a ticket worktree but no board ticket: /Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/Todo-119`. This is a cleanup candidate only; planner did not delete or reset the worktree.

- Runtime hydrated worktree dependency at 2026-05-03T11:43:41Z: linked apps/desktop/node_modules -> /Users/demoon2016/Documents/project/autoflow/apps/desktop/node_modules
- AI worker prepared todo at 2026-05-03T11:43:40Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/Todo-145; run=tickets/inprogress/verify_145.md
- AI worker prepared resume at 2026-05-03T11:44:04Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/Todo-145; run=tickets/inprogress/verify_145.md
- Owner mini-plan at 2026-05-03T11:44:46Z:
  - Re-ran `start-ticket-owner.sh`; it returned `status=resume`, `source=resume`, `worktree_status=ready`, and `implementation_root=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/Todo-145`.
  - Wiki pass was started with the ticket priority/order terms; prior durable ticket context already identifies `tickets/done/prd_145/prd_145.md` as the boundary that owns queue sorting while this ticket owns only input-side order metadata.
  - Implement only within Allowed Paths: add `--priority critical|high|normal|low` validation and default `normal` output to `packages/cli/order-project.sh`, then document critical/high/normal inference and explicit-priority precedence in all four order skill files.
  - Verification plan: run the ticket command from the worktree, inspect generated order files for line count and placement, then merge the verified Allowed Paths into `PROJECT_ROOT` and rerun the same command there before finish.
- Owner verification at 2026-05-03T11:46:24Z:
  - Wiki RAG returned `tickets/done/prd_146/prd_146.md`, `tickets/done/prd_145/prd_145.md`, and `tickets/done/prd_145/Todo-144.md`; these confirmed the current PRD and the boundary that queue sorting is already owned by `prd_145` / `Todo-144`.
  - Worktree command exited 0: `bash -lc 'bash -n packages/cli/order-project.sh && tmp="$(mktemp -d)" && trap "rm -rf \"$tmp\"" EXIT && bin/autoflow init "$tmp" .autoflow >/dev/null && bin/autoflow order create "$tmp" .autoflow --title "test critical" --request "body" --priority critical >/dev/null && grep -q "^- Priority: critical$" "$tmp/.autoflow/tickets/inbox/order_001.md" && bin/autoflow order create "$tmp" .autoflow --title "test normal" --request "body" >/dev/null && grep -q "^- Priority: normal$" "$tmp/.autoflow/tickets/inbox/order_002.md" && if bin/autoflow order create "$tmp" .autoflow --title "bad" --request "body" --priority bogus >/tmp/autoflow-priority-bogus.out 2>/tmp/autoflow-priority-bogus.err; then exit 1; fi && npm run desktop:check'`.
  - Additional smoke accepted all valid priorities (`critical`, `high`, `normal`, `low`) and rejected `bogus`; line-placement check found exactly one `Priority:` line directly after `Status` for both critical and default-normal orders.
  - Project-root command exited 0 after manual integration. `npm run desktop:check` completed with the existing Vite chunk-size warning only.
- Queued without worktree commit at 2026-05-03T11:47:12Z: PROJECT_ROOT already matches the ticket worktree for all Allowed Paths with code changes.
- Impl AI worker marked verification pass at 2026-05-03T11:47:12Z; runtime finalizer will not perform merge operations.
- Coordinator post-merge cleanup at 2026-05-03T11:47:13Z: removed_worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/Todo-145 deleted_branch=autoflow/Todo-145.
- Inline merge finalizer (worker worker) finalized this verified ticket at 2026-05-03T11:47:13Z.
## Verification
- Run file: `tickets/done/prd_146/verify_145.md`
- Log file: `logs/verifier_145_20260503_114714Z_pass.md`
- Result: passed

## Result

- Summary: order create priority metadata and skill guidance
- Remaining risk: Existing Vite build chunk-size warning remains unrelated to this ticket.
