# Autoflow Order

## Order

- ID: order_193
- Title: 러너 live adapter 스트림에 타이핑 애니메이션 적용
- Status: inbox
- Priority: normal
- Created At: 2026-05-09T06:31:16Z
- Source: autoflow order create

## Request

# Autoflow Order

## Order

- Title: 러너 live adapter 스트림에 타이핑 애니메이션 적용
- Priority: normal
- Status: ready


ai 처리 메세지는 타이핑 치듯이 표현되어야 함. 현재 chunk 가 한꺼번에 dump 되어 흐름이 보이지 않음.

## Notes

- 사용자가 가리킨 영역: AiConversationPanel (`apps/desktop/src/renderer/main.tsx` line ~6364) — codex/claude/gemini 어댑터의 raw stdout 스트림이 흘러나오는 dark terminal-style 박스. 직전 PRD 207 (commit 94a57b4) 가 헤더에 binary 상태 인디케이터를 추가한 것과 같은 패널.
- 문제: IPC 가 chunk 단위로 stdout 을 push 하면 한 chunk 가 통째로 한 번에 화면에 뜸. 어댑터가 천천히 생각하다가 갑자기 큰 paragraph 를 뿜는 식으로 보여 사용자가 진행 흐름을 못 느낌. ChatGPT / Claude 데스크톱 처럼 "글자가 차례로 뜨는" 타이핑 애니메이션 원함.
- 후보 구현 (planner / worker 가 결정):
  - **A. 글자 단위 큐 + setTimeout/RAF 로 release**: 새 chunk 가 도착하면 글자 큐에 push, useEffect 가 일정 간격(예: 8~16ms/char, viewport 폭에 따라 조정)으로 1~3 글자씩 DOM 에 append. 큐가 너무 길면 (예: > 800자) 즉시 drain 으로 catch-up — chunk 가 영원히 뒤쳐지지 않게.
  - **B. CSS-only typewriter**: `@keyframes` width 점진 + monospace assumption. 단 chunk 단위 자연스러운 타이핑은 어렵고 비-monospace 텍스트에 깨짐. A 추천.
  - **C. Markdown 스트리밍 라이브러리 (react-typing-effect, typewriter-effect)**: 추가 dep, 번들 사이즈 비용. 안 쓰는 게 좋음.
- 데이터 소스: 기존 그대로 — `runner.conversationPreview` / `runner.lastLogLine` 또는 IPC 로 들어오는 stdout chunk. 새 IPC 추가 불필요.
- 회귀 가드:
  - 일시 정지 / 재개: 사용자가 스크롤 위로 이동하면 자동 스크롤 멈추는 기존 동작 유지. 타이핑 애니메이션이 끝나도 같은 동작.
  - 재실행 / 새 ticket 시작: 큐 reset.
  - 토큰 사용량 / 처리 시간 / state status badge 등 헤더 영역 변경 없음 (이번 작업은 본문 stream 전용).
  - prefers-reduced-motion 사용자: 애니메이션 비활성, instant render fallback.
- 페이지 lifetime 비용: useEffect setTimeout 누수 없도록 cleanup. 한 번에 너무 많은 글자가 큐에 쌓이면 즉시 flush.
- ANSI escape (색상) 처리는 현재 ansi-to-html 으로 이미 처리 중 — 타이핑 애니메이션이 ANSI 단위 (color span) 가 아닌 글자 단위로 나누지 않게 주의 (color span 깨지면 색깔 사라짐). chunk 를 color-span 단위로 grouping 한 뒤 group 안에서 글자 단위 재생.
- 적용 범위: AiConversationPanel 본문 (live adapter stream). `runner-console`, terminal 영역의 다른 panel (만약 있다면) 은 적용 안 함.

## Allowed Paths

- `apps/desktop/src/renderer/main.tsx`
- `apps/desktop/src/renderer/styles.css`

## Done When

- [ ] AiConversationPanel 본문에 새 stdout chunk 가 도착하면 글자가 차례로 뜨는 타이핑 애니메이션이 적용된다 (visual confirmation).
- [ ] 큐가 일정 길이 (예: 800자) 를 넘으면 즉시 flush 로 catch-up — 어댑터가 빨리 뱉어도 표시가 영원히 뒤쳐지지 않는다.
- [ ] ANSI 색상이 깨지지 않는다 — 색상 span 안에서 글자 단위 release.
- [ ] prefers-reduced-motion 사용자는 애니메이션 비활성, 기존 instant render 동작.
- [ ] `npm run desktop:check` 통과.
- [ ] 다른 패널 / 카드 / 헤더 영역 변경 없음.

## Verification

- Command: `cd /Users/demoon2016/Documents/project/autoflow/apps/desktop && npm run check`
- 보조: 데스크톱 dev 앱에서 worker 가 실제 ticket 처리하는 동안 AiConversationPanel 본문이 글자 단위로 흘러나오는지 시각 확인.

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
