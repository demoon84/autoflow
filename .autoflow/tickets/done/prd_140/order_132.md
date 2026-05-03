# Autoflow Order

## Order

- ID: order_132
- Title: desktop IPC readBoard 30s timeout 1원칙 위반 (UI 흐름 가시성)
- Status: inbox
- Created At: 2026-05-03T10:11:59Z
- Source: autoflow order create

## Request

## Request

Desktop app 에서 다음 에러가 발생:
```
Error invoking remote method 'autoflow:readBoard': Error: autoflow IPC handler timed out after 30000ms
```

`readBoard` IPC 가 30초 안에 응답 못함 → 1원칙 위반 (UI 가 보드 못 읽으면 사용자가 자동화 흐름을 추적 불가). 사용자가 흐름 끊김을 직접 본 것.

## Root Cause 분석

`apps/desktop/src/main.js:2215-2300` 의 `readBoard` 가 다음을 한 IPC handler 안에서 직렬+병렬 수행:

병렬 (`Promise.all`):
1. `autoflow status`
2. `listRunners` (모든 runner state 파일 stat + history)
3. `autoflow doctor` (cached)
4. `autoflow metrics` (cached **or refresh**)
5. `autoflow stop-hook-status`
6. `autoflow watch-status`

직후 직렬:
- `listTicketFolders` + 각 폴더의 `listMarkdownFiles` (done/ 에 135 디렉토리, prd_NNN/ 안에 5+ 파일/디렉토리 = 수백 stat)
- `listMarkdownFiles(logs)` limit=12
- `listTextFiles(runners/logs)` limit=16
- `listMarkdownFiles(wiki)` limit=24
- `listTextFiles(metrics)` limit=8
- `readMetricsHistory(boardRoot)`
- `listMarkdownFiles(conversations)` limit=25

평시 측정 (T+~115분 시점):
- status 0.35s, doctor 1.56s, metrics 1.24s, stop-hook 0.13s, watch 0.06s
- 합계 (병렬 part): max ≈ 1.56s
- 30s 까지 가는 건 4 runner 가 동시에 codex/claude/gemini 어댑터 실행하면서 disk I/O 부하 + git worktree 동시성 + cache refresh 가 lock 잡힌 케이스

## Suggested Fix

A) **cached path 우선 + background refresh 패턴** (1원칙 핵심):
- `runAutoflowCachedOrRefresh` 가 cache 유효시 즉시 반환, 만료시도 *옛 값을 즉시 반환* + background 에서 refresh.
- `readBoard` 의 모든 sub-call 을 이 패턴으로 통일 → 응답 즉시, 데이터 다음 tick 갱신.

B) **timeout 자체를 늘리기 (보조)**:
- 30000ms → 60000ms (또는 90000ms). 단순 증가는 근본 해결 아님 — A 와 함께.

C) **handler 분할**:
- `readBoard` 를 `readBoardCore` (status, runners, ticket folders) + `readBoardAux` (doctor, metrics, history, conversations) 로 분할.
- 첫 IPC 가 빠르게 답하고 둘째는 별도 호출로 lazy load.
- renderer 는 두 번째 결과를 progressive 로 채움.

D) **graceful timeout fallback**:
- timeout 이 발생해도 부분 결과 (이미 끝난 sub-call) 만 모아 반환 + `partial=true` 마크. UI 는 partial 데이터로 일단 그리고 retry.

E) **장기 부하 모니터링**:
- IPC 호출 timing 을 telemetry 에 기록 → 어느 sub-call 이 늘어지는지 가시화.

권장: A + C + E 조합. D 는 안전망.

## Allowed Paths

- apps/desktop/src/main.js
- (선택) packages/cli/metrics-project.sh, doctor-project.sh — 캐시 가능성 보강

## Verification

```bash
# UI 재현 (사용자 액션)
# 1. 부하 조건: 4 runner 모두 active + worker 가 무거운 ticket 처리
# 2. desktop UI 의 보드 화면 새로고침 5회
# 3. 30초 안에 보드 데이터가 (cached 값이라도) 항상 화면에 그려지는지 확인
# 4. 로그: console.error 에 "IPC handler timed out" 0건
```

## Notes

- 1원칙의 UI 표면. runner 자율은 잘 도는데 사용자가 그 흐름을 못 보면 효용 0.
- order_127 (self-resurrect) 가 흐름 자체의 견고성을 다뤘다면, 이 PRD 는 **흐름 가시성** 의 견고성.
- A 패턴 (즉시 반환 + 백그라운드 refresh) 는 PRD_129 의 token aggregation 에서 이미 이미 부분적으로 사용 중.

## Hints

### Scope

- pending Plan AI inference

### Allowed Paths

- `apps/desktop/src/main.js`

### Verification

- Command: true # UI 재현 검증

## Planner Contract

- Plan AI treats this order as an implementation directive, infers concrete scope from repository context, and promotes it into a generated backlog PRD and todo ticket.
- Plan AI must not turn order intake into a repeated human-question loop. Only unsafe requests should be blocked; otherwise use the safest narrow interpretation.
