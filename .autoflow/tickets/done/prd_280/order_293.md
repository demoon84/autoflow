# Autoflow Order

## Order

- Title: 티켓 도착 판정 다층화 — Acceptance Probe 섹션 도입
- Priority: high
- Status: ready
- Change Type: code

## Request

자율주행 1순위 약점: 현재 도착 판정은 sanity gate(zero-diff + Done When 체크)뿐이라
Planner 가 Done When 을 모호하게 박으면 의미 없는 통과가 가능하다. 의미 도달을
외부 관찰 가능한 신호로 추가 검증한다.

해야 할 것:
1. ticket / PRD 템플릿에 `## Acceptance Probe` 섹션 신설.
   - 1~3개의 외부 관찰 가능한 검증 (예: curl 200, 로그 라인, 스크린샷 diff, exit code)
   - Done When 과 분리, 의미 도달의 객관 지표
2. spec-author-agent / plan-to-ticket-agent prompt 에 Acceptance Probe 작성 강제.
3. finish-ticket-owner sanity gate 가 Acceptance Probe 실행을 추가 검증으로 사용.
   - 비어 있으면 차단 (`shell_sanity_gate_acceptance_probe_empty`)
   - 실행 실패 시 차단 (`shell_sanity_gate_acceptance_probe_failed`)
4. Change Type=docs/cleanup 은 probe 면제 (현 zero-diff 면제와 동일 정책)

## Allowed Paths

- .autoflow/agents/spec-author-agent.md
- .autoflow/agents/plan-to-ticket-agent.md
- .autoflow/scripts/finish-ticket-owner.sh
- .autoflow/scripts/finish-ticket-owner.ts
- .autoflow/templates/

## Done When

- [ ] 새 PRD/티켓 템플릿에 `## Acceptance Probe` 섹션 존재
- [ ] Planner adapter prompt 가 Acceptance Probe 작성을 강제 (출력에 섹션 포함)
- [ ] sanity gate 가 Acceptance Probe 미작성/실패 시 pass 차단
- [ ] Change Type=docs/cleanup 티켓은 probe 면제 (회귀 통과)
- [ ] AGENTS.md rule 8b/22 갱신 (sanity gate 정책 매트릭스에 probe 추가)

## Verification

- Command: 의도적으로 빈 probe 박은 fixture ticket 으로 sanity gate 실행, 차단 확인

## Notes

- Order 294(Verifier 부활)와 짝. 본 ticket 이 데이터 모델, 294 가 실행자
- 큰 변경 — Planner 가 generated PRD 로 승격할 가능성 높음
