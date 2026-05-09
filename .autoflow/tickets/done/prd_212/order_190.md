# Autoflow Order

## Order

- ID: order_190
- Title: SKILL 시스템 전면 제거 (option B) — wiki/learnings + AGENTS rules 로 대체
- Status: inbox
- Priority: normal
- Created At: 2026-05-09T05:33:36Z
- Source: autoflow order create

## Request

# Autoflow Order

## Order

- Title: SKILL 시스템 전면 제거 (option B) — wiki/learnings + AGENTS rules 로 대체
- Priority: normal
- Status: ready


ai 스킬이 필요 없을거 같은데 검토 결과 option B (전면 제거) 로 진행. wiki/learnings/ + AGENTS.md rule 들로 대체. 80+ skills-local 디렉토리 삭제. 데스크톱 "AI 스킬" 탭 삭제. agent 자동 추출/curator/review queue/RAG view counter 까지 인프라 전체 제거.

## Notes

scope 가 크므로 planner 가 5~6 PRD 로 **split** 하길 권장. 아래 그룹별로 의존 순서 명시. 이 순서대로 처리하면 회귀 위험 최소.

### Phase 1 — Auto pipeline 차단 (가장 먼저)
- `.autoflow/scripts/finish-ticket-owner.sh`: pass 경로의 `autoflow skill review --from-ticket` 호출 제거 (rule 18a hook).
- `runtime/board-scripts/run-role.sh` + `packages/cli/run-role.sh`: `AUTOFLOW_SKILL_NUDGE_ENABLED`, skill nudge tick 코드 제거 + 환경변수 처리 제거.
- `.autoflow/scripts/state-db.sh` 의 origin-extractor 와 무관하지만, skill review queue 관련 파일/디렉토리 (`.autoflow/wiki/skills-local/.review-queue.tsv`, `.autoflow/wiki/skills-local/.usage.json`) 정리 (사용처 없어지면 무의미).
- 이 phase 만으로도 자동 SKILL 생성 흐름이 완전히 멎음.

### Phase 2 — CLI subcommand 제거
- `bin/autoflow`: `skill)` case 제거.
- `packages/cli/skill-project.sh` 삭제.
- `runtime/board-scripts/curator-run.sh` 삭제.
- `packages/cli/wiki-project.sh`: `--rag` 결과의 SKILL view_count 증가 로직 제거 (rule 18e).
- `packages/cli/package-board-common.sh` 의 managed_board_asset_entries 에서 `wiki/skills/README.md`, `wiki/skills-local/README.md`, `wiki/skills/skill-template.md` 등 entry 제거.

### Phase 3 — 데스크톱 UI / IPC 제거
- `apps/desktop/src/renderer/main.tsx`: `controlSkill`, `loadSkills`, `viewSkill`, `archiveSkill`, `loadSkillHistory`, SkillsPanel 컴포넌트, parseSkill* 헬퍼, settingsNavigation 의 `skills` 항목, `visibleSettingsSection === "skills"` 분기 — 직전 commit `11d7070` 이 추가한 것 거의 그대로 revert 에 가까움.
- `apps/desktop/src/renderer/styles.css`: `.skills-panel-*` 블록.
- `apps/desktop/src/renderer/vite-env.d.ts`: `controlSkill` 타입 시그니처 제거.
- `apps/desktop/src/preload.js`: `controlSkill` API 노출 제거.
- `apps/desktop/src/main.js`: `autoflow:controlSkill` IPC handler 제거 + `allowedSkillActions` set 제거.

### Phase 4 — Order/autoflow skill 의 RAG injection 제거
- `integrations/claude/skills/order/SKILL.md`, `integrations/claude/skills/autoflow/SKILL.md`, `integrations/codex/skills/order/SKILL.md`, `integrations/codex/skills/autoflow/SKILL.md` (4 master) + 사본 4개 (`.claude/skills/...`, `.codex/skills/...`): "Lookup Before Saving" 섹션의 `autoflow wiki query --rag` 호출 제거. `autoflow origin search` 는 그대로 유지 (Origin Ledger 는 별도 시스템).

