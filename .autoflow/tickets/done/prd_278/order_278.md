# Autoflow Order

## Order

- Title: 티켓 사이 컨텍스트 리셋 자동화 — claude `/compact`, codex `/compact`, gemini `/compress` 인젝션 + 임계 초과 시 강제 reset
- Priority: high
- Status: ready
- Change Type: code

## Request

PTY mode 러너의 LLM 세션은 매 턴마다 이전 대화 전체를 input 으로 보낸다. 하루 가동 시 누적 컨텍스트가 200k window 한계에 가까워지면서 한 턴당 비용이 선형 증가하고, 5분 prompt cache TTL 을 벗어난 idle 후엔 full uncached 비용 결제가 발생한다.

증거:
- worker.state `cumulative_tokens` 가 PTY 가동 중 단조증가 (현재 20,200, 단일 세션 7시간 분)
- claude/codex/gemini 모두 컨텍스트 압축/리셋 슬래시 명령 보유 (직접 검증 완료, 이전 응답 참고)
- Autoflow 의 입력 cap 은 새 wake 텍스트만 자르고, 세션 누적분은 못 자름

스펙: 티켓 완료(pass) 직후 finalizer 가 agent 별 적절한 슬래시 명령을 PTY 에 자동 주입해 다음 티켓을 fresh-ish 컨텍스트로 시작하게 한다. 추가로 누적 토큰이 임계를 넘으면 더 공격적인 full reset 으로 escalate.

## Allowed Paths

- apps/desktop/src/main.js
- apps/desktop/src/main/runner-pty-manager.js
- .autoflow/scripts/finish-ticket-owner.ts
- runtime/board-scripts/finish-ticket-owner.ts
- .autoflow/agents/ticket-owner-agent.md
- AGENTS.md

## Done When

- [ ] `apps/desktop/src/main.js` 또는 `runner-pty-manager.js` 에 `injectContextReset(runnerId, mode)` 헬퍼 추가. mode = `compact` | `clear`
  - claude: compact→`/compact`, clear→`/clear`
  - codex: compact→`/compact`, clear→`/new` (fallback: SIGTERM + 재스폰)
  - gemini: compact→`/compress`, clear→`/chat new` (fallback: 재스폰)
- [ ] 슬래시 명령은 plain text + `\r` 로 전송 (bracketed-paste 마커 금지 — `/clear` 가 paste 안에서 무력화되는 사례 회피)
- [ ] `.autoflow/scripts/finish-ticket-owner.ts` 의 pass 경로 끝에서 IPC (또는 직접 헬퍼 호출) 로 `injectContextReset(runner, 'compact')` 트리거. fail 경로는 트리거 안 함 (재시도용 컨텍스트 유지)
- [ ] env knob `AUTOFLOW_CONTEXT_RESET_BETWEEN_TICKETS` (기본 `1` = on, `0` 으로 비활성)
- [ ] env knob `AUTOFLOW_CONTEXT_RESET_TOKEN_THRESHOLD` (기본 `100000`). worker.state `cumulative_tokens` 가 이 값을 넘으면 escalate: compact 대신 full clear (`/clear` / `/new` / `/chat new`) 주입
- [ ] env knob `AUTOFLOW_CONTEXT_RESET_RESPAWN_FALLBACK` (기본 `1`). codex `/new` / gemini `/chat new` 가 30초 안에 effect 없으면 (cumulative_tokens 계속 증가) PTY 재스폰 fallback
- [ ] 인젝션 직후 워커가 새 컨텍스트로 wake 받도록 보장 — finalizer 가 reset 후 마지막에 `[wake] fresh-start` 한 줄 인젝션
- [ ] reset 발생 시 `.autoflow/runners/logs/<runner>.log` 에 1줄 JSONL: `{event:"context_reset", mode:"compact|clear", trigger:"between-tickets|token-threshold", cumulative_before:N, at:ISO}`
- [ ] `ticket-owner-agent.md` 와 `AGENTS.md` 에 한 줄 정책 명시 — "티켓 pass 직후 컨텍스트는 인프라가 자동 압축. AI 측은 별도 action 불필요"
- [ ] 회귀 테스트: express order 1개 발행→처리→pass 직후 `cumulative_tokens` 감소 또는 token_source 가 reset 직후 잠시 비워졌다가 다음 wake 시 새 값 박힘 확인
- [ ] runtime/board-scripts/ 미러 동기화

## Verification

- Command: grep -nE "injectContextReset|/compact|/clear|/compress" apps/desktop/src/main.js apps/desktop/src/main/runner-pty-manager.js && tail -5 .autoflow/runners/logs/worker.log | grep context_reset

## Notes

- 1원칙 보존: reset 실패해도 워커 정상 동작. 인프라 best-effort hook.
- 사용자 입력 (`AUTOFLOW_CONTEXT_RESET_BETWEEN_TICKETS=0`) 으로 완전 비활성 가능 — 디버깅 / 컨텍스트 유지 필요 시 사용.
- 슬래시 인젝션 검증 — codex `/new` 와 gemini `/chat new` 는 binary string 으로 직접 확인 안 됨. 첫 구현은 broker pattern 사용 — 실측 후 부족 시 PTY 재스폰 fallback 활성.
- 임계값 100k 는 200k context window 의 50% — 안전 마진. 추후 telemetry 보고 조정.
- claude `/compact` 는 요약을 보존하므로 작업 흐름 단절 없음. `/clear` 는 워커의 startup-scan 프롬프트가 다시 재구동돼야 동작 — 그래서 escalate 후 즉시 `[wake]` 주입 필수.
- 본 작업은 PRD_270 (runner-tokens 통합) 과 짝 — 토큰 측정이 정확해야 임계 트리거가 의미 있음. token_source=llm_reported 가 정상 박히는 환경 전제.
