# Autoflow Order

## Order

- ID: order_134
- Title: 🚨 bash/awk subshell leak (~1500개) — IDE git fork 실패 root cause
- Status: inbox
- Created At: 2026-05-03T10:22:02Z
- Source: autoflow order create

## Request

## Request

Autoflow CLI 가 bash/awk subshell 을 leak 하여 사용자의 시스템 자원을 잠식. 사용자의 IntelliJ IDE 가 git fork 실패:
```
Failed to start Git process: Cannot run program "/usr/bin/git": posix_spawn failed, error: 0 (none)
```

이는 시스템 process limit 도달 신호. **1원칙(목표 달성까지 멈추지 않음)이 사용자의 호스트 환경 자체를 망가뜨림**.

## 측정 (T+~130분)

```
total user process:  2014
  bash:                957  ← Autoflow 가 spawn 한 subshell
  awk:                 470
  (bash) defunct:       26
  (awk) defunct:        17
  sleep:                11   (run_with_timeout watchdog)
  /bin/sh:              10
  ---
  autoflow 직접:      ~1500
ulimit -u (max):     4000
사용률:               50%+
```

zombie 0 (reap 자체는 됨). 그러나 살아있는 bash 957 개 = autoflow 가 매 tick 마다 새 subshell 을 spawn 하지만 끝난 후 즉시 종료 안 됨. 또는 backgrounded 후 영원히 sleep.

## Hypotheses

A) **`run_with_timeout` watchdog**: `packages/cli/run-role.sh:2008-2075`. 매 어댑터 호출 시 `sleep $timeout & watchdog_pid=$!` 패턴 — 어댑터가 빨리 끝나면 sleep 을 명시적 kill 해야 하는데 일부 path 에서 누락.

B) **`metrics-project.sh` / `wiki-project.sh` 의 awk subshell**: `telemetry_extract_token_components_from_logs` 가 매 호출마다 awk 시작 — 끝나면 정리되어야 하는데 부모 bash 가 wait 안 함.

C) **runner 의 main loop**: `runners-project.sh loop-worker` 가 60s interval 마다 새 bash sub-shell spawn 하면서 이전 subshell 이 정상 종료 안 됨.

## Suggested Fix

A) **`run_with_timeout` cleanup 보강**:
- `set -E -o errtrace` + `trap 'kill -- -$$ 2>/dev/null' EXIT`
- watchdog `sleep` 의 PID 저장 후 어댑터 정상 종료 시 `kill -KILL "$watchdog_pid"` 보장.

B) **bash subshell pool / process count 모니터링**:
- 매 tick 시작 시 `pgrep -P $$ -c | wc -l` 으로 자식 수 체크. 임계 (예: 50) 초과 시 경고.

C) **runner 가 자기 process tree 정리**:
- `runners-project.sh stop <id>` 가 process group 전체 kill (`kill -- -$pgid`). 현재 SIGTERM 보낼 가능성 있는데 children 누수.

D) **시스템 보호 가드**:
- runner main loop 시작 시 system process 수 체크. >2000 이면 자기 자신 정지 + warning emit. 1원칙 우선이지만 사용자 시스템을 망가뜨리면 1원칙 자체가 깨짐.

## Allowed Paths

- packages/cli/run-role.sh
- packages/cli/runners-project.sh
- packages/cli/cleanup-runner-logs.sh (확장하여 cleanup-runner-procs)

## Verification

```bash
# 4 runner 30분 active 후
ps -ef | grep -E "bash|awk" | grep -v grep | wc -l
# 100 미만 (현재 1500 → 90% 이상 감소 목표)
ps -axo state | grep -c "Z"
# 0 유지
ps -axo command | grep "sleep 1200" | wc -l
# 이전 어댑터 호출 종료 후 0
```

## Notes

- order_132 (IPC timeout) 의 또 다른 비독립적 원인 — 시스템 부하가 doctor/metrics 의 35s 까지 가는 것에도 기여.
- **사용자의 IDE / OS 가 영향받기 시작했다는 점이 핵심.** 1원칙이 호스트 시스템 안정성을 침범하면 안 됨.
- ulimit -u 4000 은 macOS 기본. 더 높은 값으로 우회는 임시방편이고 진짜 해결 아님.
- order_127 (self-resurrect) 이후 더 많은 runner 가 자율 부활하면서 leak 가속 가능성. self-heal 코드 추가가 leak 도 같이 가속한 가능성 점검 필요.

## Hints

### Scope

- pending Plan AI inference

### Allowed Paths

- `packages/cli/run-role.sh`
- `packages/cli/runners-project.sh`

### Verification

- Command: ps -ef | grep -E 'bash|awk' | grep -v grep | wc -l

## Planner Contract

- Plan AI treats this order as an implementation directive, infers concrete scope from repository context, and promotes it into a generated backlog PRD and todo ticket.
- Plan AI must not turn order intake into a repeated human-question loop. Only unsafe requests should be blocked; otherwise use the safest narrow interpretation.
