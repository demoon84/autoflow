# Hook Logs

`BOARD_ROOT/logs/hooks/` 는 file-watch hook 실행 로그를 남기는 폴더다.

- 파일명 규칙: `hook_<route>_<timestamp>.md`
- route 예시:
  - `plan`
  - `todo`
  - `verifier`
- 각 로그에는 아래가 들어간다:
  - 어떤 파일 이벤트가 훅을 깨웠는지
  - 어떤 dispatch 방식(`shell` / `codex`)을 썼는지
  - 실제 실행 명령 또는 prompt 요약
  - stdout / stderr
  - exit code

이 폴더는 heartbeat 로그가 아니라 file-watch 기반 hook 실행 기록이다.

planner route 는 보통 아래 이벤트에서 깨어난다.

- `tickets/backlog/` 새 spec
- `tickets/reject/` 재계획 필요
- `tickets/done/<project-key>/` 완료 후 다음 backlog plan 점검
