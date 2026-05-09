# Autoflow Order

## Order

- Title: 통계 페이지 카드 4종(코드 영향/토큰 사용량/러너 상태/완료 커밋)만 남기기
- Priority: normal
- Status: ready
- Change Type: code

## Request

통계 페이지
코드영향, 토큰 사용량, 러너상태, 완료커밋 만 표기

## Context

`apps/desktop/src/renderer/main.tsx` 의 통계 (`snapshot`) 탭 dashboard 가
현재 다음 카드들을 모두 표시하고 있다:

1. Primary metrics row (`report-metric-grid-primary`):
   - 완료 티켓, 막힌 항목, 토큰 사용량
2. Secondary stats inline (`report-secondary-panel`):
   - 전달된 요청, 완료 커밋, 변경 파일, 러너 산출물
3. Chart grid (`report-chart-grid`):
   - 티켓 처리량, 완료 추세, 코드 영향, 토큰 사용량, AI 가동 상태(러너 상태)

요구사항: 코드 영향 / 토큰 사용량 / 러너 상태 / 완료 커밋 4가지만 남긴다.
나머지(완료 티켓, 막힌 항목, 전달된 요청, 변경 파일, 러너 산출물,
티켓 처리량, 완료 추세) 카드는 모두 제거한다.

## Allowed Paths

- apps/desktop/src/renderer/main.tsx
- apps/desktop/src/renderer/styles.css

## Done When

- [ ] 통계 탭 1단(primary)·2단(secondary)·3단(chart grid) 통합해서 4개 카드만 표시: 코드 영향, 토큰 사용량, 러너 상태, 완료 커밋
- [ ] 완료 티켓, 막힌 항목, 전달된 요청, 변경 파일, 러너 산출물, 티켓 처리량, 완료 추세 카드/지표 모두 사라진다
- [ ] 4개 카드 레이아웃이 비어 보이지 않게 grid 가 정렬된다 (예: 2x2 또는 책임 있는 단일 행)
- [ ] 사용되지 않게 된 helper/import (BarChart3, TrendingUp, ClipboardList 등) 는 통계 페이지에서 정리
- [ ] `cd /Users/demoon2016/Documents/project/autoflow/apps/desktop && npm run check` exits 0

## Verification

- Command: cd /Users/demoon2016/Documents/project/autoflow/apps/desktop && npm run check

## Notes

- 통계 탭 진입점: `dashboard-area` (`aria-label="통계"`) → `BoardReportDashboard`
  컴포넌트 (line 4280 부근). `report-metric-grid-primary` /
  `report-secondary-panel` / `report-chart-grid` 3개 영역에 카드들이 분포.
- 4개 카드 묶음 권장 layout:
  - 완료 커밋 → ReportMetricCard (수치 강조)
  - 토큰 사용량 → ReportChartCard (`tokenUsageCount` + `tokenReportCount`)
  - 코드 영향 → ReportChartCard (`codeFilesChangedCount` + insertions/deletions split bar)
  - 러너 상태 → ReportChartCard (`runnerData` bar breakdown)
- secondary panel `ReportInlineStats` 자체는 다른 곳에서 안 쓰면 함께 정리,
  쓰면 import 만 유지.
