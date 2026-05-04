---
kind: raw_source
slug: skill_005
original_path: ".autoflow/wiki/skills/skill_005.md"
ingested_at: 2026-05-04T00:50:16Z
updated_at: 2026-05-04T00:50:16Z
sha256: 2991a58e8a683509a74cc43912ecaef4abf8cccec2d0a9636aaca7788af7afb8
---

---
title: "Reasoning level 동적 dispatch — tick 복잡도 기반 reasoning 자동 선택"
pattern_type: ticket_owner_pattern
applies_to:
  - "general"
keywords:
  - "reasoning"
  - "level"
  - "dispatch"
  - "tick"
success_count: 0
failure_count: 0
last_used_at: ""
created_from: "tickets/done/prd_157/tickets_156.md"
created_at: "2026-05-03T13:25:44Z"
enabled: true
---

# Reasoning level 동적 dispatch — tick 복잡도 기반 reasoning 자동 선택

## Trigger

- Reuse when: Reasoning level 동적 dispatch — tick 복잡도 기반 reasoning 자동 선택
- Source ticket: `tickets/done/prd_157/tickets_156.md`

## Recommended Procedure

- `AUTOFLOW_REASONING_DYNAMIC_ENABLED=1` 상태에서 idle/no-actionable planner 또는 ticket tick 이 adapter 호출까지 가는 경우 effective reasoning 이 `low` 로 기록/출력된다.
- 단일 PRD 또는 단일 todo claim 같은 normal tick 은 effective reasoning 이 `medium` 으로 기록/출력된다.
- multi-PRD, reject replan, blocked recovery, `source=blocked-dirty-orchestration`, `source=iteration-no-progress` 같은 complex tick 은 effective reasoning 이 `high` 로 기록/출력된다.
- `AUTOFLOW_REASONING_DYNAMIC_ENABLED=0` 또는 미설정 상태에서는 기존 `runners/config.toml` 의 `reasoning` 값을 그대로 사용한다.
- dry-run adapter command, runner state, runner log 중 적어도 하나에서 default reasoning 과 dynamic effective reasoning 의 차이를 관찰할 수 있다.

## Pitfalls

- Complexity classification is intentionally heuristic and queue-shape based for dry-run/idle contexts. If planner actionable semantics expand again, the smoke fixtures may need another contract refresh even though the runtime gate itself is isolated.

## Verification Pattern

- Command: ``bash tests/smoke/runner-dynamic-reasoning-smoke.sh && bash tests/smoke/runner-idle-preflight-skip-smoke.sh && npm run desktop:check``

## Source Evidence

- Ticket: `tickets/done/prd_157/tickets_156.md`
- PRD: `tickets/done/prd_157/prd_157.md`
- Verification: `tickets/done/prd_157/verify_156.md`
- Result summary: dynamic reasoning dispatch + smoke coverage
