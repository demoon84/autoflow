---
kind: memo
slug: desktop-chat-provider-dropdown
created_by: governance-loop@claude-opus-4-7
created_at: 2026-04-30T10:59:30Z
references:
  - tickets/done/prd_068/prd_068.md
  - tickets/done/prd_069/prd_069.md
---

# Autoflow Memo

## Request

데스크톱 "대화" 메뉴 헤더에 AI provider/model 드롭다운을 추가해서 사용자가 codex / claude / opencode / gemini 중에서 직접 선택할 수 있게 한다. 선택값은 보드의 default agent profile (`.autoflow/runners/config.toml`) 또는 별도 desktop-chat 전용 설정과 동기화하고, 선택한 어댑터 CLI 가 PATH 에 없을 때는 채팅 화면에서 한국어 안내 + 다른 어댑터로의 빠른 전환 버튼을 보여 준다.

## Why

prd_068 + prd_069 에서 후속 작업 후보로 명시했던 항목이고, 실제 사용자 캡처에서 `agent_cli_not_found:claude` 오류가 발생하면서 우선순위가 높아졌다. 현재는 default 1개만 사용 가능해 사용자가 다른 PATH 의 어댑터(codex/gemini) 로 우회하려면 보드 config 를 직접 편집해야 한다.

## Scope

- 헤더에 provider 토글(또는 드롭다운) + model/effort 표시.
- 어댑터 미설치 감지 시 한국어 inline 안내 + 다른 어댑터로 전환 추천 버튼.
- 새 IPC `autoflow:listChatAdapters`(설치된 어댑터 + 현재 선택값 반환), `autoflow:setChatAgent`(선택 저장).
- 선택값은 `.autoflow/conversations/desktop-chat.md` frontmatter `provider`/`model` 에 기록되어 thread 컨텍스트와 함께 보존된다.

## Allowed Paths

- `apps/desktop/src/main.js`
- `apps/desktop/src/preload.js`
- `apps/desktop/src/renderer/main.tsx`
- `apps/desktop/src/renderer/styles.css`
- `apps/desktop/src/renderer/vite-env.d.ts`
- `apps/desktop/src/components/ui/**`
- `tests/smoke/desktop-chat-spec-intake-smoke.sh`

## Verification

- `npm --prefix apps/desktop run check`
- `bash tests/smoke/desktop-chat-spec-intake-smoke.sh`
- 수동: 데스크톱을 띄워 헤더 드롭다운으로 provider 변경 → 채팅 메시지 송수신 시 해당 어댑터가 호출되는지 확인. 미설치 어댑터 선택 시 한국어 inline 안내가 보이는지 확인.

## Notes

- prd_068 + prd_069 의 Out of Scope("provider 드롭다운") 를 그대로 In Scope 로 가져온다.
- 응답 스트리밍, 비이미지 첨부, 다중 세션은 별도 후속.
- 본 메모는 governance loop 가 자동으로 작성. 사용자가 동의하지 않으면 삭제하거나 수정해도 무방하다.
