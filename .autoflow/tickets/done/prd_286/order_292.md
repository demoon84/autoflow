# Autoflow Order

## Order

- Title: ticket-owner 두 번째 워커 추가 (worker-2)
- Depends On: order_291
- Priority: high
- Status: blocked-on-order-291
- Change Type: infra

## Request

Order 291 (path conflict guard race fix) 이 머지되고 단일 워커 환경에서
race 차단 가드가 안정 동작 확인된 뒤 켠다.

해야 할 것:
.autoflow/runners/config.toml 에 두 번째 [[runners]] 블록 추가.
- id = "worker-2" (현 worker 는 id 그대로 유지, 사용자 표기는
  AGENTS.md rule 16 에 따라 자동으로 worker-1 / worker-2 로 변경)
- role = "ticket-owner"
- model = 현 worker 와 동일 (gpt-5.3-codex-spark)
- enabled = true
- realtime_enabled = true
- interval_seconds = 1800 (현 worker 와 동일)

검증 핵심:
disjoint 한 Allowed Paths 를 가진 todo 2개를 동시 투입했을 때 양쪽
워커가 각각 1개씩 잡아 병렬 진행. overlap 된 todo 2개 투입 시에는
Order 291 의 가드가 동작해 1개만 inprogress 진입.

## Allowed Paths

- .autoflow/runners/config.toml

## Done When

- [ ] config.toml 에 두 번째 ticket-owner [[runners]] 블록이 추가되고 enabled=true
- [ ] 데스크탑 UI 의 worker 표기가 worker-1 / worker-2 로 분리 표시 (AGENTS.md rule 16)
- [ ] disjoint todo 2개를 동시 투입 시 양쪽 워커가 각각 1개씩 잡아 inprogress 가 2개로 늘어남
- [ ] overlap todo 2개를 동시 투입 시 Order 291 의 race 차단이 동작해 inprogress 는 1개만 (회귀)
- [ ] 두 워커가 30분 이상 안정 tick (PTY stall 없음, runner state 정상 갱신)

## Verification

- Command: ls .autoflow/tickets/inprogress/Todo-*.md | wc -l 로 동시 투입 시나리오 카운트 검증

## Notes

- 반드시 Order 291 이 done 으로 들어간 다음에 promote (Planner 가 Status: blocked-on-order-291 을 보고 보류)
- 처리량 ~1.8x 기대, 비용 정확히 2배 — wiki RAG cache miss 추이 모니터링
- 추후 worker-3 검토는 본 ticket 안정화 1~2주 후 별도
