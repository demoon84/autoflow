# Autoflow Order

## Order

- Title: 통계 페이지 4개 카드를 그래프/차트로 시각화
- Priority: normal
- Status: ready
- Change Type: code

## Request

통계페이지 데이터를 그래프나 차트로 표현 필요

## Context

`order_204` (4개로 좁히기) + `order_212` (각 카드 상세화) 의 follow-up.
현재 통계 카드는 숫자 + 막대 breakdown 정도만 있고, 시간축/추세/분포를
직관적으로 보여주는 차트가 부족하다. 4개 카드 각각에 적합한 차트:

1. **코드 영향**: 일자별 추가/삭제 라인 stacked bar (최근 14일) + top
   디렉터리별 변경 도넛/막대.
2. **토큰 사용량**: 시간축(최근 24h, 1h 단위) line/area + 러너별 분해 stacked
   bar + 모델별 도넛.
3. **러너 상태**: 러너별 마지막 24h tick 결과 timeline (success/failed/killed
   색 점) + 러너별 평균 tick 시간 막대.
4. **완료 커밋**: 일자별 commit count bar (최근 14일) + 작성자(autoflow vs
   user) 도넛.

## Allowed Paths

- apps/desktop/src/renderer/main.tsx
- apps/desktop/src/renderer/styles.css
- apps/desktop/src/main.js
- packages/cli/metrics-project.sh
- apps/desktop/package.json

## Done When

- [ ] 코드 영향 카드에 일자별 추가/삭제 stacked bar (최근 14일) 표시
- [ ] 토큰 사용량 카드에 24h 추세 line/area + 러너별 분해 stacked bar 표시
- [ ] 러너 상태 카드에 24h tick 결과 timeline + 평균 tick 시간 막대 표시
- [ ] 완료 커밋 카드에 14일 commit count bar 표시
- [ ] 데이터 없을 때 fallback 메시지 표시 유지
- [ ] `cd /Users/demoon2016/Documents/project/autoflow/apps/desktop && npm run check` exits 0

## Verification

- Command: cd /Users/demoon2016/Documents/project/autoflow/apps/desktop && npm run check

## Notes

- 비슷한 과거 작업: prd_035 (ReportingDashboard MUI 정렬), prd_010 (보드
  컬럼 색상). 본 건은 prd_035 기반 위에 차트 컴포넌트 신규 도입.
- 가능하면 dependency 추가 없이 inline SVG 로 구현 (기존 `CompletionTrend`,
  `ReportBarBreakdown`, `ReportSplitBar` 패턴 확장). recharts/chart.js 같은
  외부 라이브러리는 번들 크기 부담 → 마지막 옵션.
- 데이터 소스:
  - 코드 영향 / 완료 커밋: `metrics-project.sh` 가 일자별 commit + diff 통계 emit
  - 토큰: 기존 telemetry/runs.jsonl + 1h window (시간 bucket 단위 합산 추가 필요)
  - 러너 상태: telemetry rows 의 result 분포
- realtime 갱신은 기존 board snapshot polling 흐름에 따른다 (별도 IPC 추가 X).
- 회귀 가드: 기존 4개 카드 숫자 표시는 유지, 차트는 그 아래 추가.
