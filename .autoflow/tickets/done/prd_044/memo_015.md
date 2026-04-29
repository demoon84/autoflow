# Autoflow Memo

## Memo

- ID: memo_015
- Title: runtime/board-scripts/run-role.sh role-specific dispatch 미적용
- Status: inbox
- Created At: 2026-04-29T05:26:29Z
- Source: autoflow memo create

## Request

토큰 절감: `runtime/board-scripts/run-role.sh` 가 `packages/cli/run-role.sh` 의 role-specific dispatch (94946f2) 와 drift. write_agent_prompt 가 6개 role 의 boundary 블록 (lines 382-388, ~7줄) + role-specific Required-flow 항목 (3, 7) 을 어댑터 호출마다 그대로 emit 한다. 두 파일을 동기화하거나, runtime 사본이 더 이상 invoke 되지 않으면 단순 삭제. 어느 쪽이든 본인 호출 경로에서 -36 줄 / ~750 tokens / call 절약, 1분 tick × 3 runner 기준 ~3M tokens/day 와 동급의 효과.

## Hints

### Scope

- runtime/board-scripts/run-role.sh 의 write_agent_prompt 를 packages/cli/run-role.sh 와 일치하도록 동기화하거나, 사용처가 없으면 파일 삭제

### Allowed Paths

- `runtime/board-scripts/run-role.sh`
- `packages/cli/run-role.sh`

### Verification

- Command: diff -q runtime/board-scripts/run-role.sh packages/cli/run-role.sh 로 핵심 함수 (write_agent_prompt, role_boundary_for_current_role, role_specific_required_flow_items) drift 가 사라졌는지 확인

## Planner Contract

- Plan AI treats this memo as an implementation directive, infers concrete scope from repository context, and promotes it into a generated backlog PRD and todo ticket.
- Plan AI must not turn memo intake into a repeated human-question loop. Only unsafe requests should be blocked; otherwise use the safest narrow interpretation.
