# Autoflow Order

## Order

- ID: order_186
- Title: AI 스킬 탭 로딩 지연 + 클릭 시 조회수 누적 문제
- Status: inbox
- Priority: normal
- Created At: 2026-05-09T04:59:37Z
- Source: autoflow order create

## Request

# Autoflow Order

## Order

- Title: AI 스킬 탭 로딩 지연 + 클릭 시 조회수 누적 문제
- Priority: normal
- Status: ready


ai 스킬 로딩 시간이 길고 클릭 할때마다 조회수가 늘어나는 문제점이 있어

## Notes

- 데스크톱 "AI 스킬" 탭 두 가지 문제:
  1. **로딩 시간 길음** — 탭 진입 또는 새로고침 시 skills 리스트가 표시되기까지 체감 지연. 스킬 수가 많을 때 (현재 dogfood 기준 in-repo + skills-local 합쳐 수십 개) 더 두드러짐.
  2. **클릭마다 조회수 +1** — 리스트에서 스킬을 선택 (단순 본문 미리보기) 할 때마다 `view_count` 가 늘어남. 사용자가 "이게 인기있는 스킬인가" 보려고 잠깐 클릭만 해도 자기가 본 흔적이 카운터에 누적됨.
- 카운터 의미 충돌: AGENTS.md rule 18e 가 정의한 `view_count` 는 `autoflow wiki query --rag` 결과에 SKILL 이 포함될 때 query 당 +1 되는 것 — 즉 "RAG 가 이 스킬을 얼마나 retrieve 했는지" 신호. 데스크톱 manual click 도 같은 카운터를 +1 시키면 두 신호가 섞여 RAG 인기도 측정이 망가짐.
- 후보 위치 (UI side):
  - `apps/desktop/src/renderer/main.tsx` line ~1718 `viewSkill` 콜백 — 매 클릭마다 `controlSkill({action: "view", ref: skill.key})` 호출.
  - `apps/desktop/src/renderer/main.tsx` line ~1660~ 영역 `loadSkills` (탭 진입시 list 호출).
- 후보 위치 (CLI side):
  - `packages/cli/skill-project.sh` 의 `cmd_view` (스킬 본문 출력 + view_count bump 가 같이 묶여 있을 가능성).
  - `.autoflow/wiki/skills-local/.usage.json` sidecar — view_count / last_viewed_at 갱신 site.
- 의도 (방향 후보, planner 가 결정):
  - **A**. desktop `viewSkill` 은 view_count 를 안 올리도록 별도 read-only 옵션 (예: `controlSkill({action: "view", ref: ..., bumpUsage: false})`) 추가. RAG 만 카운트.
  - **B**. CLI `autoflow skill view` 자체에 `--no-bump` 플래그 추가. 데스크톱은 그 플래그 사용.
  - **C**. desktop 에 두 카운터 분리 노출 — `view_count` (RAG retrieval) vs `manual_open_count` (사용자 클릭). 의미 구분 명확.
- 로딩 지연 후보 원인 (planner 가 검증):
  - 스킬 리스트가 every SKILL.md 를 순차 read + parse 하면서 `controlSkill({action: "list"})` 가 느려질 수 있음. caching 또는 incremental load (가시 영역만) 적용.
  - 데스크톱 IPC withTimeout 30s wrapper 안쪽에서 `autoflow skill list` 가 동기적으로 모든 entry 를 처리하는 구조라면, 탭 진입 시 한꺼번에 부담.
- 회귀 가드: usage.json sidecar 의 atomic write 보장 (PRD 162) 깨지지 않게.

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
