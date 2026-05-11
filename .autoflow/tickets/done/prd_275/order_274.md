# Autoflow Order

## Order

- Title: PRD_274 wake-poll 실효성 검증 + 미발사 원인 진단 — wake-poll.log 가 0바이트
- Priority: high
- Status: ready
- Change Type: code

## Request

PRD_274 (commit b9cd266) 가 PTY wake 안전망 (queueHasPendingWork 게이트 + idle 감지 + setInterval polling) 을 추가했다고 표기됐고 main.js 에 `wakePollState`, `queueHasPendingWork`, wake-poll 로그 append 코드가 실제로 존재한다 ([main.js:753-826](apps/desktop/src/main.js:753)). 그러나 `.autoflow/runners/logs/wake-poll.log` 파일이 **한 번도 생성된 적이 없다**. polling tick 자체가 발사 안 되거나, 발사돼도 항상 게이트 거부로 로그 라인 0줄로 끝나는 상태로 보인다.

검증 필요:
1. setInterval 이 실제 등록됐는지 (env knob `AUTOFLOW_WAKE_POLL_INTERVAL_SEC` 기본값 동작)
2. queueHasPendingWork 가 큐 비어 있을 때 false 반환은 정상이지만, 큐에 todo 가 있는 동안에도 wake 가 안 나갔는지 (오늘 testT order 들 진행 시 wake 가 fs.watch 만으로 깬 건지)
3. wake-poll.log append 경로가 실제로 실행되는지 (코드 점검)
4. 만약 false-pass 였다면 PRD_274 의 핵심 부분이 미작동

## Allowed Paths

- apps/desktop/src/main.js
- .autoflow/runners/logs/wake-poll.log (검증용)

## Done When

- [ ] main.js 의 wake-poll setInterval 초기화 코드 위치 명시 (라인 번호)
- [ ] env knob 3개 (`AUTOFLOW_WAKE_POLL_INTERVAL_SEC`, `AUTOFLOW_WAKE_IDLE_THRESHOLD_SEC`, `AUTOFLOW_WAKE_STALL_THRESHOLD_SEC`) 가 main.js 안에서 실제 참조되는지 확인
- [ ] 테스트 시나리오 — 모든 PTY 살아 있고 큐에 inbox/todo 가 있는 상태에서 60초 폴링 tick 발사 확인 (wake-poll.log 에 JSONL 1줄 이상 생성)
- [ ] 발사 안 됐다면 원인 진단 후 수정 (setInterval 미등록 / runner_id 매핑 누락 / fs.appendFileSync 권한 등)
- [ ] 검증 후 wake-poll.log 에 최소 5분간 누적된 JSONL 행이 ≥3 (정상 polling 빈도)

## Verification

- Command: ls -la .autoflow/runners/logs/wake-poll.log && tail -3 .autoflow/runners/logs/wake-poll.log

## Notes

- PRD_274 false-pass 의심 케이스. Todo-281 (commit b9cd266) 의 변경 파일 통계로 main.js 변경 확인됐지만 런타임 미작동 가능성 있음.
- 같은 패턴 — agent.md 의 .js 안내 → wrapper 누락 (이미 order_234 가 false-pass 였던 사례) 의 재발일 수 있음.
