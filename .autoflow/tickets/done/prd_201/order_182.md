# Autoflow Order

## Order

- ID: order_182
- Title: todo ticket 파일명 규칙 변경: Todo-NNN → Todo-NNN (기존 티켓 일괄 rename)
- Status: inbox
- Priority: normal
- Created At: 2026-05-08T05:46:44Z
- Source: autoflow order create

## Request

현재 todo / inprogress / done 폴더의 ticket 파일명 규칙은 'Todo-NNN.md' 다. 이를 'Todo-NNN' 규칙으로 변경한다. (사용자 명시 표기 보존)

작업 범위:
1. 새 발행 규칙 변경: planner / runtime 이 todo 발급 시 새 prefix 'Todo-' (또는 운영팀 합의되는 정확한 형식) 로 파일을 만들도록 변경.
2. 기존 ticket 파일 일괄 rename: tickets/todo/, tickets/inprogress/, tickets/done/<key>/ 안의 모든 'Todo-NNN.md' 를 새 규칙으로 이름 바꾼다.
3. ticket markdown 본문 안의 'ID: Todo-NNN' 필드 + 다른 ticket 의 [[Todo-NNN]] 옵시디언 링크 / Plan Candidate / Ticket Note / Source 참조도 새 규칙에 맞게 업데이트.
4. 모든 shell script (start-ticket-owner.sh, finish-ticket-owner.sh, common.sh, run-role.sh, runners-project.sh, doctor-project.sh, metrics-project.sh, package-board-common.sh 등) 의 'tickets_' / 'Todo-NNN.md' / 'Todo-*.md' glob 패턴을 새 규칙에 맞게 변경.
5. desktop UI (apps/desktop/src/renderer/main.tsx, main.js) 의 ticket 파일 정규식 / display label / status mapping 갱신.
6. scaffold/board, runtime/board-scripts/ 미러 동기화.
7. 보드 contract 문서 (AGENTS.md, .autoflow/AGENTS.md, README, agents/*.md, protocols/*.md, reference/ticket-template.md) 의 'Todo-NNN' 표기 갱신.

검증:
- 새 todo 발급 시 새 규칙 파일이 만들어진다.
- 기존 티켓이 새 규칙 파일명 + ID 필드 + 참조까지 정합하게 옮겨진다.
- desktop UI 에 ticket 들이 정상 표시된다.
- bash -n 모든 sh + npm run desktop:check + autoflow metrics + autoflow doctor 통과.

세부 prefix 형식 (Todo-NNN vs todo_NNN vs Todo_NNN) 은 PRD 단계에서 사용자와 한 번 확정한다.

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
