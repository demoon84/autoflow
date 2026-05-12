# Autoflow Order

## Order

- Title: 데스크탑 대시보드의 모든 갭/외부 패딩을 12px (--workflow-grid-gap) 으로 통일
- Priority: normal
- Status: ready
- Change Type: code

## Request

데스크탑 대시보드 영역에서 카드 사이 / 섹션 사이 / 본문 좌우 outer 패딩 값이
서로 달라서 시각적 정렬이 깨짐. 가장 작은 값인 12px (`--workflow-grid-gap`)
으로 모든 갭과 외부 패딩을 통일.

해야 할 것:
1. `.dashboard-area`의 gap (현 20px) → `var(--workflow-grid-gap)` 으로 교체
2. `.settings-content-body`의 gap (현 28px) → `var(--workflow-grid-gap)` 으로 교체
3. `.settings-content-body`의 padding (현 16px 28px 등 혼재) → 상하/좌우 모두
   `var(--workflow-grid-gap)` 로 교체
4. `.settings-content-header`의 좌우 padding 도 동일하게 `var(--workflow-grid-gap)`
5. 미디어쿼리 안의 동일 selector padding 도 일치 (line 6540 부근)
6. 결과: 사용자가 보는 카드 left edge / right edge / 상단 / 카드 사이 모든
   여백이 정확히 12px

## Allowed Paths

- apps/desktop/src/renderer/styles.css

## Done When

- [ ] `.dashboard-area gap` = `var(--workflow-grid-gap)` (12px)
- [ ] `.settings-content-body gap` = `var(--workflow-grid-gap)` (12px)
- [ ] `.settings-content-body padding` 의 모든 방향이 `var(--workflow-grid-gap)` (12px)
- [ ] `.settings-content-header padding` 의 좌우가 `var(--workflow-grid-gap)` (12px)
- [ ] DevTools 측정: 상단 summary 카드 사이 갭 = runner 카드 사이 갭 = 위/아래 row 사이 갭 = 본문 좌우 outer 패딩 = 12px (1px 오차 내)

## Verification

- Command: 데스크탑 dev 실행 후 DevTools 로 boundingClientRect 비교

## Notes

- order_305 / 308 / 309 / 310 과 같은 styles.css 영역 손대므로 머지 순서 주의
- `--workflow-grid-gap` 토큰 중심으로 모든 갭이 한 곳에서 조정되도록 유지
