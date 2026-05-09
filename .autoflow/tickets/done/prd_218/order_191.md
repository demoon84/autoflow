# Autoflow Order

## Order

- ID: order_191
- Title: 통계 탭에 처리 시간 카드 추가 (metrics 집계 + strip 3칸)
- Status: inbox
- Priority: normal
- Created At: 2026-05-09T05:40:08Z
- Source: autoflow order create

## Request

# Autoflow Order

## Order

- Title: 통계 탭에 처리 시간 카드 추가 (metrics 집계 + strip 3칸)
- Priority: normal
- Status: ready


처리 시간이 통계에 안 들어와 있어서 추가하고 싶음. 현재 통계 strip 의 토큰 사용량 오른쪽에 처리 시간 카드 1개 더 만들기.

## Notes

- 데이터 소스 (이미 있음, 새 IPC/스토리지 추가 불필요):
  - `state.db` 의 `ticket_lifecycle` 테이블이 이미 `lead_seconds` / `active_seconds` / `tick_count` 컬럼 보유. `autoflow origin status` 가 `=== Average ticket lead time by status === avg_lead_min, avg_active_min, avg_ticks` 로 평균을 출력함 — 같은 SQL 재사용.
  - state.db 가 없는 환경 fallback: `.autoflow/telemetry/runs.jsonl` 의 `duration_ms` 합산 + per-ticket `## Goal Runtime > Time Used Seconds` 합산.
- 변경 범위 3 군데:

### 1. `packages/cli/metrics-project.sh` (신규 필드 emit)
- 후보 필드 (planner 가 명명 결정):
  - `autoflow_avg_lead_seconds` — done ticket 평균 lead time (생성→완료).
  - `autoflow_avg_active_seconds` — done ticket 평균 active time (worker 실작업).
  - `autoflow_avg_ticks_per_done_ticket` — done ticket 평균 tick count.
  - `autoflow_duration_total_24h_seconds` — 최근 24h 어댑터 호출 duration_ms 합 (jsonl 에서).
- state.db 가 있으면 ticket_lifecycle 에서, 없으면 jsonl/markdown fallback. write-time sanity cap (rule 19a 같은 보호) 도 적용.

### 2. `apps/desktop/src/renderer/vite-env.d.ts` (타입 추가)
- `AutoflowMetricSnapshot` 에 위 4 필드 number 로 추가.

### 3. `apps/desktop/src/renderer/main.tsx` (UI 카드 + 표시)
- `apps/desktop/src/renderer/main.tsx` line ~4388 의 변경 코드량 / line ~4396 의 토큰 사용량 카드 옆에 3번째 카드 "처리 시간" 추가.
- 본문 예시: 큰 숫자 = 평균 active 시간 (분 단위, "14.3분"), 옆 보조 = "lead 16.0분 / 누적 24h 47h" 같은 형식. 단위 가독성 개선 위해 분/시 자동 포맷 (60분 미만 = "x분", 이상 = "x.xh").
- title attribute (hover tooltip) 에 raw seconds 와 sample 수 (n=184) 도 함께.
- 사용자 스크린샷 기준으로 현재 strip 이 `repeat(auto-fit, minmax(152px, 1fr))` 자동 그리드라 카드 추가만으로 자동 3칸 배치됨. styles.css 변경 거의 없음.

## Allowed Paths

- `packages/cli/metrics-project.sh`
- `apps/desktop/src/renderer/main.tsx`
- `apps/desktop/src/renderer/vite-env.d.ts`
- `apps/desktop/src/renderer/styles.css`

## Done When

- [ ] `autoflow metrics` 출력에 처리 시간 관련 신규 key=value 4 줄이 emit 된다.
- [ ] 통계 탭 strip 에 "처리 시간" 카드가 변경 코드량 / 토큰 사용량 옆에 표시된다.
- [ ] state.db 없는 환경에서 jsonl/markdown fallback 으로 동일 카드 표시 (값이 0 또는 추정치라도 깨지지 않음).
- [ ] `npm run desktop:check` 통과.
- [ ] 기존 변경 코드량 / 토큰 사용량 카드 layout / 정렬 / 라벨 변동 없음.

## Verification

- Command: `cd /Users/demoon2016/Documents/project/autoflow/apps/desktop && npm run check && cd /Users/demoon2016/Documents/project/autoflow && bin/autoflow metrics .`

## Notes (추가)

- state.db 의 origin-sync 가 ticket_lifecycle 을 채우려면 `autoflow origin sync` 가 한번 돌아가 있어야 함. metrics-project.sh 에서 호출 결과가 비어 있으면 jsonl/markdown 으로 fallback — sync 자동 트리거는 본 작업 범위 밖.
- 시간 fallback 계산 시 분 단위 1자리 소수까지 (`14.3`), 시간 단위는 `47.2h` 같이 간결하게.

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
