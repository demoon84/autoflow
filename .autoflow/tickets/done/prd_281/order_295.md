# Autoflow Order

## Order

- Title: Context Reset sticky prelude — /compact 후에도 핵심 제약 보존
- Priority: high
- Status: ready
- Change Type: code

## Request

현재 티켓 간 context reset (`/compact`, `/clear`) 은 누적 토큰만 보고 결정하며,
사용자 명시 제약 / Allowed Paths / Acceptance Probe 같은 핵심 컨텍스트가
함께 날아갈 수 있다. compact 후에도 반드시 유지되는 sticky context 를 분리.

해야 할 것:
1. .autoflow/runners/state/sticky-context.md 파일 도입 (워커별).
   - 현재 ticket 의 Allowed Paths, Done When, Acceptance Probe, 사용자 명시 제약
2. apps/desktop/src/main/runner-pty-manager.js 의 injectContextReset() 가
   `/compact` 또는 `/clear` 후 sticky-context.md 내용을 prompt prelude 로 재주입
3. env knob: AUTOFLOW_CONTEXT_RESET_STICKY=1 (기본 on)
4. AGENTS.md rule 19e 본문 갱신 (sticky 보존 정책 명시)

## Allowed Paths

- apps/desktop/src/main/runner-pty-manager.js
- apps/desktop/src/main.js
- AGENTS.md

## Done When

- [ ] sticky-context.md 가 ticket claim 시 자동 생성/갱신
- [ ] /compact 또는 /clear 주입 직후 sticky 내용이 다음 prompt prelude 에 포함됨 (PTY 출력 검증)
- [ ] AUTOFLOW_CONTEXT_RESET_STICKY=0 시 기존 동작 (sticky 없이 reset)
- [ ] AGENTS.md rule 19e 본문 sticky 정책 1단락 추가

## Verification

- Command: 가짜 ticket claim 후 /compact 트리거, 다음 prompt 에 Allowed Paths 라인 포함 확인

## Notes

- 자율주행 안전성 즉효, 표면 좁아 빠른 머지 가능
- Express 가능 경계지만 사용자가 "익스프레스" 미명시 → 일반 order
