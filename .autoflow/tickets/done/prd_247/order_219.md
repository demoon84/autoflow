# Autoflow Order

## Order

- ID: order_219
- Title: 라이브 터미널 폰트 12px → 10px
- Status: inbox
- Priority: normal
- Created At: 2026-05-10T09:02:37Z
- Source: autoflow order create

## Request

# Autoflow Order

## Order

- Title: 라이브 터미널 폰트 사이즈 12px → 10px
- Priority: normal
- Status: ready
- Change Type: code


데스크톱 앱의 라이브 PTY 터미널(LivePtyView) 글자 크기를 현재 12px 에서 10px 로 줄여 한 줄에 더 많은 출력이 보이게 한다. xterm.js 가 사용하는 `LIVE_TERMINAL_FONT_SIZE` 상수 한 곳만 변경.

## Allowed Paths

- apps/desktop/src/renderer/main.tsx

## Done When

- [ ] `apps/desktop/src/renderer/main.tsx` 의 `LIVE_TERMINAL_FONT_SIZE` 상수가 `10` 으로 변경됨
- [ ] xterm `new Terminal({ fontSize: ... })` 호출 두 곳이 같은 상수를 그대로 사용 (별도 하드코딩 없이)

## Verification

- Command: rg -n "LIVE_TERMINAL_FONT_SIZE" apps/desktop/src/renderer/main.tsx

## Notes

- 동작 테스트 목적: PTY 기반 3-runner pipeline (planner → worker) 가 정상 흐르는지 확인하기 위해 발행하는 단순 변경.

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
