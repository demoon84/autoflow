# Ticket

## Ticket

- ID: Todo-057
- PRD Key: prd_055
- Plan Candidate: Plan AI handoff from tickets/done/prd_055/prd_055.md
- Title: PRD and ticket Korean writing policy
- Stage: done
- AI: worker-1
- Claimed By: worker-1
- Execution AI: worker-1
- Verifier AI: worker-1
- Last Updated: 2026-04-29T21:40:01Z

## Goal

- 이번 작업의 목표: 앞으로 생성되는 Autoflow PRD, plan, ticket, 사용자 친화 memo 본문은 한국어로 작성하되, parser가 읽는 섹션명, 필드명, key=value 출력, 경로, 명령어, 코드, ticket id, project key 같은 기계 판독 형식은 기존 포맷을 유지하도록 live board와 scaffold 지침 및 템플릿을 갱신한다.

## References

- PRD: tickets/done/prd_055/prd_055.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Obsidian Links

- Project Note: [[prd_055]]
- Plan Note:
- Ticket Note: [[Todo-057]]

## Allowed Paths

- `AGENTS.md`
- `CLAUDE.md`
- `.autoflow/AGENTS.md`
- `.autoflow/agents/spec-author-agent.md`
- `.autoflow/agents/plan-to-ticket-agent.md`
- `.autoflow/agents/ticket-owner-agent.md`
- `.autoflow/reference/ticket-template.md`
- `.autoflow/reference/project-spec-template.md`
- `.autoflow/reference/feature-spec-template.md`
- `.autoflow/reference/plan-template.md`
- `scaffold/board/agents/spec-author-agent.md`
- `scaffold/board/agents/plan-to-ticket-agent.md`
- `scaffold/board/agents/ticket-owner-agent.md`
- `scaffold/board/reference/ticket-template.md`
- `scaffold/board/reference/project-spec-template.md`
- `scaffold/board/reference/feature-spec-template.md`
- `scaffold/board/reference/plan-template.md`

## Worktree
- Path: `/Users/demoon2016/Documents/project/.autoflow-worktrees/autoflow/Todo-057`
- Branch: autoflow/Todo-057
- Base Commit: 9c654614f03334f26c5a0b134a6c67e76ff8a826
- Worktree Commit:
- Integration Status: already_in_project_root

## Done When

- [x] `AGENTS.md`, `CLAUDE.md`, `.autoflow/AGENTS.md`가 새 PRD/ticket/plan/사용자 친화 memo 본문은 한국어로 작성한다는 정책을 설명한다.
- [x] `.autoflow/agents/spec-author-agent.md`, `.autoflow/agents/plan-to-ticket-agent.md`, `.autoflow/agents/ticket-owner-agent.md`가 PRD와 ticket 사람이 읽는 본문을 한국어로 쓰도록 지시한다.
- [x] live board templates의 placeholder/설명 문장은 한국어 작성 기준을 반영하되 `## Project`, `## Ticket`, `Goal`, `Allowed Paths`, `Done When`, `Verification` 같은 parser-sensitive keys는 유지한다.
- [x] scaffold board의 agent 지침과 templates도 live board와 같은 언어 정책을 반영한다.
- [x] historical done tickets/logs/wiki를 대량 변경하지 않는다.
- [x] 새 정책이 `autoflow` runtime parsing, ticket id, project key, Allowed Paths 해석, verification command 형식을 깨지 않는다.

## Next Action
- Complete: the inline merge finalizer integrated the AI-merged ticket, archived evidence, and prepared the local completion commit.

## Resume Context

- 현재 상태 요약: worker-1이 허용 문서 17개에 한국어 PRD/plan/ticket/memo 작성 정책을 반영했고, 같은 변경을 `PROJECT_ROOT`에 수동 통합한 뒤 host-root verification을 통과시켰다.
- 직전 작업: `./bin/autoflow doctor .`, scoped `git diff --check`, scoped `rg` review를 중앙 루트에서 실행해 pass로 판단했다.
- 재개 시 먼저 볼 것: `tickets/inprogress/verify_057.md`, `git diff -- AGENTS.md CLAUDE.md .autoflow/AGENTS.md .autoflow/agents .autoflow/reference scaffold/board/agents scaffold/board/reference`.

## Notes

