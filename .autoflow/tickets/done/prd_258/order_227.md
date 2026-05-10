# Autoflow Order

## Order

- ID: order_227
- Title: Progress 슬라이더 연결선 제거 (점만 남기기)
- Status: inbox
- Priority: normal
- Created At: 2026-05-10T11:22:06Z
- Source: autoflow order create

## Request

# Autoflow Order

## Order

- Title: Runner 카드 progress 슬라이더의 연결선 제거 (점만 남기기)
- Priority: normal
- Status: ready
- Change Type: code


Runner 카드 (planner / worker / wiki) 의 단계 indicator 가 현재 4개 점 + 점 사이 연결선 + 진행에 따라 채워지는 fill 선으로 그려져서 progress bar 처럼 보임. Runner 흐름은 cycle (반복) 인데 progress bar 는 선형 진척을 암시해 의미가 안 맞음.

**변경**: 점(circle marker) 4개는 그대로 두고, 점들을 잇는 track 선 + fill 선 (`ai-progress-flow-track` / `ai-progress-flow-fill` 등) 만 제거. 점들은 일정 간격으로 분리된 형태가 되고, 그중 활성 단계 1개만 highlight.

라벨 (대기/구현/완료/반려 등) 과 활성 단계 highlight 로직은 그대로 유지 — 시각적 무게만 줄어듦.

## Allowed Paths

- apps/desktop/src/renderer/main.tsx
- apps/desktop/src/renderer/styles.css

## Done When

- [ ] Runner 카드의 progress indicator 에서 점들을 잇는 가로 연결선이 시각적으로 사라짐 (track + fill 선 둘 다)
- [ ] 점(circle marker) 4개는 그대로 동일 위치에 표시되고 활성 단계 1개만 강조 (색상/링/크기 등 기존 active 스타일 유지)
- [ ] 점 아래 단계 라벨 (대기 / 구현 / 완료 / 반려 등) 그대로 표시
- [ ] planner / worker / wiki 3개 카드 모두에 일관 적용
- [ ] 다크/라이트 테마 둘 다에서 점 사이 빈 공간이 깔끔하게 보임 (잔여 배경선 / shadow 없음)
- [ ] 화면 폭이 좁아져도 점 4개 layout 깨지지 않음 (반응형 검증)

## Verification

- Command: rg -n "ai-progress-flow-track|ai-progress-flow-fill|progressFillPercent" apps/desktop/src/renderer/main.tsx apps/desktop/src/renderer/styles.css

## Notes

- 점 4개를 grid 또는 flex space-between 으로 일정 간격 배치
- track 선 / fill 선 관련 CSS 룰 (`background`, `border-bottom`, `::before` 의사요소 등) 은 제거 또는 transparent
- 점 사이 영역에 hover/click 영역 남아 있으면 같이 정리
- 진행 상태 결정 로직 (`runnerStageKey` / `flowStepState`) 은 변경 없음 — 시각적 표현만 바꿈

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
