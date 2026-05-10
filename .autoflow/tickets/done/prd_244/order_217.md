# Autoflow Order

## Order

- Title: LiveTerminalView 상태 메시지를 중앙 placeholder → 하단 토스트로 이동
- Priority: normal
- Status: ready
- Change Type: code

## Request

상태 메시지(AI 응답 대기 중 입니다 / 처리할 작업이 없습니다 / AI를 시작해 주세요)를 LiveTerminalView 중앙 placeholder 에서 하단 토스트로 변경

## Context

`apps/desktop/src/renderer/main.tsx` 의 `LiveTerminalView` 가 `text` 비었을 때
중앙에 큰 placeholder 텍스트로 메시지 표시 (`live-terminal-view-idle-placeholder`).
3개 메시지:
- running + pid: `AI 응답 대기 중 입니다.`
- stopped/user_stopped/failed: `AI를 시작해 주세요.`
- 그 외 (idle): `처리할 작업이 없습니다.`

화면 가운데에 큰 글씨로 떠 있어 시각적 비중이 과도. 하단 모서리 작은 토스트로
변경하면 (a) 빈 화면이 본질적으로 비어 있음을 보여주고 (b) 상태는 부수 정보로
하단에 작게 표시.

## Allowed Paths

- apps/desktop/src/renderer/main.tsx
- apps/desktop/src/renderer/styles.css

## Done When

- [ ] LiveTerminalView 의 `live-terminal-view-idle-placeholder` 중앙 표시 제거
- [ ] 동일 3개 메시지가 LiveTerminalView 우측 하단 (또는 footer 영역) 에 작은 토스트/배지로 표시됨
- [ ] running 시 토스트 색은 active tone, stopped 는 muted, idle 은 default
- [ ] xterm 본체 / 다른 quota 토스트와 겹치지 않음
- [ ] `cd /Users/demoon2016/Documents/project/autoflow/apps/desktop && npm run check` exits 0

## Verification

- Command: cd /Users/demoon2016/Documents/project/autoflow/apps/desktop && npm run check

## Notes

- 위치 reference: `apps/desktop/src/renderer/main.tsx` 의 `LiveTerminalView` 함수 안 `live-terminal-view-idle-placeholder` div 분기.
- CSS: `apps/desktop/src/renderer/styles.css` 의 `.live-terminal-view-idle-placeholder` 룰 (절대 inset:0 → 우측 하단으로 변경).
- 기존 `quota toast` (`live-terminal-view-quota-toast`) 와 z-index/position 충돌 없게 separate slot.