- Created by planner-1 (Plan AI) from tickets/done/prd_055/prd_055.md at 2026-04-29T21:16:38Z.
- Wiki query context: exact Korean/PRD/ticket language-policy terms returned `result_count=0`, then the broader query `language policy`, `ticket-template`, `project-spec-template` returned relevant history.
- Relevant finding: `tickets/done/prd_039/prd_039.md` and `tickets/done/prd_039/Todo-039.md` show the current preservation pattern: change user-visible wording while keeping internal ids and parser-sensitive fields backward-compatible.
- Relevant finding: `.autoflow/wiki/decisions/prd-terminology-rename.md` says PRD terminology was renamed while file/directory names, internal keys, and function names stayed unchanged; use the same compatibility rule for Korean PRD/ticket prose.
- Relevant finding: `tickets/done/prd_027/prd_027.md` preserved Korean user-facing copy during the MUI migration, so this work should update writing policy without changing lifecycle or UI behavior.
- Verification hints from PRD: run `./bin/autoflow doctor .`; run `git diff --check -- AGENTS.md CLAUDE.md .autoflow/AGENTS.md .autoflow/agents .autoflow/reference scaffold/board/agents scaffold/board/reference`; review scoped language-policy matches with `rg`.
- Mini-plan:
  1. Update host and board guidance so generated PRD/plan/ticket/user-friendly memo prose defaults to Korean while parser-sensitive keys, ids, paths, commands, code, and key=value formats remain unchanged.
  2. Update live agent instructions and templates with Korean prose expectations and Korean placeholder examples, preserving section headers and field names used by runtime parsing.
  3. Mirror the same policy and template wording into `scaffold/board/...`.
  4. Verify with `./bin/autoflow doctor .`, scoped `git diff --check`, and `rg` review.
- Wiki context shaping plan: `tickets/done/prd_039/Todo-039.md` and `wiki/decisions/prd-terminology-rename.md` reinforce the compatibility pattern: change user-visible wording only, preserve internal ids/keys/file names.

- Runtime hydrated worktree dependency at 2026-04-29T21:33:13Z: linked apps/desktop/node_modules -> /Users/demoon2016/Documents/project/autoflow/apps/desktop/node_modules
- AI worker-1 prepared todo at 2026-04-29T21:33:12Z; worktree=/Users/demoon2016/Documents/project/.autoflow-worktrees/autoflow/Todo-057; run=tickets/inprogress/verify_057.md
- AI worker-1 prepared resume at 2026-04-29T21:33:49Z; worktree=/Users/demoon2016/Documents/project/.autoflow-worktrees/autoflow/Todo-057; run=tickets/inprogress/verify_057.md
- Note: `verify-ticket-owner.sh` was invoked as an evidence helper and attempted worktree-local doctor, which failed with exit 127 against the temporary worktree board. AI-led verification was rerun and judged from `PROJECT_ROOT`, where the PRD command is intended to run.
- Implementation completed by worker-1: updated host guidance, live board agent instructions/templates, and scaffold mirrors to default generated PRD/plan/ticket/user-friendly memo prose to Korean while preserving parser-sensitive keys and runtime formats.
- Verification completed by worker-1 after AI-led merge into `PROJECT_ROOT`: `./bin/autoflow doctor .` passed with `status=ok`, `git diff --check` passed, and scoped `rg` review confirmed the policy coverage.
- Queued without worktree commit at 2026-04-29T21:40:00Z: PROJECT_ROOT already matches the ticket worktree for all Allowed Paths with code changes.
- Impl AI worker-1 marked verification pass at 2026-04-29T21:40:00Z; runtime finalizer will not perform merge operations.
- Inline merge finalizer (worker worker-1) finalized this verified ticket at 2026-04-29T21:40:01Z.
- Coordinator post-merge cleanup at 2026-04-29T21:40:01Z: removed_worktree=/Users/demoon2016/Documents/project/.autoflow-worktrees/autoflow/Todo-057 deleted_branch=autoflow/Todo-057.
## Verification
- Run file: `tickets/done/prd_055/verify_057.md`
- Log file: `logs/verifier_057_20260429_214002Z_pass.md`
- Result: passed

## Result

- Summary: PRD, plan, ticket, and user-friendly memo prose now default to Korean while parser-sensitive Autoflow keys and runtime formats stay unchanged.
- Remaining risk: none identified; `doctor` still reports unrelated existing conversation handoff warnings.
