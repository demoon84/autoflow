# Autoflow Order

## Order

- Title: TODO 진행 카운트에 inprogress 티켓 포함
- Express: true
- Priority: normal
- Status: ready
- Change Type: code

## Request

TODO 카운트가 처리 중(inprogress) 티켓은 안 세서 0/209로 나오는 버그. inprogress도 진행률에 포함돼야 1/209로 보여야 함

## Allowed Paths

- apps/desktop/src/renderer/main.tsx

## Done When

- [ ] `todoPinTitle` numerator 가 `todoTickets.length + inprogressTickets.length` 로 계산돼 마지막 티켓 처리 중에도 `TODO (1/209)` 같이 표시된다
- [ ] denominator(`todoFiles.length`) 는 그대로 유지 (todo + inprogress + done 합집합)
- [ ] `cd /Users/demoon2016/Documents/project/autoflow/apps/desktop && npm run check` exits 0

## Verification

- Command: cd /Users/demoon2016/Documents/project/autoflow/apps/desktop && npm run check

## Notes

- 위치: `apps/desktop/src/renderer/main.tsx:5566` —
  `` `TODO (${todoTickets.length}/${todoFiles.length})` `` 의 numerator 만 변경.
- `inprogressTickets` 는 같은 컴포넌트(`5556`)에서 이미 spread 되고 있음.
- Express rationale: 한 줄 수식 변경, 동일 컴포넌트 안에 이미 쓰이는 변수 재사용.
