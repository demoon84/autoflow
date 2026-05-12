# Autoflow Order

## Order

- Title: 워커 dispatcher race 차단 + path conflict guard 기본 활성화
- Priority: high
- Status: ready
- Change Type: code

## Request

워커 2명 운영을 안전하게 만들기 위한 1단계.

현재 path-conflict-check 가드는 inprogress 만 비교해서, 두 워커가
동시에 dispatcher 를 호출하는 그 짧은 순간에 둘 다 통과해 동일 영역의
todo 를 잡아버리는 race window 가 있다.

해야 할 것:
1. dispatcher (.autoflow/scripts/start-ticket-owner.legacy.sh 의
   find_next_dispatchable_todo) 진입을 mkdir mutex 로 보호.
   - lock dir: .autoflow/runners/state/dispatch.lock/
   - 안에 PID 파일을 두고, 다음 워커가 진입 시 kill -0 으로 liveness 확인,
     죽은 워커의 stale lock 은 30초 timeout 후 자동 회수.
2. AUTOFLOW_PATH_CONFLICT_CHECK 미설정 시 기본을 on 으로 간주
   (명시적 off 만 끄도록). 단일 워커 환경에서도 가드 비용은 무시 가능.
3. AGENTS.md rule 24 의 default 표기 갱신
   ("default off, opt-in" → "default on; opt-out via off"). 본 race window
   차단 사실 한 줄 추가.

검증 핵심:
overlap 된 Allowed Paths 를 가진 가짜 todo 2개를 만들고 두 워커 PID 로
동시 dispatcher 호출 → inprogress 에 항상 1개만 들어가야 함.

## Allowed Paths

- .autoflow/scripts/start-ticket-owner.legacy.sh
- .autoflow/scripts/common.sh
- AGENTS.md

## Done When

- [ ] overlap 된 Allowed Paths 를 가진 todo 2개를 동시 dispatcher 호출 시 inprogress 는 정확히 1개만
- [ ] dispatcher 도중 강제 종료된 워커의 stale lock 을 다음 dispatcher 가 PID liveness 확인 후 회수 (수동 SIGKILL 시나리오)
- [ ] AUTOFLOW_PATH_CONFLICT_CHECK 미설정 환경에서 walk 가드 모드 동작 (명시적 off 만 끔)
- [ ] AGENTS.md rule 24 본문이 "default on; opt-out via off" 로 갱신
- [ ] path-conflict-check.ts 회귀 (overlap exit 1, disjoint exit 0, unresolvable exit 1) 그대로 통과

## Verification

- Command: bash .autoflow/scripts/path-conflict-check.sh <fixture-a.md> <fixture-b.md> 회귀 + 동시 dispatcher 스니펫

## Notes

- Lock 메커니즘: mkdir mutex (macOS flock 부재 회피, 워커 2개 한정에선 직렬화 병목 무시 가능)
- 단일 워커 환경에서도 안전망으로 의미 있음 — Order 292(워커 추가)와 분리해 먼저 안정화
- Order 292 는 본 ticket done 이후 발행/promote
