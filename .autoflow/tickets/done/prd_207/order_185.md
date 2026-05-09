# Autoflow Order

## Order

- ID: order_185
- Title: 터미널 뷰에 러너 시작/정지 binary 상태 시각 표시
- Status: inbox
- Priority: normal
- Created At: 2026-05-09T04:55:09Z
- Source: autoflow order create

## Request

# Autoflow Order

## Order

- Title: 터미널 뷰에 러너 시작/정지 binary 상태 시각 표시
- Priority: normal
- Status: ready


터미널 뷰 화면이 시작 정지의 구분이 있으면 좋겠어 이게 동작하는건지 안동작 하는건지 모르겠어

## Notes

- 사용자가 가리키는 정확한 영역: 데스크톱의 **러너 live adapter stdout 스트림** 패널 (codex / claude / gemini 의 raw CLI 출력이 그대로 흘러나오는 dark terminal-style 박스). 사용자 스크린샷에 codex 의 "ERROR: You've hit your usage limit. Visit https://chatgpt.com/codex/settings/usage" 가 그대로 보이는 그 영역.
- 문제: 이 스트림만 보고는 그 러너가 (a) 지금 adapter tick 중인지 (b) tick 사이 idle 인지 (c) 사용자가 stop 한 정지 상태인지 구분 불가. usage limit 같은 에러가 떠도 다음 tick 에 다시 살아 retry 하는지, 멈춘 채 대기인지 알 수 없음.
- 후보 위치: `apps/desktop/src/renderer/main.tsx` line ~3506 의 `<section className="runner-console">` 와 line ~3521 의 `runner-console-body` 헤더. 그 헤더에 binary 상태 인디케이터 추가 (예: "● 실행 중" 초록 / "○ 정지" 회색 / "⏸ 대기" 노랑). 또는 stdout 박스 위쪽에 status banner.
- 데이터 소스: `runner.stateStatus` (running/idle/stopped/blocked/needs_user) + `runner.pid` + `runner.mode` (loop / one-shot) + `runner.lastEventAt` + `runner.lastAdapterChunkAt` 모두 이미 IPC 로 전달 중. 새 IPC 추가 불필요, 시각 신호 강화만.
- PRD 188 (commit 929f6d1) 의 응답 지연 severity 라벨은 별개 — 그건 "지연 정도" (n초 응답 없음 등) 시그널이고 이번 요청은 binary "시작 vs 정지" 시그널.
- 참고: 사용자는 macOS 다중 Space 환경에서 dev 앱을 띄워 보면서 확인 중. 데스크톱 단일 인스턴스 lock 정책 그대로 유지.

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
