# Autoflow Memo

## Memo

- ID: memo_024
- Title: PRD/티켓은 한국어로 작성 규칙 추가
- Status: inbox
- Created At: 2026-04-29T21:05:27Z
- Source: autoflow memo create

## Request

나는 한국사람이야 PRD와 티켓은 사람도 읽기 때문에 앞으로 작성되는것은 한글로 작성 규칙을 넣어줘

## Hints

### Scope

- 현재 root AGENTS.md rule 15 는 ticket/PRD 를 영어/AI 친화 구조로 쓰게 하는데, 이걸 사람이 읽기 위해 한국어로 작성하도록 정책을 변경한다. 새 정책: PRD(prd_NNN.md), todo/inprogress/done ticket 본문, plan, 그리고 사용자 친화 메모는 한국어로 작성한다. 단, 기계가 파싱하는 필드명(예: Goal, Done When, Allowed Paths, Verification 등 섹션 헤더와 key=value 형식, ticket id, project key, 명령어, 경로, 코드)는 그대로 유지해 parser 와 호환을 보장한다. AGENTS.md / .autoflow/AGENTS.md 의 language policy 와 spec-author / plan-to-ticket / ticket-owner agent 의 작성 가이드, 그리고 reference 템플릿(template.md)을 함께 갱신한다.

### Allowed Paths

- `AGENTS.md`
- `CLAUDE.md`
- `.autoflow/AGENTS.md`
- `.autoflow/agents/spec-author-agent.md`
- `.autoflow/agents/plan-to-ticket-agent.md`
- `.autoflow/agents/ticket-owner-agent.md`
- `.autoflow/reference/ticket-template.md`
- `.autoflow/reference/project-spec-template.md`
- `.autoflow/reference/feature-spec-template.md`
- `.autoflow/reference/plan-template.md`
- `scaffold/board/agents/spec-author-agent.md`
- `scaffold/board/agents/plan-to-ticket-agent.md`
- `scaffold/board/agents/ticket-owner-agent.md`
- `scaffold/board/reference/ticket-template.md`
- `scaffold/board/reference/project-spec-template.md`
- `scaffold/board/reference/feature-spec-template.md`
- `scaffold/board/reference/plan-template.md`

### Verification

- Command: pending Plan AI inference

## Planner Contract

- Plan AI treats this memo as an implementation directive, infers concrete scope from repository context, and promotes it into a generated backlog PRD and todo ticket.
- Plan AI must not turn memo intake into a repeated human-question loop. Only unsafe requests should be blocked; otherwise use the safest narrow interpretation.
