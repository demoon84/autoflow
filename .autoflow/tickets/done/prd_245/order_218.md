# Autoflow Order

## Order

- Title: 통계 페이지에 그래프 시각화 적용 (prd_241 implementation follow-up)
- Priority: normal
- Status: ready
- Change Type: code

## Request

통계 페이지에 그래프 시각화 적용

## Context

이전 작업: `order_214` → `prd_241` 까지 promote 됐지만 Todo 가 생성되지 않아
실제 구현이 안 됨 (prd 만 done 폴더에 보관). 이번 order 로 prd_241 의 구현
phase 를 다시 트리거.

prd_241 핵심 (이미 작성된 PRD):
- 통계 4개 카드 (코드 영향 / 토큰 사용량 / 러너 상태 / 완료 커밋) 에 시각화 추가
- 외부 차트 라이브러리 추가 X — 기존 inline SVG 패턴 (`CompletionTrend`,
  `ReportBarBreakdown`, `ReportSplitBar`) 확장
- 데이터 소스: `metrics-project.sh` 기존 키 + telemetry/runs.jsonl

요구 시각화 (각 카드별):

1. **코드 영향**: 일자별 추가/삭제 stacked bar (최근 14일)
2. **토큰 사용량**: 24h 추세 line/area + 러너별 분해 stacked bar
3. **러너 상태**: 러너별 24h tick 결과 timeline (점) + 평균 tick 시간 막대
4. **완료 커밋**: 14일 commit count bar

## Allowed Paths

- apps/desktop/src/renderer/main.tsx
- apps/desktop/src/renderer/styles.css
- apps/desktop/src/main.js
- packages/cli/metrics-project.sh

## Done When

- [ ] 4개 카드 각각에 위 시각화 1개 이상 표시 (inline SVG)
- [ ] 데이터 없을 때 fallback ("러너 실행 후 채워집니다") 유지
- [ ] 외부 차트 의존성 추가 X (`apps/desktop/package.json` 무변경)
- [ ] `cd /Users/demoon2016/Documents/project/autoflow/apps/desktop && npm run check` exits 0

## Verification

- Command: cd /Users/demoon2016/Documents/project/autoflow/apps/desktop && npm run check

## Notes

- 비슷한 과거 작업:
  - `order_214` → `prd_241` (이번 follow-up 의 원본)
  - `order_212` → `prd_240` (4종 카드 상세 정보 표시)
  - `order_204` (4종으로 좁히기)
- prd_241 본문 그대로 따라가되, 새 Todo 생성으로 worker 가 실제 구현 단계까지
  진행하도록.
