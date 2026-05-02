# Autoflow Order

## Order

- ID: memo_063
- Title: Order 흐름 사용자 노출 memo 표현 정리
- Status: inbox
- Created At: 2026-05-01T23:00:20Z
- Source: $order intake

## Request

order 명령으로 실행되는 모든 스코프의 단어가 memo로 동작 하고 있어 order로 동작하게 변경

요청 의미:
- /order, #order, $order 로 들어오는 quick intake 흐름의 사용자 노출 명칭이 memo가 아니라 order로 보이게 한다.
- 현재 CLI 생성 문서에는 # Autoflow Memo, ## Memo, Source: autoflow memo create, Plan AI treats this memo..., memo path 같은 표현이 남아 있다.
- order 스킬/문서/데스크톱 UI/CLI 출력 등 order 명령으로 실행되는 모든 범위에서 memo가 아니라 order로 동작하고 보이게 한다.
- `memo` 호환 유지 전제로 처리하지 않는다. 사용자가 호출한 명령은 `order`이므로 CLI/스킬/생성 문서/보드 스캐너/표시명까지 order 기준으로 설계한다.
- 기존 구현 내부의 `memo` 이름은 임의로 보존하지 않는다. 정말 남겨야 하는 내부 migration 또는 과거 데이터 처리만 별도 근거를 두고 최소화한다.

## Hints

### Scope

- Order quick intake의 명령/동작/저장/표시 vocabulary를 memo에서 order로 전환한다. CLI가 생성하는 inbox markdown 제목/섹션/Planner Contract/next_action, order skill 문서, host/scaffold board 문서, desktop order/inbox 표시 문구, 보드 스캐너와 파일명 규칙까지 점검한다. `autoflow memo create` 또는 `memo_NNN.md`를 계속 쓰는 것을 기본 전제로 삼지 말고, order 명령과 order 저장/표시 흐름으로 바꾼다.

### Allowed Paths

- `packages/cli/memo-project.sh`
- `bin/autoflow`
- `.codex/skills/order/SKILL.md`
- `.claude/skills/order/SKILL.md`
- `integrations/codex/skills/order/SKILL.md`
- `integrations/claude/skills/order/SKILL.md`
- `scaffold/board/README.md`
- `scaffold/board/AGENTS.md`
- `scaffold/board/reference/memo.md`
- `scaffold/board/agents/plan-to-ticket-agent.md`
- `scaffold/board/automations/README.md`
- `scaffold/host/AGENTS.md`
- `scaffold/host/CLAUDE.md`
- `README.md`
- `CLAUDE.md`
- `packages/cli/README.md`
- `apps/desktop/src/renderer/main.tsx`

### Verification

- Command: rg -n "autoflow order|order_NNN|# Autoflow Order|## Order" bin packages/cli .codex/skills/order .claude/skills/order integrations/codex/skills/order integrations/claude/skills/order scaffold/board scaffold/host README.md CLAUDE.md apps/desktop/src/renderer/main.tsx && ! rg -n "Autoflow Memo|^## Memo|memo path|quick memo|this memo|memo intake|autoflow memo create|memo_NNN" bin packages/cli .codex/skills/order .claude/skills/order integrations/codex/skills/order integrations/claude/skills/order scaffold/board scaffold/host README.md CLAUDE.md apps/desktop/src/renderer/main.tsx

## Planner Contract

- Plan AI treats this order as an implementation directive, infers concrete scope from repository context, and promotes it into a generated backlog PRD and todo ticket.
- Plan AI must not turn order intake into a repeated human-question loop. Only unsafe requests should be blocked; otherwise use the safest narrow interpretation.
