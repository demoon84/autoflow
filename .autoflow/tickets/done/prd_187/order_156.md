# Autoflow Order

## Order

- ID: order_156
- Title: 외부 비밀키 의존 ticket 의 planner promote 사전 검증 (ANTHROPIC_API_KEY 등)
- Status: inbox
- Priority: normal
- Created At: 2026-05-04T05:15:28Z
- Source: autoflow order create

## Request


PRD 의 verification 또는 구현이 외부 비밀키(예: `ANTHROPIC_API_KEY`)를 요구하는데도 planner 가 사전 체크 없이 promote → worker 가 처리하다 needs_user 로 escalate. 시간/token 낭비 + ticket inprogress 잔류.

## 증거

ticket_157 / PRD_158 (Anthropic API adapter 검증):
- planner 가 promote
- worker 가 정적 검증(`npm run desktop:check`, `node --check`, `bash -n`) 통과
- live-run 단계에서 `ANTHROPIC_API_KEY` missing 감지 → `Recovery State: needs_user`
- ticket inprogress 에 9시간+ 잔류 (수동 archive 필요)

## Suggested Fix

A) **planner promote 사전 검증**:
- PRD 의 `## Verification` `Command:` 또는 본문에 `ANTHROPIC_API_KEY`/`OPENAI_API_KEY`/`AWS_*` 같은 외부 비밀키 token 검출
- 환경에 해당 변수 없으면 → `needs_user`(외부 secret) 로 promote 거부, ticket 으로 변환 안 하고 PRD 에 `Status: needs_user_secret` mark
- 또는 promote 하되 worker 시작 전에 즉시 needs_user park

B) **PRD 메타에 secret 의존 명시**:
- PRD frontmatter 에 `requires_secrets: [ANTHROPIC_API_KEY]` 필드
- planner 가 그 필드 보고 환경 체크

C) **needs_user_secret 분리 폴더**:
- 일반 needs_user(planner decision) 와 별도로 `tickets/needs_secret/` 폴더
- 사용자가 키 주입 후 `autoflow secret resume <ticket>` 명령으로 재개

권장: A (즉시) + B (점진).

## Allowed Paths

- packages/cli/start-plan.sh (planner promote 검증)
- .autoflow/agents/spec-author-agent.md (PRD frontmatter 가이드)

## Verification

```bash
# 환경에 ANTHROPIC_API_KEY 없는 상태에서
# PRD `## Verification` 에 그 키 사용하는 ticket promote 시도
bin/autoflow run planner
# 그 PRD 가 todo 로 가지 않고 needs_user_secret 으로 mark 되어야 함
```

## Notes

- order_150 (needs_user/repairing inprogress 잔류) 의 사전 예방.
- 1원칙 효율: needs_user 가 빠르게 인식되어 다른 actionable backlog 로 흐름 전환.

## Hints

### Scope

- pending Plan AI inference

### Allowed Paths

- `packages/cli/start-plan.sh`

### Verification

- Command: bin/autoflow run planner --dry-run 2>&1 | grep -c needs_user_secret

## Planner Contract

- Plan AI treats this order as an implementation directive, infers concrete scope from repository context, and promotes it into a generated backlog PRD and todo ticket.
- Plan AI must not turn order intake into a repeated human-question loop. Only unsafe requests should be blocked; otherwise use the safest narrow interpretation.