### Phase 5 — `/skill-this` 제거
- 4 master + 4 사본 (총 8개) `skill-this/SKILL.md` 삭제: `integrations/claude/skills/skill-this/`, `integrations/codex/skills/skill-this/`, `.claude/skills/skill-this/`, `.codex/skills/skill-this/`.

### Phase 6 — Wiki content + AGENTS.md
- `.autoflow/wiki/skills/` (사람 작성, committed): 의미 있는 항목 (`autoflow-recovery-roadmap-integration-pass`, `desktop-response-delay-severity-labels` 등 일부) 은 `.autoflow/wiki/learnings/` 로 합치거나 `AGENTS.md` rule 로 승격. 나머지는 archive 디렉토리로 이동 후 commit (또는 삭제).
- `.autoflow/wiki/skills-local/` (gitignored): 디렉토리 통째 삭제 OK.
- `AGENTS.md` rule 18a, 18b, 18c, 18d, 18e 단락 제거. rule 18 (wiki 자동화 규칙) 의 `skill_review` evidence 등 언급도 정리.
- `.gitignore`: `.autoflow/wiki/` 예외 처리에서 `!.autoflow/wiki/skills/` 항목 제거.

## Allowed Paths

- `bin/autoflow`
- `apps/desktop/**`
- `packages/cli/**`
- `runtime/board-scripts/**`
- `.autoflow/scripts/finish-ticket-owner.sh`
- `.autoflow/scripts/state-db.sh` (sidecar 파일 정리만)
- `integrations/**`
- `.claude/skills/**`
- `.codex/skills/**`
- `.autoflow/wiki/skills/**`
- `.autoflow/wiki/skills-local/**`
- `AGENTS.md`
- `.gitignore`
- `scaffold/board/wiki/skills/**`
- `scaffold/board/wiki/skills-local/**`

## Done When (rough — planner 가 phase 별 PRD 에서 구체화)

- [ ] `autoflow skill` 서브커맨드 호출이 unknown command 로 떨어진다.
- [ ] `bin/autoflow` 도움말에 skill 관련 단어가 없다.
- [ ] `npm run desktop:check` 통과 + 데스크톱 사이드바에서 "AI 스킬" 탭이 없다.
- [ ] `grep -r controlSkill apps/desktop/src` 가 0 hit.
- [ ] `find .autoflow/wiki/skills-local -type f` 가 0 (또는 archive 디렉토리만 남음).
- [ ] `AGENTS.md` 에 rule 18a~18e 가 없다.
- [ ] `.autoflow/wiki/skills/` 가 비어 있거나 archive 디렉토리만 있다.
- [ ] order/autoflow skill 의 "Lookup Before Saving" 에 `wiki query --rag` 호출이 없다 (origin search 는 유지).
- [ ] `skill-this` 디렉토리가 4 master + 4 사본 모두 제거됐다.

## Verification

- Command: `cd /Users/demoon2016/Documents/project/autoflow/apps/desktop && npm run check && cd /Users/demoon2016/Documents/project/autoflow && bash -n bin/autoflow packages/cli/*.sh runtime/board-scripts/*.sh .autoflow/scripts/finish-ticket-owner.sh`

## Planner Hint

- 6 phase 를 순서대로 6 PRD 또는 묶어서 3~4 PRD 로 split 가능. 의존성: 1 → 2 → 3 → 4 → 5 → 6 순서가 가장 안전 (auto pipeline 멎은 뒤 CLI 제거, 그 다음 UI, 마지막 wiki content).
- worker tick 1회 안에 끝낼 수 있는 작은 단위로 쪼갤 것 권장 — 한 PRD 가 수백 line 변경 수준.
- 6번 (wiki content / AGENTS.md) 을 마지막에 두면 다른 phase 의 worker 가 wiki/skills 를 참조해야 할 일이 있어도 충돌 없음.

## Hints

### Scope

- pending Plan AI inference

### Allowed Paths

- pending Plan AI inference

### Verification

- Command: pending Plan AI inference

## Planner Contract

- Plan AI treats this order as an implementation directive, infers concrete scope from repository context, and promotes it into a generated backlog PRD and todo ticket.
- Plan AI must not turn order intake into a repeated human-question loop. Only unsafe requests should be blocked; otherwise use the safest narrow interpretation.
