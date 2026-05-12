# Autoflow Order

## Order

- Title: Verifier runner 부활 — 가벼운 외부 검증자 (Haiku-class)
- Depends On: order_293
- Priority: high
- Status: blocked-on-order-293
- Change Type: infra

## Request

2026-05-07 에 제거된 verifier runner 를 가벼운 형태로 재도입. worker 가 pass 한
ticket 을 done 으로 옮기기 전 독립 AI 가 diff 와 Acceptance Probe 를 의미 검증.

해야 할 것:
1. 4번째 [[runners]] 블록 추가 — role=verifier, model=Haiku-class
2. tick 주기: worker pass 직후 이벤트 기반 (realtime), 빈도 낮음 → 비용 억제
3. 동작: inprogress→done 이동 직전 ticket 을 잡아서:
   - diff 가 ticket Title/Goal 과 의미적으로 일치하는가
   - Acceptance Probe(order_293) 결과 정합성
   - 불일치 시 ticket 을 inbox retry order 로 되돌리기 (failure_class=verifier_semantic_mismatch)
4. .autoflow/agents/verifier-agent.md 신규 작성

## Allowed Paths

- .autoflow/runners/config.toml
- .autoflow/agents/verifier-agent.md
- .autoflow/scripts/finish-ticket-owner.sh
- .autoflow/scripts/start-verifier.ts

## Done When

- [ ] config.toml 에 verifier runner 블록 추가, enabled=true
- [ ] worker pass 직후 verifier 가 자동 wake 해 의미 검증 수행
- [ ] 의도적 의미 불일치 fixture (diff 와 Title 무관) 에서 verifier 가 차단해 inbox retry 발행
- [ ] 정상 ticket 통과 시 done 으로 진행 (verifier latency 측정 로그)
- [ ] AGENTS.md / CLAUDE.md 토폴로지 표기 갱신 (3-runner → 4-runner)

## Verification

- Command: fixture ticket pass 시뮬레이션 후 done 이동 여부 + inbox retry 발행 여부 확인

## Notes

- 2026-05-07 제거 결정 번복이므로 사용자 합의 이미 받음 (자율주행 임계 경로)
- Haiku-class 채택으로 비용 worker 의 1/10 수준
- order_293(Acceptance Probe) 이 먼저 머지되어야 검증 대상이 존재
