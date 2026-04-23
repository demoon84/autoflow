# AGENTS.md

이 프로젝트는 `autopilot/` sidecar 보드로 운영한다.

실제 제품 코드는 프로젝트 루트에 있고, 하네스 보드는 `autopilot/` 안에 있다.

## Read Order

작업을 시작할 때는 아래 순서로 읽는다.

1. `autopilot/README.md`
2. `autopilot/rules/README.md`
3. `autopilot/rules/spec/README.md`
4. `autopilot/rules/plan/README.md`
5. `autopilot/automations/README.md`
6. `autopilot/tickets/README.md`
7. `autopilot/rules/verifier/README.md`
8. 관련 문서:
   - 티켓 생성이면 `autopilot/agents/plan-to-ticket-agent.md`
   - todo 이동이면 `autopilot/agents/todo-queue-agent.md`
   - 구현이면 `autopilot/agents/execution-agent.md`
   - 검증이면 `autopilot/agents/verifier-agent.md`

## Root Rules

1. 보드 문서는 `autopilot/` 안에 둔다.
2. 실제 제품 코드는 프로젝트 루트에서 관리한다.
3. `Allowed Paths` 는 항상 프로젝트 루트 기준으로 해석한다.
4. `autopilot/` 밖의 제품 파일도 티켓의 `Allowed Paths` 안에 있으면 수정할 수 있다.
5. `autopilot/` 안의 티켓 상태와 검증 흐름을 우선한다.

## Trigger Interpretation

- `start plan`
- `start todo`
- `start`
- `start verifier`

위 문구는 모두 `autopilot/` 보드 흐름으로 해석한다.
