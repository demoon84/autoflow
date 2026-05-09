# Autoflow Order

## Order

- ID: order_192
- Title: 통계 처리 시간 카드 라벨 명확화 (처리 시간 → 평균 처리 시간)
- Status: inbox
- Priority: normal
- Created At: 2026-05-09T06:25:32Z
- Source: autoflow order create

## Request

# Autoflow Order

## Order

- Title: 통계 처리 시간 카드 라벨 명확화 (처리 시간 → 평균 처리 시간)
- Priority: normal
- Status: ready


평균 처리 시간 표기 하자. 현재 "처리 시간" 큰 숫자 14.3분 + "lead 16분 / 누적 24h 3.4h" 가 어떤 내용인지 명확하지 않아 라벨 풀어쓰기.

## Notes

- 변경 위치: `apps/desktop/src/renderer/main.tsx` line ~4439.
- 현재 라벨:
  - Badge: `처리 시간`
  - sub: `lead {avgLead} / 누적 24h {duration24h}`
- 의도하는 라벨:
  - Badge: `평균 처리 시간`
  - sub: `lead 와 누적 24h 가 무엇인지 풀어쓰기`. 후보 표현 (planner / worker 가 결정):
    - `티켓당 평균 14.3분 (실작업) · 16분 (대기 포함) · 24시간 어댑터 누적 3.4h`
    - 또는 sub 를 한국어로 풀어 `생성→완료 16분 · 24시간 어댑터 누적 3.4h` (큰 숫자가 active 임을 Badge 옆 작은 secondary 라벨에 표기)
- 의미 매핑 (이미 확정):
  - 큰 숫자 = `autoflow_avg_active_seconds` ÷ 60 = ticket 1건 평균 active 시간 (worker 실작업)
  - lead = `autoflow_avg_lead_seconds` ÷ 60 = ticket 1건 평균 lead 시간 (생성→완료, 대기 포함)
  - 누적 24h = `autoflow_duration_total_24h_seconds` ÷ 3600 = 최근 24h 어댑터 호출 합계
- title (hover tooltip) 의 raw 값 (`n=, lead=Xs, active=Ys, ticks=Z, 24h=Ws`) 은 그대로 유지 — 디버그 용도.
- 변경 코드량 카드 / 토큰 사용량 카드 의 라벨 톤과 일관 유지.

## Allowed Paths

- `apps/desktop/src/renderer/main.tsx`

## Done When

- [ ] `apps/desktop/src/renderer/main.tsx` 의 Badge 텍스트가 `처리 시간` → `평균 처리 시간` 으로 변경되어 있다.
- [ ] sub 라벨이 풀어쓴 한국어 (lead / 누적 24h 의 의미가 사용자에게 한 눈에 들어오는 표현) 로 교체되어 있다.
- [ ] `npm run desktop:check` 통과.
- [ ] 다른 카드 (변경 코드량 / 토큰 사용량) 의 라벨 / 정렬 변동 없음.

## Verification

- Command: `cd /Users/demoon2016/Documents/project/autoflow/apps/desktop && npm run check`

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
