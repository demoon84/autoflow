# Runner Harness

Runner harness는 local process가 Autoflow 보드 작업을 소비할 수 있게 한다.

핵심 계약:

- runner는 board file을 읽는다.
- runner는 durable state를 ticket에 다시 쓴다.
- runner state는 `runners/state/` 아래에 저장된다.
- ticket이 계속 source of truth다.
