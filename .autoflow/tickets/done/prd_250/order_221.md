# Autoflow Order

## Order

- ID: order_221
- Title: LivePtyView 좌우 여백 비대칭 보정
- Status: inbox
- Priority: normal
- Created At: 2026-05-10T09:18:37Z
- Source: autoflow order create

## Request

# Autoflow Order

## Order

- Title: LivePtyView 좌우 여백 비대칭 / 텍스트 우측 잘림 보정
- Priority: normal
- Status: ready
- Change Type: code


데스크톱 LivePtyView 의 PTY 출력에서 오른쪽 끝에서 단어가 어색하게 잘려 줄바꿈된다 (예: "permissi" + 다음 줄 "on-mode", "--effo" + 다음 줄 "rt medium"). 왼쪽 들여쓰기 여백은 일정한데 오른쪽 텍스트가 좌측보다 더 안쪽에서 wrap 되어 좌우 비대칭.

가능한 원인:
1. xterm scrollbar (4px) 가 가용 너비를 차지하는데 FitAddon 이 그걸 빼고 cols 를 계산하지 않아 PTY 에 너무 큰 cols 가 전달됨
2. xterm host element 의 `box-sizing` / padding 이 좌우 비대칭이라 실제 렌더 영역이 비대칭
3. `.live-terminal-view` 의 컨테이너 padding / border 가 한쪽만 적용

## Allowed Paths

- apps/desktop/src/renderer/main.tsx
- apps/desktop/src/renderer/styles.css

## Done When

- [ ] LivePtyView 의 텍스트 라인이 단어 경계에서 자연스럽게 wrap 되거나 끝까지 차서 오른쪽 끝에 닿음 (단어 중간 잘림 없음)
- [ ] 좌측 여백과 우측 여백이 시각적으로 동일 (스크롤바 4px 차이는 허용)
- [ ] PTY cols 가 xterm 이 실제 렌더하는 가시 칸 수와 일치 (검증: xterm 의 `cols` 와 PTY 의 cols 가 같음)

## Verification

- Command: rg -n "FitAddon|xterm-screen|xterm-viewport|live-terminal-view\b" apps/desktop/src/renderer/styles.css apps/desktop/src/renderer/main.tsx

## Notes

- 동작 검증: claude/codex/gemini 셋 다 동일 현상이면 xterm 측 padding/scrollbar 이슈, 한 CLI 만 그러면 그 CLI 의 출력 width 처리 이슈
- 현재 LIVE_TERMINAL_FONT_SIZE=12px 기준에서 발생 — font 크기 변경되면 cols 도 다시 계산되어야 함
- `.xterm` 또는 `.xterm-screen` 의 padding-right 를 명시적으로 0 으로 두고 host 의 right padding 만 사용하는 식의 정리 필요할 수 있음

## Hints

### Scope

- pending Plan AI inference

### Allowed Paths

- pending Plan AI inference

### Verification

- Command: pending Plan AI inference

## Planner Contract

- Plan AI treats this order as an implementation directive, infers concrete scope from repository context, and promotes it into a generated backlog PRD and todo ticket.
- Plan AI must not turn order intake into a repeated human-question loop. Only unsafe requests should be blocked; otherwise use the safest narrow interpretation.
