---
title: Blocked dirty orchestration requested for tickets_162.md
created_at: 2026-05-03T14:17:35Z
event_type: blocked-dirty-orchestration
prd_key: prd_163
ticket_id: 162
source: start-plan.sh
---

# Blocked dirty orchestration requested for tickets_162.md

## What Happened

Planner runtime detected a blocked ticket whose Allowed Paths still overlap dirty PROJECT_ROOT paths and emitted source=blocked-dirty-orchestration.

## Evidence

blocked_origin=tickets/inprogress/tickets_162.md; failure_class=dirty_project_root_conflict; dirty_paths=.autoflow/telemetry/runs.jsonl, .autoflow/tickets/inbox/order_120.md, .autoflow/wiki/agents/prompt-evolution.md, .autoflow/wiki/architecture/runner-role-slugs.md, .autoflow/wiki/index.md, .autoflow/wiki/learnings/manual-merge-recovery-20260427.md, .autoflow/wiki/learnings/merge-blocked-already-applied-patch.md, .autoflow/wiki/learnings/runtime-log-scope-vs-finish-contract-20260429.md, .autoflow/wiki/log.md, .autoflow/wiki/operations/runner-health.md, .autoflow/wiki/operations/runner-timing.md, .autoflow/wiki/project-overview.md, .autoflow/logs/hooks/watch-board.pid, .autoflow/logs/hooks/watch-board.stderr.log, .autoflow/logs/hooks/watch-board.stdout.log, .autoflow/telemetry/.gitignore, .autoflow/tickets/check/check_001.md, .autoflow/tickets/check/check_002.md, .autoflow/tickets/done/prd_151/order_144.md, .autoflow/tickets/done/prd_158/prd_158.md, .autoflow/tickets/done/prd_163/prd_163.md, .autoflow/tickets/done/prd_164/prd_164.md, .autoflow/tickets/done/prd_165/prd_165.md, .autoflow/tickets/done/prd_166/prd_166.md, .autoflow/tickets/done/prd_167/order_147.md, .autoflow/tickets/done/prd_167/prd_167.md, .autoflow/tickets/inprogress/tickets_157.md, .autoflow/tickets/inprogress/tickets_162.md, .autoflow/tickets/inprogress/verify_157.md, .autoflow/tickets/inprogress/verify_162.md, .autoflow/tickets/todo/tickets_163.md, .autoflow/tickets/todo/tickets_164.md, .autoflow/tickets/todo/tickets_165.md, .autoflow/tickets/todo/tickets_166.md, .autoflow/wiki-raw/agent-definitions.md, .autoflow/wiki/agents/index.md, .autoflow/wiki/answers/prompt-evolution.md, .autoflow/wiki/answers/runner-health.md, .autoflow/wiki/answers/runner-timing.md, .autoflow/wiki/answers/telemetry-data-handling.md, .autoflow/wiki/architecture/runner-id-roles.md, .autoflow/wiki/operations/index.md, .autoflow/wiki/skills-local/.usage.json, .autoflow/wiki/skills-local/ticket-completion/ai-work-for-prd-162/SKILL.md, .autoflow/wiki/skills/skill_004.md, .autoflow/wiki/skills/skill_005.md, .autoflow/wiki/skills/skill_006.md, .autoflow/wiki/skills/skill_007.md, .autoflow/wiki/sources/agent-definitions.md, semantic_findings.txt

## Recommended Human Action

Orchestrator AI가 dirty path를 Allowed Paths 소유권별로 commit 또는 stash 처리했는지 확인한다.

## Status

- [ ] 사람 확인 완료
