# Autoflow Order

## Order

- ID: order_322
- Title: 데스크톱 러너 터미널 입력 지원
- Status: inbox
- Priority: normal
- Created At: 2026-05-12T08:13:10Z
- Source: autoflow order create

## Request

터미널에 글을 입력할수있게 해줘
order로 발행

의도: desktop runner LivePtyView/xterm이 현재 read-only라 사용자가 PTY 터미널에 직접 입력할 수 없다. 터미널 포커스 후 키 입력, 붙여넣기, Enter 등이 실제 runner PTY stdin으로 전달되게 한다.

## Hints

### Scope

- Autoflow desktop PTY terminal input path: renderer xterm onData, preload bridge, main IPC, runner-pty-manager stdin writer

### Allowed Paths

- `apps/desktop/src/main/runner-pty-manager.js`
- `apps/desktop/src/main.js`
- `apps/desktop/src/preload.js`
- `apps/desktop/src/renderer/main.tsx`
- `apps/desktop/src/renderer/vite-env.d.ts`
- `apps/desktop/src/renderer/styles.css`

### Verification

- Command: npm run desktop:check; desktop 앱에서 runner LivePtyView 터미널 포커스 후 입력/Enter가 해당 PTY에 전달되는지 수동 확인

## Planner Contract

- Plan AI treats this order as an implementation directive, infers concrete scope from repository context, and promotes it into a generated backlog PRD and todo ticket.
- Plan AI must not turn order intake into a repeated human-question loop. Only unsafe requests should be blocked; otherwise use the safest narrow interpretation.
