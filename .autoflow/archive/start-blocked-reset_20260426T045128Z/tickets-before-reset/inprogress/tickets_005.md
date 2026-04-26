# Ticket

## Ticket

- ID: tickets_005
- PRD Key: prd_005
- Plan Candidate: Direct ticket-owner handoff from tickets/done/prd_005/prd_005.md
- Title: AI work for prd_005
- Stage: blocked
- AI: AI-5
- Claimed By: AI-5
- Execution AI: AI-5
- Verifier AI: AI-5
- Last Updated: 2026-04-26T04:48:15Z

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
- Path:
- Branch:
- Base Commit: 07a05bb0162134d69c2a2d0c4960de327fd3d587
- Worktree Commit:
- Integration Status: project_root_fallback

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
- Runtime wait: shared Allowed Paths are already held by lower-number in-progress ticket(s): tickets_001:apps/desktop/src/renderer/main.tsx, tickets_002:apps/desktop/src/renderer/main.tsx, tickets_003:apps/desktop/src/renderer/main.tsx, tickets_004:apps/desktop/src/renderer/main.tsx. Retry automatically when blockers clear.

## Resume Context

- 현재 상태 요약: backlog spec 에서 ticket-owner 가 직접 생성한 inprogress 티켓.
- 직전 작업: scripts/start-ticket-owner.sh 로 spec 을 보관하고 티켓을 생성.
- 재개 시 먼저 볼 것: Project Spec, Goal, Allowed Paths, Done When, Notes.

## Notes

- Created by AI-5 from tickets/done/prd_005/prd_005.md at 2026-04-26T04:47:27Z.

- Runtime auto-blocked: shared_allowed_path_conflict at 2026-04-26T04:47:27Z; blockers=tickets_001:apps/desktop/src/renderer/main.tsx, tickets_002:apps/desktop/src/renderer/main.tsx, tickets_003:apps/desktop/src/renderer/main.tsx, tickets_004:apps/desktop/src/renderer/main.tsx
## Verification

- Run file:
- Log file:
- Result: pending

## Result

- Summary:
- Remaining risk:
