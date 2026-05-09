# Autoflow Order

## Order

- Title: 워커 대기 상태 슬라이더 완료 스텝 오표시 수정
- Priority: normal
- Status: ready
- Change Type: code

## Request

워커 대기 상태(ticket_inputs_unchanged 등)가 슬라이더에서 완료 스텝으로 잘못 표시되는 UI 버그 수정

## Context

`apps/desktop/src/renderer/main.tsx` 의 `runnerStageKey()` 함수에서 worker(ticket-owner)
가 idle 상태(`last_result=ticket_inputs_unchanged`, `no_todo_available` 등)일 때
6981 번째 줄의 `/\bdone\b|\bpass\b|\bcomplete\b|adapter_exit_0/` 정규식에 의해
`stateText` 내 다른 필드(`lastLogLine`, `conversationPreview` 등)가 매칭돼
"완료"(done) 스텝으로 잘못 매핑된다.

올바른 동작: `ticket_inputs_unchanged` / `no_todo_available` 같은 worker idle 신호가
있으면 "대기"(todo) 스텝으로 표시해야 한다.

## Allowed Paths

- apps/desktop/src/renderer/main.tsx

## Done When

- [ ] `last_result=ticket_inputs_unchanged` 인 worker runner 가 슬라이더에서 "대기" 스텝(첫 번째)으로 표시된다
- [ ] `last_result=no_todo_available` 인 worker runner 도 동일하게 "대기"로 표시된다
- [ ] `cd /Users/demoon2016/Documents/project/autoflow/apps/desktop && npm run check` exits 0

## Verification

- Command: cd /Users/demoon2016/Documents/project/autoflow/apps/desktop && npm run check

## Notes

- `runnerStageKey()` 의 worker 분기에서 6981 번째 줄 `/\bdone\b/` 검사 이전에
  명시적 idle 신호 guard 를 삽입하면 된다:
  `if (/\bticket_inputs_unchanged\b|\bno_todo_available\b/.test(stateSignalText)) return "todo";`
- `stateSignalText` 는 `lastResult`, `lastLogLine`, `activeItem` 등을 concat 한 문자열이므로
  `stateSignalText` 기준으로 검사하는 것이 적합하다.
