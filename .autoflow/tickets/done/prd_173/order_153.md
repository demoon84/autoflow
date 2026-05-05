# Autoflow Order

## Order

- ID: order_153
- Title: readBoard IPC timeout 구조 개선 (부분 실패 허용 + 개별 CLI timeout)
- Status: inbox
- Priority: normal
- Created At: 2026-05-04T04:54:50Z
- Source: autoflow order create

## Request

# Autoflow Order

## Order

데스크톱 dev 앱 cold-start / main.js 핫리로드 직후 `autoflow:readBoard` 가 30초 IPC timeout 으로 빈번히 죽는 구조적 약점을 개선한다. 현재 `readBoard` 는 `Promise.all` 로 6개 autoflow CLI subprocess (`status`, `listRunners`, `doctor`, `metrics`, `stop-hook-status`, `watch-status`) 를 동시 spawn 하며, 어느 하나라도 30초 안에 못 끝내면 전체 핸들러가 reject 된다. 개별 CLI timeout, 부분 실패 허용 (`Promise.allSettled`), fallback 결과 중 어느 것도 없다.


(원 대화에서 4회 dev 앱 실행 시도 중 1회는 `Error occurred in handler for 'autoflow:readBoard': Error: autoflow IPC handler timed out after 30000ms` 으로 끝났음. 사용자가 이 분석 결과를 보고 quick order 를 요청.)

데스크톱 메인 프로세스의 `autoflow:readBoard` IPC 핸들러가 cold-start 또는 main.js reload 직후에 30초 timeout 으로 떨어지는 문제를 구조적으로 해결한다. 한 CLI 가 느리거나 hang 되어도 나머지 결과로 보드를 그릴 수 있도록 부분 실패를 허용하고, 각 CLI 호출에 개별 timeout 을 둔다.

## Scope hints

- `apps/desktop/src/main.js` 의 `readBoard` 함수 ([main.js:2101](apps/desktop/src/main.js:2101)) 내부 `Promise.all([status, listRunners, doctor, metrics, stopHook, watcher])` 블록을 `Promise.allSettled` 기반 부분 실패 허용 구조로 변경.
- `runAutoflow` / `runAutoflowCached` / `runAutoflowCachedOrRefresh` 호출에 개별 timeout (예: 15초) 을 더하고, timeout 시 빈 결과 + 경고 stderr 를 fallback 으로 반환.
- `withTimeout(handler, 30000)` 자체는 유지 (UI freeze 안전망). 다만 readBoard 내부 부분 실패 허용으로 인해 30초 timeout 이 정상 흐름에서는 거의 트리거되지 않아야 한다.
- `autoflow:listRunners`, `autoflow:listRunnerArtifacts`, `autoflow:readBoardFile`, `autoflow:getConfig` 도 같은 패턴 적용 여부 검토.

## Allowed Paths

- `apps/desktop/src/main.js`
- `apps/desktop/src/` 보조 유틸 (필요 시 추가 모듈로 분리 허용)

## Verification hints

- `npm run desktop:check` 통과 (typecheck + vite build).
- 수동: `npm run desktop:dev` cold-start 시 보드가 정상 렌더링되며 콘솔에 `IPC handler timed out` 로그가 없어야 함.
- 수동: 일부러 한 CLI 를 느리게 만든 시나리오 (예: `runAutoflow` mock) 에서 부분 결과가 표시되고 전체 reject 가 일어나지 않는지 확인.

## Hints

### Scope

- pending Plan AI inference

### Allowed Paths

- pending Plan AI inference

### Verification

- Command: pending Plan AI inference

## Planner Contract

- Plan AI treats this order as an implementation directive, infers concrete scope from repository context, and promotes it into a generated backlog PRD and todo ticket.
- Plan AI must not turn order intake into a repeated human-question loop. Only unsafe requests should be blocked; otherwise use the safest narrow interpretation.
