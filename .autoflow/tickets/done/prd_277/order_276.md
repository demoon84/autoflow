# Autoflow Order

## Order

- Title: planner 121건 연속 `adapter_exit_2` 원인 진단 — 어제 17시 KST 폭증
- Priority: normal
- Status: ready
- Change Type: code

## Request

`telemetry/runs.jsonl` 분석 결과 어제 2026-05-10 07:07 UTC ~ 07:11 UTC (= 16:07~16:11 KST) 사이 planner runner 가 `adapter_exit_2` 로 121건 연속 실패. 같은 분에 plamner adapter (claude CLI) 가 exit code 2 로 끝남.

오늘 (재시작 후) 는 정상 동작 중이지만:
1. 원인 미상이면 같은 시간대 / 같은 환경 (sleep/wake, 호스트 부하, claude CLI 토큰) 에서 재발 가능
2. 121건 / 4분 = 분당 30회 — 1원칙(폴링 backoff) 무시 패턴. 정상이라면 timeout 후 backoff 가 늘어야 하는데 즉시 재시도가 폭주

진단 필요:
- 121건의 시작 시각 분포 (분당 패턴)
- exit_code=2 의 stderr 마지막 라인 (CLI 가 무슨 에러를 냄)
- 그 시간대 host 환경 (sleep 발생 / claude CLI 인증 만료 / disk 가득 / 등)
- backoff 가 동작 안 한 이유 (loop interval 무시?)

## Allowed Paths

- .autoflow/runners/logs/planner.log
- .autoflow/runners/logs/planner.loop.stderr.log
- .autoflow/telemetry/runs.jsonl (read-only)
- (분석 후 root cause 가 명확하면) packages/cli/start-plan.ts 또는 packages/cli/cli-common.sh

## Done When

- [ ] 어제 07:07-07:11 UTC 구간 telemetry 121건의 시작 시각 분포와 exit_code distribution 정리
- [ ] planner.loop.stderr.log 같은 구간 grep 결과 (claude CLI 가 출력한 에러 메시지)
- [ ] backoff 적용 여부 — `consecutive_timeout_count` 증가 패턴 확인 (state 또는 log)
- [ ] root cause hypothesis 1줄 + evidence 명시
- [ ] 재발 방지 권고안 (1) backoff 강화 (2) auth health check (3) sleep/wake hook 등 1줄 정리
- [ ] 만약 code fix 가 합당하면 작은 패치 추가 (예: `AUTOFLOW_AGENT_TIMEOUT_FALLBACK_THRESHOLD` 도달 시 그 후 N초 cool-down 추가)

## Verification

- Command: jq -rs --argjson f 1778130420 --argjson t 1778130660 '[.[] | select(.runner_id=="planner" and (.started_at|fromdateiso8601?//0)>=$f and (.started_at|fromdateiso8601?//0)<=$t)] | length' .autoflow/telemetry/runs.jsonl

## Notes

- 진단 우선, 코드 변경은 root cause 가 명확할 때만.
- 같은 시각 우리는 PRD_269 (runner-stage.ts 변환), Todo-275 작업 등 활발히 진행 중이었음 — 그 작업의 부작용일 가능성도 있음.
- adapter_exit_2 는 claude CLI 의 generic syntax/auth/setup error. 자동복구 안 됐을 가능성 있음.
