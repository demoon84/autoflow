# Context 생명주기

- Runtime은 runner와 assignment identity를 `automations/state/`에 저장할 수 있다.
- `threads/<thread-key>.context`는 thread별 runner와 assignment identity를 저장한다.
- `current.context`는 runner tool이 thread ID를 사용할 수 없을 때의 보조 fallback이다.
- Stop hook은 `AUTOFLOW_ROLE` env가 있는 runner 세션에서만 `current.context`를 참고한다. env role이 없는 skill 대화는 stale `current.context`가 있어도 hook 처리 대상이 아니다.
- 직접 편집보다 `set-thread-context.*`와 `clear-thread-context.*` 사용을 우선한다.
- Active assignment context는 가능하면 turn 종료 시점에 clear해야 한다.
- Role assignment가 끝나면 active item context를 clear하지만 runner identity는 유지할 수 있다.
- 다음 turn은 assigned item file, reference, run file, log, `Resume Context`에서 resume한다.
