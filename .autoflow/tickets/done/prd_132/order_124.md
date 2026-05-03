# Autoflow Order

## Order

- ID: order_124
- Title: 토폴로지 문서 drift: 3-runner 표기 vs 실제 4-runner (verifier)
- Status: inbox
- Created At: 2026-05-03T08:41:01Z
- Source: autoflow order create

## Request

## Request

토폴로지 표기가 코드/구성과 문서 사이에서 drift 됨. 실제 enabled 런너는 4개인데, 모든 핵심 문서가 "3-runner" 로 표기.

### 실제 (`.autoflow/runners/config.toml`)
enabled = true 인 `[[runners]]` 4개:
- `planner` (role=planner, agent=claude opus-1m)
- `worker` (role=ticket-owner, agent=codex)
- `wiki` (role=wiki-maintainer, agent=gemini)
- `verifier` (role=verifier, agent=claude opus-1m)

런타임 관찰: `.autoflow/runners/state/{planner,worker,wiki,verifier}.state` 모두 `status=running` 으로 active. verifier.state 의 `last_result=adapter_exit_0` 가 5분 주기로 갱신됨.

### 문서가 말하는 것 (잘못)
- **`.autoflow/runners/config.toml:3`** 헤더 주석: `Three-runner topology (refactor 2026-04-27)` — 같은 파일 안에서 verifier 정의를 직접 가지고 있는데도 3-runner 라고 적힘
- **`AGENTS.md:30`**: "기본 토폴로지는 **Orchestrator AI 1개 + Impl AI 1개 + Wiki AI 1개** 의 3-runner 모델이다."
- **`CLAUDE.md`**: 같은 3-runner 표기 + "topology note (refactor 2026-04-27): the default board runs **three loop runners** — `planner`, `worker`, and `wiki`."

또한 CLAUDE.md / AGENTS.md 의 다른 부분에서는 "verifier 가 inline 으로 worker 안에서 동작" 식으로 모순적 설명도 섞여 있음 (예: AGENTS.md:97 "작업이 끝나면 .autoflow/tickets/verifier/ 로 이동한다" — 이건 legacy 4-runner pipeline 설명).

## Suggested Fix

A) 문서 표기를 4-runner 로 수정 (코드가 truth):
- `config.toml` 헤더 주석을 `Four-runner topology` + verifier 설명 추가
- `AGENTS.md:30` `3-runner` → `4-runner`, verifier role 한 줄 추가
- `CLAUDE.md` 동일

B) (선택) 만약 의도된 토폴로지가 실제로 3-runner 이고 verifier 는 회수해야 한다면, `config.toml` 의 verifier `enabled = false` + 관련 inline verify 코드 일관성 정리. 현재는 양쪽 모두 동작 중이라 worker 의 inline verify 와 별도 verifier runner 가 중복 작업 위험.

권장은 A. 실제 verification_pass_rate=60.3% (autoflow metrics) 가 verifier runner 결과를 반영하고 있어 별도 runner 가 의미 있게 작동 중이기 때문.

## Allowed Paths

- AGENTS.md
- CLAUDE.md
- .autoflow/runners/config.toml
- .autoflow/agents/*.md (해당하는 곳 - 일관성 점검)

## Verification

```bash
grep -ni "three-runner\|3-runner\|Wiki AI 1개" AGENTS.md CLAUDE.md .autoflow/runners/config.toml
# 0 매치 또는 의도된 컨텍스트만 남아야 함
grep -c "verifier" .autoflow/runners/config.toml
# >= 1 (실제 runner 정의)
```

## Notes

- 우선순위 낮은 문서 정리지만 새로운 contributor 가 토폴로지를 잘못 이해하게 만드는 함정.
- order_122 (telemetry role filter) 와 함께 "4-runner 모두 telemetry 기록" 으로 의미가 일관된다.

## Hints

### Scope

- pending Plan AI inference

### Allowed Paths

- `AGENTS.md`
- `CLAUDE.md`
- `.autoflow/runners/config.toml`

### Verification

- Command: grep -c verifier .autoflow/runners/config.toml

## Planner Contract

- Plan AI treats this order as an implementation directive, infers concrete scope from repository context, and promotes it into a generated backlog PRD and todo ticket.
- Plan AI must not turn order intake into a repeated human-question loop. Only unsafe requests should be blocked; otherwise use the safest narrow interpretation.
