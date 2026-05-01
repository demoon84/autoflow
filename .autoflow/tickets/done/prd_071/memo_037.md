---
kind: memo
slug: desktop-chat-response-streaming
created_by: governance-loop@claude-opus-4-7
created_at: 2026-04-30T11:06:30Z
references:
  - tickets/done/prd_068/prd_068.md
  - tickets/done/prd_069/prd_069.md
---

# Autoflow Memo

## Request

데스크톱 "대화" 메뉴의 AI 응답을 한 번에 받지 말고 토큰 스트리밍으로 받아 사용자가 답이 길어도 진행 상황을 즉시 볼 수 있게 한다. 어댑터마다 streaming protocol 이 다르므로(`codex exec --stream`, `claude -p --output-format json` 등), `chat-once.sh` 또는 신규 `chat-stream.sh` 가 어댑터별로 streaming 모드를 분기하고, IPC 는 chunk 단위 이벤트(`autoflow:chatStreamChunk`)를 renderer 로 보낸다.

## Why

prd_068 + prd_069 에서 후속 작업 후보로 명시된 항목. 현재는 어댑터 호출이 끝나야 사용자가 답을 본다(이번 세션의 codex xhigh PRD 합성처럼 4분이 걸리면 사용자는 그 시간 동안 빈 화면을 본다). 첫 1-2초 안에 응답이 흐르기 시작하면 체감 응답성이 크게 좋아진다.

## Scope

- `runtime/board-scripts/chat-once.sh` 에 `--stream` 옵션 추가, 또는 별도 `chat-stream.sh` 진입점.
- 어댑터별 streaming 분기:
  - codex: `codex exec --stream` (또는 동등 옵션)
  - claude: `claude -p --output-format json` 라인 단위 파싱
  - opencode/gemini: 가능 옵션 조사 후 분기 또는 fallback (non-stream).
- 신규 IPC: `autoflow:chatSendStream({...})` + 메인 프로세스가 chunk event 를 webContents 로 push (`autoflow:chatStreamChunk`).
- 렌더러 ChatView: 마지막 assistant 메시지를 in-place 로 grow 시키며 스트리밍 표시. 스트림이 끝나면 thread 파일에 한 번에 저장.
- 취소 동작: 기존 `cancelInvocation` 으로 중간 중단 가능.
- streaming 미지원 어댑터는 기존 단발 호출 fallback 으로 동작.

## Allowed Paths

- `apps/desktop/src/main.js`
- `apps/desktop/src/preload.js`
- `apps/desktop/src/renderer/main.tsx`
- `apps/desktop/src/renderer/styles.css`
- `apps/desktop/src/renderer/vite-env.d.ts`
- `runtime/board-scripts/chat-once.sh` (또는 신규 `chat-stream.sh`)
- `runtime/board-scripts/chat-prompts/**`
- `scaffold/board/scripts/chat-once.sh`
- `scaffold/board/scripts/chat-prompts/**`
- `tests/smoke/desktop-chat-spec-intake-smoke.sh`

## Verification

- `npm --prefix apps/desktop run check`
- `bash tests/smoke/desktop-chat-spec-intake-smoke.sh` (스트리밍 IPC 노출, chunk 라인 파싱 fixture 검증 추가)
- 수동: 데스크톱을 띄워 긴 응답을 만드는 메시지 송신 → 토큰 단위로 본문이 grow 하는지, 취소가 즉시 반영되는지, 스트림 끝나면 thread 파일에 정확한 본문이 저장되는지 확인.

## Notes

- prd_068 + prd_069 의 Out of Scope("응답 토큰 단위 스트리밍") 를 그대로 In Scope 로 가져온다.
- streaming 미지원 어댑터 fallback 명세를 PRD 단계에서 명시.
- 본 메모는 governance loop 가 자동 작성. 동의하지 않으면 삭제하거나 수정해도 무방.
