# Autoflow Order

## Order

- Title: 상단 summary 카드 (ORDER/PRD/TODO) 와 runner 카드 grid 의 column gap 동일하게 일치
- Priority: normal
- Status: ready
- Change Type: code

## Request

데스크탑 dashboard 의 위쪽 summary 카드 3개 (`ORDER (n/N)`, `PRD (n/N)`,
`TODO (n/N)`) 와 그 아래 runner 카드 3개 (`Planner`, `Worker`, `Worker`)
가 같은 3-column 구조지만 사이 horizontal gap 이 일치하지 않아서 column
경계가 어긋나 보임. 위/아래 row 모두 동일한 gap (px) 으로 통일해서 column
선이 수직으로 정확히 떨어지게 정렬.

해야 할 것:
1. 상단 summary strip (변경 코드량/토큰/평균 + ORDER/PRD/TODO) 의 컨테이너
   grid 또는 flex `gap` 값 측정
2. `.ai-progress-board` 의 `gap` (현 12px) 과 비교
3. 둘 중 한 쪽에 맞춰 통일 — 가독성 좋은 쪽 우선 (보통 본문 padding 16px 과
   조화되는 12px)
4. 컬럼 컨테이너의 좌우 outer padding 도 동일하게 맞춰서 컬럼 시작/끝 x 좌표
   일치 (위/아래 row 의 첫 카드 left edge, 마지막 카드 right edge 가 정확히
   같은 x 값)

## Allowed Paths

- apps/desktop/src/renderer/styles.css

## Done When

- [ ] 상단 summary 카드 사이 gap 과 runner 카드 사이 gap 이 1px 오차 내 동일
- [ ] 상단/하단 row 의 첫 카드 left edge x 좌표 일치
- [ ] 상단/하단 row 의 마지막 카드 right edge x 좌표 일치
- [ ] 다크/라이트 테마 동일

## Verification

- Command: 데스크탑 dev 실행 후 DevTools 로 카드 boundingClientRect 비교 (left, right, gap)

## Notes

- order_305 / 308 / 309 와 같은 styles.css 손대므로 머지 순서 주의
- gap 값을 변수화 (`--workflow-grid-gap` 등) 해서 한 곳에서 조정 가능하게 권장
