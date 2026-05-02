# Autoflow Memo

## Memo

- ID: memo_035
- Title: 위키봇 Gemini 에이전트 선택 지원
- Status: inbox
- Created At: 2026-04-30T06:19:23Z
- Source: autoflow memo create

## Request

위키봇(`wiki-1`, role=`wiki-maintainer`) 의 실행 에이전트로 Gemini 를 고를 수 있게 해줘.

현재 보이는 상태:
- `.autoflow/runners/config.toml` 의 `wiki-1` 은 `agent = "codex"` 로 고정 운영 중.
- `apps/desktop/src/renderer/main.tsx` 의 `runnerAgentOptions = ["codex", "claude", "gemini"]` 에는 Gemini 가 이미 들어 있음.
- `packages/cli/run-role.sh` 도 `gemini` 어댑터 분기를 가지고 있음 (다른 역할에서는 동작).

원하는 결과: 데스크톱 UI 의 wiki-maintainer runner 설정에서 agent 를 Gemini 로 선택해 저장하면 다음 tick 부터 실제로 gemini CLI 로 wiki AI synthesis (`autoflow wiki query --synth`, `autoflow wiki lint --semantic`) 가 호출되어야 한다. 어떤 단계에서 막히고 있는지 또는 무엇을 추가로 와이어업해야 하는지 Plan AI 가 조사해서 PRD 를 만들어 주세요.

## Hints

### Scope

- pending Plan AI inference

### Allowed Paths

- pending Plan AI inference

### Verification

- Command: pending Plan AI inference

## Planner Contract

- Plan AI treats this memo as an implementation directive, infers concrete scope from repository context, and promotes it into a generated backlog PRD and todo ticket.
- Plan AI must not turn memo intake into a repeated human-question loop. Only unsafe requests should be blocked; otherwise use the safest narrow interpretation.
