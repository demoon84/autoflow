# Autoflow Memo

## Memo

- ID: memo_029
- Title: Obsidian 관련 내용 전부 제거
- Status: inbox
- Created At: 2026-04-29T21:11:13Z
- Source: autoflow memo create

## Request

Obsidian을 더이상 사용하지 않기 때문에 Obsidian Links 이런거는 없어야함. Obsidian 관련 내용을 모두 제거.

## Hints

### Scope

- 검색 결과 약 57개 파일에 'Obsidian' 언급. 핵심 제거 대상: (1) ## Obsidian Links 섹션을 ticket/plan/run/log 에 추가하던 셸 코드 — start-plan.sh:298, start-ticket-owner.sh:391, start-verifier.sh:195, write-verifier-log.sh:88 등에서 replace_section_block / printf 로 'Obsidian Links' 블록을 만들고 'Project Note', 'Plan Note' 식의 wikilink 를 채우는 부분 제거. (2) ticket-template.md / plan-template.md 등 reference 템플릿의 ## Obsidian Links 섹션 제거. (3) heartbeat 템플릿과 agent 가이드의 'Obsidian links 와 보드 파일에서 재개' 문구를 'board files' 로만 표기. (4) AGENTS.md / README 의 Obsidian 사용 가이드/링크 정책 문단 제거. 이미 done/ 아래에 보관된 historical ticket/log 는 그대로 두고, 활성 보드(.autoflow/) 와 scaffold/, runtime/, dogfood-board/, 관련 reference/template 만 손댄다. 같은 변경을 .autoflow/scripts/ 와 runtime/board-scripts/ 와 dogfood-board/scripts/ 3곳에 동기 적용.

### Allowed Paths

- `runtime/board-scripts/start-plan.sh`
- `runtime/board-scripts/start-ticket-owner.sh`
- `runtime/board-scripts/start-verifier.sh`
- `runtime/board-scripts/write-verifier-log.sh`
- `runtime/board-scripts/run-hook.sh`
- `.autoflow/scripts/start-plan.sh`
- `.autoflow/scripts/start-ticket-owner.sh`
- `.autoflow/scripts/start-verifier.sh`
- `.autoflow/scripts/write-verifier-log.sh`
- `.autoflow/scripts/run-hook.sh`
- `dogfood-board/scripts`
- `.autoflow/reference/ticket-template.md`
- `.autoflow/reference/plan-template.md`
- `.autoflow/reference/tickets-board.md`
- `.autoflow/reference/backlog.md`
- `.autoflow/rules/verifier/verification-template.md`
- `.autoflow/automations/templates/plan-heartbeat.template.toml`
- `.autoflow/automations/templates/todo-heartbeat.template.toml`
- `.autoflow/automations/templates/verifier-heartbeat.template.toml`
- `scaffold/board/reference/ticket-template.md`
- `scaffold/board/reference/plan-template.md`
- `scaffold/board/reference/tickets-board.md`
- `scaffold/board/reference/backlog.md`
- `scaffold/board/rules/verifier/verification-template.md`
- `scaffold/board/automations/templates`
- `scaffold/board/agents`
- `.autoflow/AGENTS.md`
- `AGENTS.md`
- `README.md`
- `dogfood-board`

### Verification

- Command: tests/smoke/*.sh 전부 통과 (특히 ticket-owner-smoke 류는 사전 이슈와 별개로 회귀 0). npm --prefix apps/desktop run check. grep -ri 'obsidian' .autoflow scaffold runtime dogfood-board AGENTS.md README.md 결과가 done/ archive/ 외에는 0건. 새 init 한 보드(scaffold/board) 의 ticket/plan/run/log 어디에도 ## Obsidian Links 섹션이 만들어지지 않는지 확인.

## Planner Contract

- Plan AI treats this memo as an implementation directive, infers concrete scope from repository context, and promotes it into a generated backlog PRD and todo ticket.
- Plan AI must not turn memo intake into a repeated human-question loop. Only unsafe requests should be blocked; otherwise use the safest narrow interpretation.
