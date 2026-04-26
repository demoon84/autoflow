# Ticket

## Ticket

- ID: tickets_005
- PRD Key: prd_005
- Plan Candidate: Direct ticket-owner handoff from tickets/done/prd_005/prd_005.md
- Title: Ticket owner work for prd_005
- Stage: rejected
- Owner: owner-3
- Claimed By: owner-3
- Execution Owner: owner-3
- Verifier Owner: owner-3
- Last Updated: 2026-04-26T01:07:19Z

## Goal

- 이번 작업의 목표: Implement the approved spec for prd_005.

## References

- PRD: tickets/done/prd_005/prd_005.md
- Feature Spec:
- Plan Source: direct-ticket-owner

## Obsidian Links

- Project Note: [[prd_005]]
- Plan Note:
- Ticket Note: [[tickets_005]]

## Allowed Paths

- apps/desktop/src/renderer/main.tsx
- AGENTS.md
- CLAUDE.md
- README.md
- bin/autoflow
- bin/autoflow.ps1
- packages/cli/spec-project.sh
- packages/cli/spec-project.ps1
- .autoflow/agents
- .autoflow/reference
- scaffold/board/AGENTS.md
- scaffold/board/README.md
- scaffold/board/agents
- scaffold/board/reference
- .claude/skills
- .codex/skills
- integrations/claude/skills
- integrations/codex/skills

## Worktree
- Path: `/Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_005`
- Branch: autoflow/tickets_005
- Base Commit: aadf973ec6300c5a964baf012491b90dd88f0b68
- Worktree Commit:
- Integration Status: pending

## Done When

- [ ] `autoflow prd create /path/to/project --title "X"` 가 `autoflow spec create` 와 동일한 결과를 만든다 (status=created).
- [ ] `autoflow spec create` 는 변경 후에도 그대로 동작한다 (legacy alias).
- [ ] `autoflow help` 출력에 `autoflow prd ...` 가 1순위로 노출되고 `autoflow spec ...` 는 legacy alias 로 함께 표시된다.
- [ ] 데스크톱 UI 의 사용자 노출 라벨/툴팁/카운트 표현에서 "스펙" / "spec" 단어가 사라지고 "PRD" 로 대체된다 (코드 내부 변수명·머신 키 제외).
- [ ] `.autoflow/agents/*.md` 6개 모두 본문에서 산출물을 가리키는 "spec" 표현이 "PRD" 로 정렬되며, 파일명·`spec-handoff`·`start-spec.sh` 같은 식별자는 그대로 유지된다.
- [ ] `AGENTS.md`, `CLAUDE.md`, `README.md` 의 사용자/개발자 가이드 본문에서 산출물 명칭이 "PRD" 로 통일된다.
- [ ] `reference/project-spec-template.md` / `reference/feature-spec-template.md` 의 1행 제목이 `# Project PRD` / `# Feature PRD` 로 변경되고 섹션 키(`## Meta` 등) 는 동일하다.
- [ ] `tickets/backlog/project_NNN.md` 파일명·디렉터리 구조·머신 출력 키(spec_id, spec_count 등) 변경 없음.
- [ ] `scaffold/board/` 미러가 `.autoflow/` 변경분과 `diff -q` 동일하다.
- [ ] `cd apps/desktop && npx tsc --noEmit` exit 0.
- [ ] `cd apps/desktop && node scripts/check-syntax.mjs` exit 0.
- [ ] `bash tests/smoke/ticket-owner-smoke.sh` exit 0 (기존 spec 명령 흐름이 깨지지 않음을 확인).

## Next Action
- reject 처리됨: Reject Reason 을 기준으로 재작업 범위를 정한다.

## Resume Context

- 현재 상태 요약: owner-3 가 resume 했고 worktree `/Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_005` 에서 구현 예정.
- 직전 작업: `scripts/start-ticket-owner.sh` 로 resume 확인, 현재 repo 구조와 ticket Allowed Paths/spec path drift 를 점검했다.
- 재개 시 먼저 볼 것: `bin/autoflow`, `bin/autoflow.ps1`, 실제 CLI 위임 경로(`scripts/cli/*`), desktop renderer PRD 라벨, `.autoflow/` 와 `scaffold/board/` 미러 문서.

## Notes

- Created by owner-3 from tickets/done/prd_005/prd_005.md at 2026-04-26T00:59:28Z.

- Ticket owner owner-3 prepared spec at 2026-04-26T00:59:28Z; worktree=/Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_005; run=tickets/inprogress/verify_005.md
- Mini-plan at 2026-04-26T01:15:00Z:
  1. Align the ticket with the current repo layout: keep edits inside the intent of Allowed Paths, but use the live CLI/runtime paths (`scripts/cli/*`) where the current repo moved shell entrypoints.
  2. Add `autoflow prd` as the primary user-facing alias while preserving `autoflow spec` behavior and machine-readable outputs.
  3. Replace user-facing "spec / 스펙" wording with "PRD" across the desktop UI, board docs, host docs, and mirrored skill/docs without renaming identifiers or file paths.
  4. Verify with the required desktop/smoke commands plus a focused `autoflow help` / `autoflow prd create` spot check, then finish pass or fail with evidence.

- Observation at 2026-04-26T01:15:00Z: `autoflow wiki query` is not available in the current CLI build; `autoflow help` lists only `wiki update|lint`. Prior done tickets exist, so the main durable prior context remains the archived `prd_005.md`.
- Ticket owner owner-3 prepared resume at 2026-04-26T01:05:59Z; worktree=/Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_005; run=tickets/inprogress/verify_005.md
- Ticket owner verification failed at 2026-04-26T01:07:01Z: command exited 1
- Ticket owner owner-3 marked fail at 2026-04-26T01:07:19Z.
## Verification
- Run file: `tickets/reject/verify_005.md`
- Log file: `logs/verifier_005_20260426_010719Z_fail.md`
- Result: failed

## Result

- Summary:
- Remaining risk:

## Reject Reason

- Verification environment drift: worktree lacks a runnable TypeScript compiler for 'cd apps/desktop && npx tsc --noEmit' and the required smoke path 'tests/smoke/ticket-owner-smoke.sh' does not exist in the ticket worktree. Replan the ticket against the current repo layout before implementation.
