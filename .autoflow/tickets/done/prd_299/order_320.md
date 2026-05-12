# Autoflow Order

## Order

- ID: order_320
- Title: sh to ts 전환 5단계 CLI 대형 shell 이관
- Status: inbox
- Priority: normal
- Created At: 2026-05-12T07:44:59Z
- Source: autoflow order create

## Request

4단계 worker/finalizer 이관 이후, packages/cli 의 대형 shell entrypoint를 TypeScript/Node 중심으로 단계 이관한다.

대상은 packages/cli/run-role.sh, runners-project.sh, wiki-project.sh, doctor-project.sh, metrics-project.sh, coordinator-project.sh, upgrade-project.sh 및 bin/autoflow dispatch 경계다. run-role과 runners-project는 runner loop, adapter timeout, realtime wake, budget preflight, token telemetry, process cleanup 등 위험도가 높으므로 마지막 단계에서 진행한다.

기존 CLI usage/output 계약과 runtime/board-scripts mirror 관계를 유지하고, macOS bash 3.2 호환 회피용 패치가 JS/TS 이관 과정에서 사라져도 동일 동작이 유지되는지 검증한다.

## Hints

### Scope

- sh-to-ts 5단계: packages/cli 대형 shell entrypoint의 TypeScript/Node 이관

### Allowed Paths

- `bin/autoflow`
- `packages/cli`
- `runtime/board-scripts/run-role.sh`
- `runtime/board-scripts/runners-project.sh`
- `runtime/board-scripts/wiki-project.sh`
- `tests/smoke`
- `package.json`
- `package-lock.json`

### Verification

- Command: find packages/cli runtime/board-scripts -type f -name '*.sh' -exec bash -n {} \; && ./bin/autoflow runners list . .autoflow && ./bin/autoflow doctor . .autoflow && bash tests/smoke/runner-idle-preflight-skip-smoke.sh

## Planner Contract

- Plan AI treats this order as an implementation directive, infers concrete scope from repository context, and promotes it into a generated backlog PRD and todo ticket.
- Plan AI must not turn order intake into a repeated human-question loop. Only unsafe requests should be blocked; otherwise use the safest narrow interpretation.
