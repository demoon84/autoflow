# Ticket

## Ticket

- ID: Todo-200
- PRD Key: prd_201
- Plan Candidate: Plan AI handoff from tickets/done/prd_201/prd_201.md
- Title: Todo-NNN ticket filename migration
- Priority: normal
- Stage: executing
- AI: worker
- Claimed By: worker
- Execution AI: worker
- Verifier AI:
- Last Updated: 2026-05-08T06:40:36Z

## Goal

- 이번 작업의 목표: 새 todo ticket 발행, ticket owner/runtime 처리, desktop 표시, scaffold 문서, 그리고 현재 보드의 기존 ticket markdown 파일명을 `Todo-NNN.md` 규칙으로 일관되게 전환한다.

## References

- PRD: tickets/done/prd_201/prd_201.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_201]]
- Plan Note:
- Ticket Note: [[Todo-200]]

## Allowed Paths

- `.autoflow/scripts/`
- `runtime/board-scripts/`
- `bin/autoflow`
- `apps/desktop/src/renderer/main.tsx`
- `apps/desktop/src/main.js`
- `AGENTS.md`
- `.autoflow/README.md`
- `.autoflow/AGENTS.md`
- `.autoflow/agents/`
- `.autoflow/protocols/`
- `.autoflow/reference/`
- `.autoflow/rules/`
- `.autoflow/automations/`
- `.autoflow/runners/config.toml`
- `scaffold/board/`
- `.autoflow/tickets/todo/`
- `.autoflow/tickets/inprogress/`
- `.autoflow/tickets/done/`
- `tests/`
- `package.json`
- `apps/desktop/package.json`

## Worktree
- Path: `/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/Todo-200`
- Branch: autoflow/Todo-200
- Base Commit: 8d568ab9428ddecdb3d08bf0329e5ec954f8692e
- Worktree Commit: 
- Integration Status: pending

## Goal Runtime
- Status: active
- Started At: 2026-05-08T06:36:26Z
- Started Epoch: 1778222186
- Updated At: 2026-05-08T06:40:37Z
- Tick Count: 5
- Time Used Seconds: 251
- Token Budget: 
- Tokens Used: 
- Continuation Suppressed: false
- Last Event: resume
- Last Progress Fingerprint: 1463412460

## Recovery State

- Status: healthy
- Detected By:
- Failure Class:
- Evidence:
- Planner Decision:
- Owner Resume Instruction:
- Last Recovery At:

## Done When

- [ ] `.autoflow/scripts/start-plan.sh`와 `runtime/board-scripts/start-plan.sh`가 새 todo를 `Todo-NNN.md` 파일, `ID: Todo-NNN`, `Ticket Note: [[Todo-NNN]]`으로 생성한다.
- [ ] `.autoflow/tickets/todo/`, `.autoflow/tickets/inprogress/`, `.autoflow/tickets/done/` 아래 `find ... -name 'Todo-*.md'` 결과가 0건이고, 기존 ticket markdown의 `ID: tickets_`, `[[Todo-`, `tickets/done/<key>/Todo-`, `tickets/todo/Todo-`, `tickets/inprogress/Todo-` 참조가 `Todo-` 규칙으로 갱신된다.
- [ ] `start-ticket-owner.sh`, `finish-ticket-owner.sh`, `merge-ready-ticket.sh`, `common.sh`, `run-role.sh`, `runners-project.sh`, `doctor-project.sh`, `metrics-project.sh`, `package-board-common.sh`, `watch-board.sh`, `check-stop.sh`, `handoff-todo.sh`, `update-wiki.sh`의 installed copy와 `runtime/board-scripts/` mirror가 `Todo-*.md` active ticket files를 찾고 처리한다.
- [ ] ticket worktree/branch naming이 새 filename contract와 충돌하지 않는다. 유지가 필요한 legacy branch prefix가 있다면 source comment와 smoke evidence가 그 이유를 명시한다.
- [ ] `apps/desktop/src/renderer/main.tsx`와 `apps/desktop/src/main.js`가 `Todo-NNN.md`를 ticket board file로 분류하고, display label/status/detail/moved-ticket mapping에서 `Todo-NNN`을 ticket으로 유지한다.
- [ ] `scaffold/board/`, `.autoflow/README.md`, `.autoflow/AGENTS.md`, `AGENTS.md`, `.autoflow/agents/`, `.autoflow/protocols/`, `.autoflow/reference/`, `.autoflow/rules/`, `.autoflow/automations/`의 ticket filename contract 예시가 `Todo-NNN` 기준으로 갱신된다.
- [ ] tests/smoke fixture가 `Todo-NNN.md` 기준으로 갱신되고, migration 또는 compatibility smoke가 새 todo 발행, 기존 ticket rename, owner claim/resume/finalizer lookup 중 최소 한 경로를 검증한다.
- [ ] `bash -lc 'find . -path "./.git" -prune -o -path "./node_modules" -prune -o -path "./apps/desktop/node_modules" -prune -o -name "*.sh" -print0 | xargs -0 -n1 bash -n && npm run desktop:check && bin/autoflow metrics && bin/autoflow doctor'` exits 0.

