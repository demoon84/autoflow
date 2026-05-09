# Autoflow Order

## Order

- Title: 워크플로 탭 순서 Order → PRD → Ticket 으로 변경
- Express: true
- Priority: normal
- Status: ready
- Change Type: code

## Request

order, prd, ticket 순으로 탭을 배치

## Allowed Paths

- apps/desktop/src/renderer/main.tsx

## Done When

- [ ] `apps/desktop/src/renderer/main.tsx:4181-4183` 의 탭 배열이 inbox(Order) → prd(PRD) → issued(Ticket) 순으로 정렬된다
- [ ] 탭 라벨 / 설명 문구는 그대로, 순서만 변경
- [ ] `cd /Users/demoon2016/Documents/project/autoflow/apps/desktop && npm run check` exits 0

## Verification

- Command: cd /Users/demoon2016/Documents/project/autoflow/apps/desktop && npm run check

## Notes

- 위치: `main.tsx:4181-4183` 배열 3 개 element 의 순서만 swap.
- Express rationale: 1개 array 의 element 순서 변경.
