# Autoflow Order

## Order

- ID: order_136
- Title: 🚨 listRunners IPC fork-bomb (2312 instance) — desktop UI critical
- Status: inbox
- Created At: 2026-05-03T10:36:39Z
- Source: autoflow order create

## Request

## Request

🚨 critical — desktop `listRunners` IPC 가 **fork-bomb** 으로 동작. 실시간 감시(`/tmp/autoflow-watch/realtime-watch.sh`)가 ~3분 만에 bash+awk **12 → 2453** 폭증을 캐치.

직접 측정 (T+~150분 시점):
```
PPID 17039 (Electron main) 의 자식 분포:
  bash 1294개   ← 같은 명령
  command:      bash runners-project.sh list <project> .autoflow
  total:        2312 instance 동시 실행 중
```

`/usr/bin/env 322`, `(bash) 118 defunct`, `(awk) 51 defunct`, `dirname 32` 도 모두 이 fan-out 의 부산물.

## Root Cause

`apps/desktop/src/main.js` 의 `listRunners` IPC handler 가 매 호출마다 `runners-project.sh list` 를 spawn 하는데:
- handler 가 30s timeout 으로 끊겨도 spawn 된 bash 는 alive
- renderer 가 frequent 하게 listRunners 호출 (polling? React effect retrigger?)
- 또는 `runners-project.sh list` 자체가 내부에서 다시 다른 CLI 를 spawn 하면서 fan-out 가속

`readBoard` 가 30s timeout 으로 떨어진 후 renderer 가 retry → 또 spawn → leak 가속. order_132 (IPC timeout) 이 본 issue 를 가속하는 피드백 루프.

## Suggested Fix (urgent)

A) **listRunners spawn 캐싱**:
- main.js 에서 inflight Promise 추적 — 이미 진행 중이면 동일 Promise 반환, 새 spawn 금지
- TTL 캐시 (예: 2초) — 그 안의 호출은 cached

B) **timeout 시 spawned child 강제 kill**:
- `withTimeout` wrapper 가 timeout 시 SIGTERM → 1s 후 SIGKILL 까지 child process 책임
- 현재 timeout 은 promise 만 reject 하고 child cleanup 안 함

C) **renderer side debounce**:
- listRunners 호출 빈도 throttle (예: 최소 5초 간격)

D) **fork-bomb 방어 가드**:
- main.js 가 자기 자식 process 수 모니터링 (e.g., 200 초과시 모든 신규 spawn reject)
- emergency: `ps --ppid $$ | wc -l > 200` 시 새 IPC reject + UI에 경고

## Allowed Paths

- apps/desktop/src/main.js (`listRunners`, `withTimeout`, `runAutoflow`)
- packages/cli/runners-project.sh (만약 자기-호출 루프 있으면)

## Verification

```bash
# desktop 켠 상태에서 보드 화면 30초 유지
ps -ef | awk '$3==<electron_main_pid> {print $8}' | sort | uniq -c | sort -rn | head -5
# bash <50 이어야 함 (현재 1294)
ps -ef | grep -c "runners-project.sh list"
# < 5 이어야 함 (현재 2312)
```

## Immediate Mitigation (사용자에게)

```bash
# 임시로 leak 정리 (fix 전)
pkill -f "runners-project.sh list"
# desktop UI 의 보드/runners 화면 잠시 닫기
```

## Notes

- order_134 (broad bash leak) 의 정확한 root cause specification.
- order_132 (IPC timeout) 와 피드백 루프 — IPC timeout → renderer retry → 더 많은 spawn → 더 큰 leak → IPC 더 느려짐.
- 1원칙은 자율 흐름인데 이 fork-bomb 이 호스트 자원을 잠식해 그 자율 흐름 자체를 위협. 1원칙 보존 위해 즉시 fix.

## Hints

### Scope

- pending Plan AI inference

### Allowed Paths

- `apps/desktop/src/main.js`
- `packages/cli/runners-project.sh`

### Verification

- Command: ps -ef | grep -c 'runners-project.sh list'

## Planner Contract

- Plan AI treats this order as an implementation directive, infers concrete scope from repository context, and promotes it into a generated backlog PRD and todo ticket.
- Plan AI must not turn order intake into a repeated human-question loop. Only unsafe requests should be blocked; otherwise use the safest narrow interpretation.
