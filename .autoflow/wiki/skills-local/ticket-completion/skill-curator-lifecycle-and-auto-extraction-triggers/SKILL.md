---
name: "skill-curator-lifecycle-and-auto-extraction-triggers"
description: "Use when skill curator lifecycle and auto-extraction triggers"
version: "1.0"
author: "autoflow-agent"
license: "CC-BY-4.0"
pattern_type: ticket_completion
applies_to:
  module: ".autoflow/scripts/curator-run.sh"
  keywords:
    - "skill"
    - "curator"
    - "lifecycle"
    - "and"
    - "auto"
    - "extraction"
    - "triggers"
    - "autoflow"
    - "scripts"
    - "run"
    - "runtime"
    - "board"
pinned: false
created_from:
  prd: "prd_166"
  ticket: "tickets_164"
created_at: "2026-05-04T21:54:47Z"
metadata:
  hermes:
    tags: []
    related_skills: []
---

# skill curator lifecycle and auto-extraction triggers

## Trigger

- Reuse when: skill curator lifecycle and auto-extraction triggers
- Source ticket: `tickets/done/prd_166/tickets_164.md`

## Recommended Procedure

- Curator 가 7일 주기 + idle 시점에 자동 동작 (시뮬레이션으로 즉시 trigger 가능).
- 30일 unused skill 이 stale 마킹, 90일 unused 가 archive 이동 확인.
- Pinned skill 이 모든 transition 우회.
- **Auxiliary client 사용으로 main session prompt cache 가 깨지지 않음** (PRD-158 cache hit rate 모니터링).
- 4개 trigger 가 정상 동작 — 각각 시뮬레이션으로 skill 1건씩 생성 확인.

## Pitfalls

- Runner nudge is best-effort and silent during adapter preflight to preserve key=value output ordering; runtime state records the recursion guard when it fires.

## Verification Pattern

- Command: ``bash -n packages/cli/skill-project.sh .autoflow/scripts/common.sh .autoflow/scripts/finish-ticket-owner.sh .autoflow/scripts/start-plan.sh packages/cli/run-role.sh .autoflow/scripts/curator-run.sh tests/smoke/skill-curator-auto-extract-smoke.sh``

## Source Evidence

- Ticket: `tickets/done/prd_166/tickets_164.md`
- PRD: `tickets/done/prd_166/prd_166.md`
- Verification: `tickets/done/prd_166/verify_164.md`
- Result summary: skill curator lifecycle and extraction triggers
