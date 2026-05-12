# Autoflow Order

## Order

- Title: Meta-Runner — telemetry 읽고 자가 진단/조정
- Priority: normal
- Status: ready
- Change Type: infra

## Request

현재 telemetry / state.db / wake-poll.log 는 기록만 되고 행동에 반영 안 됨.
자율주행에서 자가 진단/조정 루프가 필요.

해야 할 것:
1. .autoflow/scripts/meta-runner.ts 신규 — 5번째 백그라운드 process (선택적 enable)
2. 주기: 5분 tick (interval_seconds=300)
3. 동작:
   - consecutive_timeout_count ≥ 3 시: 해당 runner 의 prompt cap 50% 축소 또는 모델 fallback hint emit
   - 동일 retry_fingerprint 2회 누적 시: Planner 에게 "다른 접근 시도하라" hint 주입 (sticky-context 활용)
   - wake-poll stall 패턴 (10분 이상 wake 없음) 시: interval_seconds 자동 단축
   - adapter_finish output_truncated=true 비율 ≥ 5% 시: max_output_tokens 상향 권장 emit
4. config: AUTOFLOW_META_RUNNER_ENABLED (기본 off, 1주 안정화 후 default on 검토)

## Allowed Paths

- .autoflow/scripts/meta-runner.ts
- .autoflow/runners/config.toml
- .autoflow/agents/meta-runner-agent.md

## Done When

- [ ] meta-runner.ts 가 telemetry/state.db/log 를 읽어 진단 보고서 생성
- [ ] consecutive_timeout 3회 fixture 에서 prompt cap 축소 hint emit 검증
- [ ] retry_fingerprint 반복 fixture 에서 sticky-context 에 다른 접근 hint 주입
- [ ] config off 일 때 비활성, on 일 때 5분 주기 동작

## Verification

- Command: fixture telemetry 주입 후 meta-runner.ts 1회 실행, 진단 보고서 stdout 확인

## Notes

- 자가 진단/자가 수정의 최소 형태 — 자율주행 완성도의 메타 layer
- order_295(sticky context) 가 먼저 머지되면 hint 주입 경로가 자연스러움
- 비용은 Haiku-class 한 번/5분 → 무시 가능
