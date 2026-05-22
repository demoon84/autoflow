# Context 생명주기

- Runtime은 role과 worker identity를 `automations/state/`에 저장할 수 있다.
- `threads/<thread-key>.context`는 thread별 role과 worker identity를 저장한다.
- `current.context`는 thread ID를 사용할 수 없을 때의 fallback이다.
- 직접 편집보다 `set-thread-context.*`와 `clear-thread-context.*` 사용을 우선한다.
- Active ticket context는 가능하면 tick 종료 시점에 clear해야 한다.
- Worker, legacy todo, legacy verifier는 tick 종료 시 active ticket context를 clear하지만
  role/worker context는 유지할 수 있다.
- 다음 tick은 ticket file, reference, run file, log, `Resume Context`에서 resume한다.
