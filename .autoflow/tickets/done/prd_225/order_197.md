# Autoflow Order

## Order

- ID: order_197
- Title: LiveTerminalView 화이트 테마 배경/글자색 정렬
- Status: inbox
- Priority: normal
- Created At: 2026-05-09T10:20:58Z
- Source: autoflow order create

## Request

# Autoflow Order

## Order

- Title: LiveTerminalView 화이트 테마 배경/글자색 정렬 (이전 desktop 톤 회복)
- Priority: normal
- Status: ready


터미널 글자색을 화이트 테마에 맞게 이전처럼 꾸며줘 배경색도

## Notes

- 현재 LiveTerminalView (`apps/desktop/src/renderer/main.tsx` line ~6195) 의 xterm theme 는 vibe-terminal 의 다크 톤 (`#2d323b` 배경 + `#cccccc/d6d8de` 전경 + 16색 vibrant ANSI). 데스크톱 앱이 라이트 테마(흰 배경 + 짙은 텍스트) 일 때 카드 본문만 다크 박스로 박혀 시각 부조화.
- 사용자 의도: 카드 / 데스크톱 라이트 톤과 일관되게, 이전 ConversationStream 시절의 흰 배경 + 짙은 글자 + 부드러운 ANSI 토큰 색 (cyan/blue/magenta/green/red/yellow) 으로 정렬.

### 수정 위치
- `apps/desktop/src/renderer/main.tsx`:
  - `LiveTerminalView` 의 `theme` 객체 (background/foreground/cursor/selection/scrollbar + ANSI 16색).
  - 다크 모드 / 라이트 모드 dual 지원 시 `document.documentElement.dataset.theme` 또는 `state.themeMode` (이미 다른 곳에서 사용 중) 를 보고 분기.
- `apps/desktop/src/renderer/styles.css`:
  - `.live-terminal-view` 의 background / border 색을 카드 톤과 일치 (예: `var(--card)` + `var(--border)`).
  - `.live-terminal-view .xterm .xterm-viewport` 의 `!important` 배경도 라이트 톤으로.
  - dark mode override 도 함께 (`[data-theme="dark"] .live-terminal-view { ... }`).
- `LOG_TOKEN_ANSI` map (line ~6184) 의 ANSI 색은 라이트 배경에서도 가독되도록 채도/명도 조정. 예: bright green 대신 mid green, red 살짝 어둡게.

### 라이트 테마 후보 색
- background: `#ffffff` 또는 `var(--card)` (실제 CSS 변수 매핑).
- foreground: `#1f2937` (gray-800) — 기존 ConversationStream 의 ansiConverter fg 와 동일.
- cursor: `#374151`.
- ANSI:
  - cyan `#0891b2`, blue `#2563eb`, magenta `#9333ea`, green `#16a34a`, red `#dc2626`, yellow `#ca8a04`.
  - bright variants: 동일 hue 더 짙게/밝게.
- 기존 ansiConverter (line ~3511) 의 colors map 톤을 그대로 차용하면 ConversationStream 시절과 일관.

### 다크 테마 fallback
- 사용자가 다크 모드 전환 시 (현재 sidebar 의 sun/moon toggle) 자동으로 vibe-terminal 톤 (`#2d323b` 배경 + 밝은 ANSI) 으로 swap. theme 변경 감지는 `useEffect` 로 `document.documentElement.dataset.theme` 관찰.

## Allowed Paths

- `apps/desktop/src/renderer/main.tsx`
- `apps/desktop/src/renderer/styles.css`

## Done When

- [ ] 라이트 테마에서 LiveTerminalView 배경이 흰/카드 톤이고 텍스트가 짙은 회색 (#1f2937 부근) 으로 표시된다 — 시각 확인.
- [ ] 라이트 테마에서 ANSI 색상 (cyan/blue/magenta/green/red/yellow) 이 흰 배경 위에서 가독 (대비 최소 4.5:1).
- [ ] 다크 테마 토글 시 자동으로 vibe-terminal 다크 톤 (#2d323b 등) 으로 전환된다.
- [ ] xterm 의 fit / cols 계산 영향 없음 — 우측 글자 잘림 없음.
- [ ] `npm run desktop:check` 통과.
- [ ] 기존 LiveTerminalView 구조 (vibe-terminal 패턴, scrollback 50000, debounce, chunk flush) 유지.

## Verification

- Command: `cd /Users/demoon2016/Documents/project/autoflow/apps/desktop && npm run check`
- 보조: 데스크톱 dev 앱에서 라이트/다크 모드 toggle 후 터미널 톤이 카드와 일관되는지 시각 확인.

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
