# Autoflow Order

## Order

- Title: 보드 초기화 상태 '추적 중' 배지 제거
- Express: true
- Priority: normal
- Status: ready
- Change Type: code

## Request

추적 중 배지 제거

## Allowed Paths

- apps/desktop/src/renderer/main.tsx

## Done When

- [ ] 보드 초기화 상태 표시에서 "추적 중" 라벨이 보이는 배지/텍스트가 제거된다
- [ ] "없음" / "설정 필요" 등 다른 상태 라벨은 영향 없음
- [ ] `cd /Users/demoon2016/Documents/project/autoflow/apps/desktop && npm run check` exits 0

## Verification

- Command: cd /Users/demoon2016/Documents/project/autoflow/apps/desktop && npm run check

## Notes

- 위치: `apps/desktop/src/renderer/main.tsx:2677` 의 `{boardInitialized ? "추적 중" : "없음"}` 분기,
  그리고 `main.tsx:3052` 의 `boardStatusLabel` 에서 `boardInitialized ? "추적 중" : "설정 필요"`.
- 배지 자체를 숨기거나, 텍스트만 빈 문자열로 두거나, conditional 렌더링으로 boardInitialized 일 때 배지 미표시 중 하나 선택.
- Express rationale: 1~2 라인의 conditional 정리.
