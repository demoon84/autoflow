---
title: Blocked dirty orchestration requested for tickets_164.md
created_at: 2026-05-04T00:51:28Z
event_type: blocked-dirty-orchestration
prd_key: prd_166
ticket_id: 164
source: start-plan.sh
---

# Blocked dirty orchestration requested for tickets_164.md

## What Happened

Planner runtime detected a blocked ticket whose Allowed Paths still overlap dirty PROJECT_ROOT paths and emitted source=blocked-dirty-orchestration.

## Evidence

blocked_origin=tickets/inprogress/tickets_164.md; failure_class=dirty_project_root_conflict; dirty_paths=.autoflow/telemetry/runs.jsonl, .autoflow/tickets/done/prd_158/tickets_157.md, .autoflow/tickets/done/prd_163/tickets_162.md, .autoflow/tickets/done/prd_164/tickets_163.md, .autoflow/tickets/inbox/order_150.md, .autoflow/tickets/inbox/order_151.md, .autoflow/tickets/todo/tickets_164.md, .autoflow/wiki/agents/prompt-evolution.md, .autoflow/wiki/operations/runner-health.md, .autoflow/wiki/operations/runner-timing.md, .autoflow/wiki/skills-local/ticket-completion/ai-work-for-prd-162/SKILL.md, .autoflow/wiki/skills/skill-template.md, .autoflow/wiki/skills/skill_001.md, .autoflow/wiki/skills/skill_003.md, .autoflow/wiki/skills/skill_004.md, .autoflow/wiki/skills/skill_005.md, .autoflow/wiki/skills/skill_006.md, .autoflow/wiki/skills/skill_007.md, .autoflow/templates/wiki/skills/skill-template.md, .autoflow/tickets/check/check_176.md, .autoflow/tickets/done/prd_170/order_150.md, .autoflow/tickets/done/prd_170/prd_170.md, .autoflow/tickets/done/prd_171/order_151.md, .autoflow/tickets/done/prd_171/prd_171.md, .autoflow/tickets/inprogress/tickets_164.md, .autoflow/tickets/inprogress/verify_164.md, .autoflow/tickets/todo/tickets_169.md, .autoflow/tickets/todo/tickets_170.md, .autoflow/wiki-raw/ai-work-for-prd-162-skill.md, .autoflow/wiki-raw/skill_001.md, .autoflow/wiki-raw/skill_003.md, .autoflow/wiki-raw/skill_004.md, .autoflow/wiki-raw/skill_005.md, .autoflow/wiki-raw/skill_006.md, .autoflow/wiki-raw/skill_007.md, parse_verifier_logs.py

## Recommended Human Action

Orchestrator AI가 dirty path를 Allowed Paths 소유권별로 commit 또는 stash 처리했는지 확인한다.

## Status

- [ ] 사람 확인 완료
