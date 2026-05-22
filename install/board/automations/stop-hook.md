# Stop Hook

Stop hook은 focused tick이 idle로 빠지기 전에 role이 소유한 미완료 작업이 있는지 확인한다.

다음 경우 exit를 막을 수 있다.

- 활성 worker ticket이 있는 경우
- `tickets/todo/`에 claim 가능한 worker ticket이 남은 경우
- verifier ticket이 대기 중인 경우
- PRD queue item이 아직 planner 처리를 기다리는 경우
- 최근 done source 중 위키 focused review가 아직 남은 경우
- active context가 남은 작업을 가리키는 경우

Stop hook은 runner up을 보완한다. runner loop를 대체하지 않으며 runner PID를
종료하거나 재시작해서는 안 된다.
워커 러너가 소유 ticket을 끝낸 뒤 `tickets/todo/`에 claim 가능한 ticket이 남아
있으면 idle로 빠지지 않고 `active-get` 다음 `todo-snapshot`을 실행해 한 ticket을
더 claim한다. 단, `Allowed Paths`가 비었거나 `TODO`/`TBD` 같은 placeholder뿐인
ticket은 claim 가능 작업으로 보지 않는다.
워커 러너가 이미 `tickets/verifier/`에 소유 ticket을 넘겨 검증 러너 판정을 기다리는
중이면 이 규칙보다 원자 규칙이 우선한다. 이때는 `tickets/todo/`에 다음 ticket이
남아 있어도 worker Stop을 막지 않으며, 검증 러너가 pass/revise/replan 결정을 돌려준
뒤에만 워커 러너가 다음 행동을 한다.
