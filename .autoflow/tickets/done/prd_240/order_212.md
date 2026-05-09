# Autoflow Order

## Order

- Title: 통계 4개 카드(코드 영향/토큰/러너/완료 커밋) 상세 정보 확장
- Priority: normal
- Status: ready
- Change Type: code

## Request

통계 4개 항목(코드 영향, 토큰 사용량, 러너 상태, 완료 커밋)을 상세하게 보여줘야 함

## Context

`order_204` 에서 통계 페이지를 4개 카드로 좁혔다. 이번에는 그 4개 각각이
한 줄 수치 + 보조 한 줄로 그치지 않고, 카드 안에서 더 풍부한 분해 정보를
보여줘야 한다.

요구 상세도 (각 카드별):

1. **코드 영향**:
   - 변경 파일 수 / 추가 라인 / 삭제 라인 / 순변동 라인
   - 최근 7일 추세 (sparkline 또는 일자별 stack bar)
   - top-N 카테고리별 변경 (예: `apps/desktop`, `packages/cli`, `.autoflow/`)

2. **토큰 사용량**:
   - 누적 토큰, 최근 1h/24h 합계
   - 입력/출력/캐시 입력 분리 (가능한 경우)
   - 러너별(planner/worker/wiki) 분해 막대
   - 모델별 분해 (gpt-5.4 / gpt-5.3-codex-spark / gemini-2.5-flash-lite 등)

3. **러너 상태**:
   - 실행 중 / 대기 / 중지 / 막힘 (현재 표시) + 각 러너 이름과 마지막 활동 시각
   - 최근 24h 평균 tick 시간, 성공률, timeout 비율
   - 마지막 tick 결과 (success/failed/killed)

4. **완료 커밋**:
   - 누적 commit 수 + 최근 24h commit 수
   - 자동화 commit (autoflow worker 머지) vs 수동 commit 비율
   - 최근 5건 commit subject (PRD/ticket bracket 보존) 미리보기

## Allowed Paths

- apps/desktop/src/renderer/main.tsx
- apps/desktop/src/main.js
- apps/desktop/src/renderer/styles.css
- packages/cli/metrics-project.sh

## Done When

- [ ] 코드 영향 카드에 최소 (변경 파일 / 추가 / 삭제 / 순변동) 4개 수치와 추세 시각화 1개가 표시된다
- [ ] 토큰 사용량 카드에 누적 + 최근 1h/24h 합계 + 러너별 분해가 표시된다
- [ ] 러너 상태 카드에 러너 이름 + 마지막 활동 시각 + 최근 tick 성공/실패 카운트가 표시된다
- [ ] 완료 커밋 카드에 누적 + 최근 24h + 최근 5건 subject 미리보기가 표시된다
- [ ] 4개 카드 모두 빈 데이터일 때 fallback 메시지 표시 유지
- [ ] `cd /Users/demoon2016/Documents/project/autoflow/apps/desktop && npm run check` exits 0

## Verification

- Command: cd /Users/demoon2016/Documents/project/autoflow/apps/desktop && npm run check

## Notes

- 비슷한 과거 작업: order_204 (통계 4종 좁히기), prd_123 (metrics 일일 스냅샷
  키 정리), prd_129 (토큰 표시 두 경로 일치). 본 건은 prd_204 의 follow-up
  으로, 좁혀 둔 4 카드를 깊이 있게 채우는 단계.
- IPC 추가가 필요하면 `apps/desktop/src/main.js` 의 `enrichRunnerTerminalPreviews`
  / `readRunnerTokenUsage` 와 `metrics-project.sh` 의 `count_autoflow_*`
  계열 함수를 확장.
- 추세/시각화는 기존 `CompletionTrend`, `ReportBarBreakdown`, `ReportSplitBar`,
  `ReportInlineStats` 컴포넌트 재사용 우선.
- realtime 갱신은 기존 board snapshot polling 흐름에 따른다 (별도 IPC 추가 X).
