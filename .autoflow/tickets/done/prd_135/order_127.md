# Autoflow Order

## Order

- ID: order_127
- Title: Autoflow 1원칙 자율 self-resurrect: desktop 재시작 시 runner 복구 부재
- Status: inbox
- Created At: 2026-05-03T09:35:10Z
- Source: autoflow order create

## Request

## Request

Autoflow 의 1원칙 — *"사용자가 명시적으로 정지하지 않는 한 목표 달성까지 멈추지 않는다"* — 가 desktop app 재시작 / 호스트 재기동 / SIGHUP 시점에 깨진다.

관찰 (2026-05-03 09:01:29Z 시점):
- 사용자 명시적 정지 신호 없음
- 데스크톱 앱이 dev mode 에서 재시작됨 (HMR / electron reload)
- 동일 timestamp 09:01:29Z 에 `planner / worker / wiki / verifier` 4개 runner state 모두 `status=stopped, last_result=loop_stopped` 으로 일괄 정지
- 그 상태로 약 10분간 자기 회복 없이 대기 (state 파일 timestamp 변동 없음, 로그 추가 없음, telemetry 추가 없음)
- 외부 개입(`bin/autoflow runners start <id>`) 후에야 다시 running

즉 desktop process 가 runner 들의 lifecycle owner 인데, **desktop 종료/재시작이 runner 종료를 유발하지만 desktop 재기동이 runner 자동 재기동까지 보장하지 못함**. 이는 1원칙 위반이 시간 단위로 일어날 수 있는 상황.

## Symptoms

- 모든 4개 runner 의 `last_result=loop_stopped` 가 정확히 같은 second 에 기록 → desktop process 가 SIGTERM 보낸 흔적
- `status=stopped` 만으로 자체 회복하는 runtime path 없음
- `runner_status_count` (`bin/autoflow metrics`) 의 `runner_stopped_count` 가 양수일 때 어떤 runtime daemon 도 일으켜 세우지 않음

## Suggested Fix

A) **desktop main.js 의 startup hook 에 runner self-heal**:
- `apps/desktop/src/main.js` 의 ready/whenReady 에서 enabled=true 인 runner 가 `status=stopped` 이고 사용자 명시 stop 흔적 (`stopped_by=user` 같은 marker) 이 없으면 자동으로 `bin/autoflow runners start <id>` 를 호출.
- 사용자 정지 의도 marker 가 필요 — `runners stop <id> --user` 같은 옵션 + state 파일에 `stopped_by=user` 저장.

B) **자율 watchdog (root 1원칙) — 외부 launcher**:
- launchd plist (macOS) / systemd unit (linux) 가 `bin/autoflow runners ensure-running` 을 1분 주기로 실행. 사용자 명시 정지 signal 외에는 항상 enabled runner 를 living 상태로 유지.

C) **runner-side cooperative**:
- `runners-project.sh loop-worker <id>` 의 SIGTERM trap 에서 `status=stopped` 으로만 마크하지 말고 `last_stop_reason=parent_terminated` 같은 hint 도 같이 저장 → desktop 재시작 시 hint 보고 자동 재기동 결정.

권장: A 가 가장 즉각적이고 1원칙에 직결. B 는 desktop 안 켜졌을 때도 보장하는 강한 안전망. C 는 의도/비의도 구분 인프라.

## Allowed Paths

- apps/desktop/src/main.js
- packages/cli/runners-project.sh
- 또는 새 packages/cli/ensure-runners-running.sh

## Verification

```bash
# 1. 모든 runner stop
for r in planner worker wiki verifier; do bin/autoflow runners stop "$r" /Users/demoon2016/Documents/project/autoflow .autoflow; done
# 2. desktop app 재시작 (또는 main.js startup hook 트리거)
# 3. 5초 후 state 확인
sleep 5; for r in planner worker wiki verifier; do grep '^status=' .autoflow/runners/state/${r}.state; done
# 기대: 모두 status=running (사용자 명시 stop marker 가 없으므로 자동 부활)
```

## Notes

- 이 PRD 는 Autoflow 첫 원칙 자체의 구현 보강. 다른 어떤 자동화보다 우선.
- 현재 임시방편으로 `/tmp/autoflow-watch/check-and-restart.sh` 외부 helper 로 우회 중이지만 Autoflow 가 자체 책임으로 가져가야 하는 영역.
- "사용자 명시 stop" 신호 정의가 핵심 — UI 의 stop 버튼은 user, OS shutdown 은 user 아님, 개발 reload 도 user 아님.

## Hints

### Scope

- pending Plan AI inference

### Allowed Paths

- `apps/desktop/src/main.js`
- `packages/cli/runners-project.sh`

### Verification

- Command: for r in planner worker wiki verifier; do grep '^status=' .autoflow/runners/state/${r}.state; done

## Planner Contract

- Plan AI treats this order as an implementation directive, infers concrete scope from repository context, and promotes it into a generated backlog PRD and todo ticket.
- Plan AI must not turn order intake into a repeated human-question loop. Only unsafe requests should be blocked; otherwise use the safest narrow interpretation.
