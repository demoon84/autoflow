# Autoflow Order

## Order

- ID: order_133
- Title: doctor/metrics 동시 실행시 35s+ lock — IPC timeout root cause
- Status: inbox
- Created At: 2026-05-03T10:21:26Z
- Source: autoflow order create

## Request

## Request

`bin/autoflow doctor` 와 `bin/autoflow metrics` 가 단독 실행은 1.5초 내인데 **동시 실행 시 35초 이상 걸린다**. desktop `readBoard` IPC 가 두 명령을 병렬 호출하므로 30s IPC timeout 의 root cause.

실측 (T+~125분 시점, 4 runner active):
```
status:            13.29s  ← 평소 0.35s, 약 30배 느림
doctor:            TIMEOUT_35s
metrics:           TIMEOUT_35s
stop-hook-status:   0.64s   (정상)
watch-status:       0.94s   (정상)
```

doctor/metrics 가 같은 자원을 직렬화 lock 으로 잡거나, 같은 무거운 디렉토리(.autoflow/logs/, .autoflow/tickets/done/, telemetry-runs.jsonl) 를 각자 traverse + cache miss race.

## Hypotheses (검증 후 fix)

A) **공유 lock / file mutex**: doctor 와 metrics 가 같은 cache 파일 (`.autoflow/metrics/*.jsonl`, `.autoflow/runners/state/*.fingerprint`) 에 flock 을 동시 요청 → 한쪽이 끝나야 다른 쪽 진행.

B) **directory traversal 중복**: 두 명령이 각자 `.autoflow/logs/` (107 파일) + `tickets/done/` (135 디렉토리, 수백 sub-file) 을 traverse. 4 runner 의 동시 disk I/O 와 겹쳐 wait.

C) **status 도 13s 로 함께 느려짐** → 단순 "doctor↔metrics 충돌" 이 아니라 **runner 들의 active write 가 read 명령을 직렬화**. 가능성 높음.

## Suggested Fix

A) **두 명령 결과 캐시 + TTL stale-while-revalidate**:
- doctor / metrics 결과를 `.autoflow/metrics/desktop-cache.json` 에 TTL 30s 로 저장
- desktop main.js 가 cache 즉시 읽고 background 에서만 refresh — IPC 응답 시간 < 100ms

B) **directory traversal 가드 — 동시성 1 limit**:
- `metrics-project.sh` / `doctor-project.sh` 시작 시 `.autoflow/runners/.cli-traversal.lock` flock NOWAIT — 잡혀있으면 즉시 stale cache 반환

C) **doctor / metrics 내 expensive section 식별 후 lazy / bg 로 분리**:
- `count_autoflow_token_metrics`, `verifier_pass_count` 등 수백 파일 stat 하는 부분만 별도 daemon 또는 jsonl tail 로 incremental 계산.

D) **(보조) IPC timeout 60s 로 완화 + partial 반환** — order_132 와 묶을 수 있음.

## Allowed Paths

- packages/cli/metrics-project.sh
- packages/cli/doctor-project.sh
- apps/desktop/src/main.js (cache layer)

## Verification

```bash
# 4 runner active 상태에서
python3 -c "
import subprocess, time, threading
results={}
def run(cmd):
    s=time.time()
    r=subprocess.run(['bin/autoflow',cmd],capture_output=True,timeout=10)
    results[cmd]=time.time()-s
ts=[threading.Thread(target=run,args=(c,)) for c in ['status','doctor','metrics','stop-hook-status','watch-status']]
[t.start() for t in ts]; [t.join() for t in ts]
print(results)
"
# 모두 < 5s 이어야 함 (IPC 30s timeout 안에 충분히 들어옴)
```

## Notes

- order_132 (IPC timeout) 의 root cause. 묶어서 PRD 로 합쳐도 됨.
- 1원칙 표면 가시성 파괴의 직접 원인 — 사용자가 보드 못 봄 = 자동화 흐름 신뢰 못함.

## Hints

### Scope

- pending Plan AI inference

### Allowed Paths

- `packages/cli/metrics-project.sh`
- `packages/cli/doctor-project.sh`
- `apps/desktop/src/main.js`

### Verification

- Command: true # 동시 실행 < 5s

## Planner Contract

- Plan AI treats this order as an implementation directive, infers concrete scope from repository context, and promotes it into a generated backlog PRD and todo ticket.
- Plan AI must not turn order intake into a repeated human-question loop. Only unsafe requests should be blocked; otherwise use the safest narrow interpretation.
