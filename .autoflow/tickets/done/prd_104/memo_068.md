# Autoflow Memo

## Memo

- ID: memo_068
- Title: 데스크톱 앱 콜드 스타트 readBoard IPC 30s 타임아웃 (metrics 82s)
- Status: inbox
- Created At: 2026-05-02T01:26:39Z
- Source: autoflow memo create

## Request

데스크톱 앱 시작 직후 `Error invoking remote method 'autoflow:readBoard': Error: autoflow IPC handler timed out after 30000ms` 오류가 발생함.

원인: `apps/desktop/src/main.js` 의 `readBoard()` 가 `Promise.all` 로 6개 autoflow CLI 진단 명령을 병렬 실행하는데, 그중 `autoflow metrics` 가 cold path 에서 약 82초 걸려 30s IPC 타임아웃을 항상 초과한다. 다른 5개는 0.1~1.3s 로 빠름.

`metrics` 는 `runAutoflowCached` 로 감싸져 있지만 캐시 미스 시 동기적으로 결과를 기다리는 구조라, 앱을 새로 띄울 때마다 readBoard 첫 호출이 실패한다.

재현 절차: 앱 종료 후 `npm run dev` 로 다시 시작 → 첫 화면 진입 시 콘솔에 타임아웃 에러.

수정 방향 후보 (Plan AI 참고용):
- `runAutoflowCached` 가 캐시 미스에서 stale/empty 결과를 즉시 반환하고 백그라운드 갱신 (stale-while-revalidate). 그래서 readBoard 의 critical path 에서 metrics 가 빠짐.
- 또는 metrics 를 readBoard 본체에서 떼서 별도 IPC (`autoflow:readMetrics` 등) 로 lazy 로드, 화면이 뜬 뒤 비동기로 채움.
- 또는 CLI `metrics` 자체를 증분 캐시 (token report 330건 집계 등 무거운 부분) 로 빠르게.

## Hints

### Scope

- apps/desktop readBoard 콜드 스타트 진단 병목 해소

### Allowed Paths

- `apps/desktop/src/main.js`
- `apps/desktop/src/renderer/main.tsx`
- `.autoflow/scripts/cli/`

### Verification

- Command: 데스크톱 앱 콜드 스타트(npm run dev) 후 readBoard 가 30초 안에 응답하고 콘솔에 IPC 타임아웃 에러가 없음. metrics 는 lazy 또는 stale-while-revalidate 로 표시.

## Planner Contract

- Plan AI treats this memo as an implementation directive, infers concrete scope from repository context, and promotes it into a generated backlog PRD and todo ticket.
- Plan AI must not turn memo intake into a repeated human-question loop. Only unsafe requests should be blocked; otherwise use the safest narrow interpretation.