## Next Action
- 다음에 바로 이어서 할 일: 한 owner 가 mini-plan, 구현, 검증, 증거 기록, done 이동까지 이어서 처리한다.

## Resume Context

- 현재 상태 요약: Plan AI 가 backlog PRD 에서 todo 티켓을 생성한 직후.
- 직전 작업: scripts/start-plan.sh 가 `prd_201`을 done 으로 보관하고 `Todo-200.md` todo 티켓을 만들었다. `lint_status=ok`, `lint_vagueness_score=0`.
- 재개 시 먼저 볼 것: `tickets/done/prd_201/prd_201.md`, `.autoflow/scripts/start-plan.sh`, `.autoflow/scripts/common.sh`, `.autoflow/scripts/start-ticket-owner.sh`, `runtime/board-scripts/run-role.sh`, `apps/desktop/src/renderer/main.tsx`, `scaffold/board/`, 그리고 현재 `.autoflow/tickets/`의 기존 `Todo-*.md` 파일 목록.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_201/prd_201.md at 2026-05-08T06:18:39Z.
- Planner wiki pass: `bin/autoflow wiki query --term "Todo-NNN Todo-NNN ticket filename rule desktop scripts scaffold runtime board" --rag` returned `result_count=0`; 이번 migration은 source grep과 기존 done ticket 근거를 기준으로 진행한다.
- Owner wiki pass: `bin/autoflow wiki query --term "Todo-NNN Todo-NNN ticket filename migration desktop scripts scaffold runtime board" --rag` returned `result_count=0`; prior `prd_084` display-only storage decision is treated as superseded by `prd_201`.
- Mini-plan: update shared ticket path/id helpers to emit `Todo-NNN` while accepting legacy `Todo-NNN`; update planner/owner/finalizer/watch/desktop/script mirrors to use `Todo-*.md`; migrate existing board ticket files and internal references after runtime lookup compatibility is in place; refresh docs/scaffold/tests and run the required verification plus explicit `find ... -name 'Todo-*.md'` evidence.
- Related prior ticket: `tickets/done/prd_084/prd_084.md`는 desktop 표시 label만 바꾸고 storage filename `Todo-NNN.md`는 유지하는 범위였다. 이번 order는 storage filename 전환을 명시하므로 그 제약을 supersede한다.
- Source finding: grep found core `tickets_` dependencies in `.autoflow/scripts/common.sh`, `.autoflow/scripts/start-plan.sh`, `.autoflow/scripts/start-ticket-owner.sh`, `.autoflow/scripts/finish-ticket-owner.sh`, `.autoflow/scripts/merge-ready-ticket.sh`, `runtime/board-scripts/run-role.sh`, `runtime/board-scripts/runners-project.sh`, `apps/desktop/src/renderer/main.tsx`, `scaffold/board/`, and many `tests/smoke/` fixtures.
- Current board finding: before promotion there were 179 `Todo-*.md` files under `.autoflow/tickets/`, including `.autoflow/tickets/todo/Todo-198.md` and `.autoflow/tickets/inprogress/Todo-199.md`. Single-worker execution should serialize implementation, but the migration ticket must handle its own active ticket path after runtime lookup compatibility is in place.

- Runtime hydrated worktree dependency at 2026-05-08T06:36:25Z: linked apps/desktop/node_modules -> /Users/demoon2016/Documents/project/autoflow/apps/desktop/node_modules
- Runtime hydrated worktree dependency at 2026-05-08T06:36:25Z: linked node_modules -> /Users/demoon2016/Documents/project/autoflow/node_modules
- AI worker prepared todo at 2026-05-08T06:36:25Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/Todo-200
- AI worker prepared resume at 2026-05-08T06:40:36Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/Todo-200
## Verification
- Result: pending ticket-owner by worker

## Result

- Summary:
- Remaining risk:


## Manual Closure Note

- 2026-05-08 manual cancel by user (단순화 결정).
- 사유: codex usage limit until 2026-05-12, 그리고 모든 ticket 파일 + 모든 board script + desktop UI + scaffold 동시 rename 은 한 ticket으로 다루기엔 너무 큼.
- 권장 재발행: 한도 복구 후 `#order` 로 작은 단위 (1) script rename, (2) UI rename, (3) scaffold mirror 로 분할 발행.
- Stage: cancelled (manual)
