# 권장 구성

기본 구성:

- 플래너 러너 1개(`planner`)
- 워커 러너 1개(`worker`)
- 검증 러너 1개(`verifier`)
- 위키 러너 1개(`wiki`)

기본 구성은 작고 예측 가능하다. Pipeline starvation이 profiling으로 확인되면 worker runner를
늘릴 수 있다. 여러 worker runner를 실행하면 worktree base drift와 `Allowed Paths` 충돌 가능성이
커지지만, ticket별 worktree가 준비되어 있으면 claim을 막지 않는다. 충돌 가능성은 warning으로
기록하고, verifier pass 이후 merge 시점에 워커 러너가 실제 conflict를 해결한다.
`coordinator`는 runner가 아니다. `merge` / `merge-bot`은 worker-runner 호환 alias이며,
verifier-approved merge는 계속 `worker`가 소유한다.
