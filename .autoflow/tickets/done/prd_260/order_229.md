# Autoflow Order

## Order

- ID: order_229
- Title: Runner 진행 단계 라벨 정비 + 종료 상태 분리
- Status: inbox
- Priority: normal
- Created At: 2026-05-10T11:26:00Z
- Source: autoflow order create

## Request

# Autoflow Order

## Order

- Title: Runner 진행 단계 라벨 정비 + 종료 상태 슬라이더에서 분리
- Priority: normal
- Status: ready
- Change Type: code


현재 runner 카드의 단계 슬라이더는 "진행 중" 단계와 "종료 결과" 가 같은 시각화에 섞여 있어 의미가 명확하지 않다. cycle 흐름만 표시하도록 라벨을 정비하고, 종료 결과는 별도 영역으로 분리.

## 변경 매핑

| Runner | 신규 단계 | 의미 |
|--------|----------|------|
| planner | 대기 / 계획 / 티켓생성 | inbox/backlog 감시 → PRD 분해 → todo 작성 후 cycle 닫고 대기로 |
| worker | 대기 / 구현 / 머지 | todo claim → inprogress 진입 + 코드 변경/verify → master 통합 + done 이동 |
| wiki | 대기 / 작성중 | source 변화 감지 → synth/baseline 갱신 |

**종료 결과 (완료 / 반려 / 오류) 처리**
- 슬라이더 단계에서 제거
- 카드 우측 또는 헤더에 잠깐 뜨는 toast 또는 작은 결과 배지로 대체
- 5~10초 후 자연 사라지거나 다음 cycle 시작 시 사라짐

## LLM 능동 보고 stage 값 (runner-stage.js 와 mapping)

- planner: `planning` (계획) → `generating-todo` (티켓생성) → `idle` (대기)
- worker: `inprogress` (구현) → `merging` (머지) → `idle` (대기)
- wiki: `syncing` (작성중) → `idle` (대기)

기타 호환:
- `done` 신호는 toast 표시 후 즉시 `idle` 로 전이 (슬라이더 머무는 단계 아님)
- `blocked` / `failed` 신호는 toast + 카드 헤더 배지 표시, 슬라이더는 `idle` 로 복귀

## Allowed Paths

- apps/desktop/src/renderer/main.tsx
- apps/desktop/src/renderer/styles.css
- apps/desktop/src/main.js (buildInitialPrompt 의 stage 명칭 일관성)
- .autoflow/agents/ticket-owner-agent.md
- .autoflow/agents/plan-to-ticket-agent.md
- .autoflow/agents/wiki-maintainer-agent.md

## Done When

- [ ] `ownerFlowStages` (worker) → 3단계 `[대기, 구현, 머지]` 로 축소, key 는 `[idle, inprogress, merging]`
- [ ] `plannerFlowStages` → 3단계 `[대기, 계획, 티켓생성]` 로 변경, key `[idle, planning, generating-todo]`
- [ ] `wikiBotFlowStages` → 2단계 `[대기, 작성중]` 로 단순화, key `[idle, syncing]`
- [ ] `runnerStageKey` 함수 의 stage 결정 로직이 새 key 들과 매핑되도록 갱신 — `done`/`blocked`/`failed`/`reject` 같은 종료 stage 는 모두 `idle` 로 매핑
- [ ] `mergeBotFlowStages` 는 변경 없음 (merge-bot 은 기본 토폴로지에서 비활성)
- [ ] 종료 결과 (마지막 cycle 결과) 를 카드 헤더 또는 우측에 작은 배지/toast 로 표시 — `last_cycle_result=done|blocked|reject` 같은 state 필드 또는 inline 로직
- [ ] toast/배지 는 5~10초 후 사라지거나 다음 stage 변화 (idle → planning 등) 에 사라짐
- [ ] 라벨 변경이 light/dark 테마 모두에서 깔끔하게 보임
- [ ] agent.md 3개의 워크플로 섹션에 새 stage 이름 (planning/generating-todo/inprogress/merging/syncing/idle) 일관 반영

## Verification

- Command: rg -n "ownerFlowStages|plannerFlowStages|wikiBotFlowStages|runnerStageKey" apps/desktop/src/renderer/main.tsx

## Notes

- order_227 (progress 연결선 제거) 와 함께 적용되면 시각적으로도 가벼워짐
- order_228 (runner-stage.js 실구현) 가 만드는 stage 신호와 매핑 일치 — `planning` / `generating-todo` / `inprogress` / `merging` / `syncing` / `idle` 6개 stage
- worker 의 `verifying` / `cleanup` 같은 세부 단계는 슬라이더에 노출 안 함 (구현 안에서 처리)
- 카드 헤더 배지 디자인은 기존 `live-terminal-view-status-badge` 컴포넌트 재사용 가능

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
