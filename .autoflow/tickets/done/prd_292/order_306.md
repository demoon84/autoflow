# Autoflow Order

## Order

- Title: 데스크탑 runner 카드 위/아래 row 높이 정확히 일치 (right column)
- Priority: normal
- Status: ready
- Change Type: code

## Request

데스크탑 dashboard 의 runner 카드 grid 에서 오른쪽 컬럼의 위 row (Worker / Worker-2)
와 아래 row (LLM Wiki / Verifier placeholder) 의 카드 높이가 정확히 일치하지 않는다.
육안으로 보면 미세하게 어긋나서 줄이 안 맞아 보임. 왼쪽의 Planner 카드가 두 row 를
세로로 span 하므로 오른쪽 두 row 의 합이 Planner 높이와 같아야 하지만, 각 row 의
내부 컨텐츠 양 차이(예: token 표기 길이, debounce 상태 텍스트)에 따라 row 가 다르게
auto-grow 한다.

해야 할 것:
1. `.ai-progress-board` 의 `grid-template-rows` 를 `minmax(340px, 1fr) minmax(340px, 1fr)`
   에서 두 row 가 항상 정확히 동일 높이가 되도록 변경. 후보:
   - `1fr 1fr` (min 제거, 컨테이너 분할 기반)
   - 또는 명시적 동일 높이: `repeat(2, minmax(340px, 1fr))` + 컨텐츠 overflow 처리
2. 카드 내부 컨텐츠가 행 높이를 변형시키지 않도록 article 의 `overflow: hidden`
   + flex 분배 검증
3. 위/아래 row 카드의 footer (token 표기) bottom 정렬 1px 단위로 동일
4. Verifier placeholder 도 같은 row 높이 정확히 일치 (현재는 dashed 영역이 다른
   카드와 미세 어긋남)

## Allowed Paths

- apps/desktop/src/renderer/styles.css

## Done When

- [ ] 오른쪽 컬럼의 Worker (row1) 와 LLM Wiki (row2) 카드 높이가 1px 오차 내에서 동일
- [ ] Worker-2 (row1) 와 Verifier (row2) 카드 높이가 1px 오차 내에서 동일
- [ ] 위 두 row 의 합 + grid-gap = Planner 카드 높이 (왼쪽 컬럼) 와 정확히 동일
- [ ] 각 카드의 token 표기 footer 의 y 좌표가 row 별로 일관되게 정렬
- [ ] 다크/라이트 테마 모두에서 동일하게 정렬 (스크린샷 비교)

## Verification

- Command: 데스크탑 dev 실행 후 DevTools 로 각 article 의 getBoundingClientRect()
  height 값 비교

## Notes

- 현 grid-template-areas 레이아웃 (`planner worker worker2 / planner wiki verifier`) 유지
- order_305 (폰트 2px 축소) 과 같은 영역 손대므로 머지 순서 주의
