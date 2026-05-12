# Autoflow Order

## Order

- ID: order_315
- Title: sh to ts 전환 0단계 기반 정리
- Status: inbox
- Priority: normal
- Created At: 2026-05-12T07:40:13Z
- Source: autoflow order create

## Request

코드 전체를 상세하게 검사한 결과를 바탕으로 Autoflow의 .sh 스크립트들을 .ts 중심으로 순차 전환하기 전에 0단계 기반을 정리한다.

목표는 wrapper를 늘리는 것이 아니라 실제 로직 전환을 안전하게 진행할 수 있게 만드는 것이다. 현재 일부 .sh는 이미 .ts/.js를 호출하지만 실제 로직은 .legacy.sh에 남아 있고, package-board-common.sh의 runtime asset 목록은 .sh만 설치 대상으로 포함해 새 보드/upgrade 경로에서 companion .ts/.js 누락 위험이 있다.

먼저 설치/upgrade/doctor/검증 기반을 보강하고, 그 다음 작은 보조 스크립트 -> planner -> ticket-owner/finalizer -> packages/cli 대형 shell 순서로 후속 전환 order를 만들 수 있게 정리한다.

## Hints

### Scope

- sh-to-ts 전환 전 0단계: wrapper companion 파일 설치/doctor 보장, 현재 전환 상태 분류, 후속 단계 우선순위 정리

### Allowed Paths

- `package.json`
- `package-lock.json`
- `packages/cli/package-board-common.sh`
- `packages/cli/doctor-project.sh`
- `runtime/board-scripts`
- `.autoflow/scripts`
- `tests/smoke`

### Verification

- Command: find .autoflow/scripts runtime/board-scripts packages/cli -type f -name '*.sh' -exec bash -n {} \; && find .autoflow/scripts runtime/board-scripts -maxdepth 1 -type f \( -name '*.ts' -o -name '*.js' \) -exec node --check {} \; && ./bin/autoflow doctor . .autoflow

## Planner Contract

- Plan AI treats this order as an implementation directive, infers concrete scope from repository context, and promotes it into a generated backlog PRD and todo ticket.
- Plan AI must not turn order intake into a repeated human-question loop. Only unsafe requests should be blocked; otherwise use the safest narrow interpretation.
