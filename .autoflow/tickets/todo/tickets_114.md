# Ticket

## Ticket

- ID: tickets_114
- PRD Key: prd_098
- Plan Candidate: Plan AI handoff from tickets/done/prd_098/prd_098.md
- Title: AI work for prd_098
- Stage: todo
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated: 2026-05-02T10:17:09Z

## Goal

- 이번 작업의 목표: Implement the approved spec for prd_098.

## References

- PRD: tickets/done/prd_098/prd_098.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_098]]
- Plan Note:
- Ticket Note: [[tickets_114]]

## Allowed Paths

- packages/cli/memo-project.sh
- bin/autoflow
- .codex/skills/order/SKILL.md
- .claude/skills/order/SKILL.md
- integrations/codex/skills/order/SKILL.md
- integrations/claude/skills/order/SKILL.md
- scaffold/board/README.md
- scaffold/board/AGENTS.md
- scaffold/board/reference/memo.md
- scaffold/board/agents/plan-to-ticket-agent.md
- scaffold/board/automations/README.md
- scaffold/host/AGENTS.md
- scaffold/host/CLAUDE.md
- README.md
- CLAUDE.md
- packages/cli/README.md
- apps/desktop/src/renderer/main.tsx

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

## Recovery State

- Status: healthy
- Detected By:
- Failure Class:
- Evidence:
- Planner Decision:
- Owner Resume Instruction:
- Last Recovery At:

## Done When

- [ ] 사용자 노출 양성 wording 검사 — `rg -n "autoflow order|order_NNN|# Autoflow Order|## Order" bin packages/cli .codex/skills/order .claude/skills/order integrations/codex/skills/order integrations/claude/skills/order scaffold/board scaffold/host README.md CLAUDE.md apps/desktop/src/renderer/main.tsx` 가 1 건 이상의 매치를 반환한다 (exit 0).
- [ ] 사용자 노출 음성 wording 검사 — `rg -n "Autoflow Memo|^## Memo|memo path|quick memo|this memo|memo intake|autoflow memo create|memo_NNN" bin packages/cli .codex/skills/order .claude/skills/order integrations/codex/skills/order integrations/claude/skills/order scaffold/board scaffold/host README.md CLAUDE.md apps/desktop/src/renderer/main.tsx` 가 단 1 건도 매치하지 않는다 (rg exit 1, 따라서 `! rg ...` 가 exit 0).
- [ ] `packages/cli/memo-project.sh` 실행 결과 (`autoflow order create` 호출) 로 생성된 inbox 파일 본문이 `# Autoflow Order` / `## Order` / `- ID: order_NNN` / `- Source: autoflow order create` 형태를 갖는다.
- [ ] 같은 CLI 호출이 stdout 에 그대로 `status=created`, `memo_id=...`, `memo_file=.../memo_NNN.md`, `project_root=...`, `board_root=...`, `board_dir_name=...`, `next_action=...` key 를 동일 이름/포맷으로 출력한다 (parser 호환 보존).
- [ ] `bin/autoflow` 의 `usage()` 출력에 `autoflow order create [...]` 가 노출되고, `autoflow memo create [...]` 라인이 사라진다 (Examples 포함).
- [ ] `bin/autoflow order create ...` 호출이 `bin/autoflow memo create ...` 와 동일하게 `packages/cli/memo-project.sh` 로 dispatch 된다 (호환 alias 유지).
- [ ] Codex/Claude project-local + integrations source-of-truth order 스킬 4 개의 frontmatter `description`, 본문 단계, CLI 호출 예시가 위 wording 검사를 모두 통과하고, "Renamed from memo" 류 호환 안내문이 사라진다.
- [ ] scaffold/board, scaffold/host, repo 루트 README/CLAUDE/packages CLI README 안의 사용자 노출 wording 이 위 검사를 모두 통과한다.
- [ ] `apps/desktop/src/renderer/main.tsx` 안의 사용자 노출 한국어 안내문/aria/툴팁/empty description 에서 "memo" 표현이 사라지고 "order" 로 정렬된다. 내부 type/kind 키 (`"memo"` 문자열) 와 file-pattern 정규식 (`/^memo_\d+\.md$/i`) 은 그대로 유지된다.
- [ ] `cd apps/desktop && npx tsc --noEmit` exit 0 (사용자 노출 wording 변경이 TypeScript 회귀를 만들지 않음).
- [ ] `cd apps/desktop && node scripts/check-syntax.mjs` exit 0.
- [ ] `bash -n packages/cli/memo-project.sh bin/autoflow` exit 0 (스크립트 문법 회귀 없음).

## Next Action

- 다음에 바로 이어서 할 일: Plan AI 가 Allowed Paths 와 Done When 을 PRD 기준으로 더 좁힌다. Impl AI 는 이 티켓을 todo 에서 claim 한 뒤 mini-plan, 구현, 검증, 머지까지 한 턴에 끝낸다.

## Resume Context

- 현재 상태 요약: Plan AI 가 backlog PRD 에서 todo 티켓을 생성한 직후.
- 직전 작업: scripts/start-plan.sh 가 PRD 를 done 으로 보관하고 todo 티켓을 만들었다.
- 재개 시 먼저 볼 것: PRD, Goal, Allowed Paths, Done When.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_098/prd_098.md at 2026-05-02T10:17:09Z.

## Verification

- Run file:
- Log file:
- Result: pending

## Result

- Summary:
- Remaining risk:
