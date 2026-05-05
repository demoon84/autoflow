---
title: Blocked dirty orchestration requested for tickets_166.md
created_at: 2026-05-05T01:11:50Z
event_type: blocked-dirty-orchestration
prd_key: prd_167
ticket_id: 166
source: start-plan.sh
---

# Blocked dirty orchestration requested for tickets_166.md

## What Happened

Planner runtime detected a blocked ticket whose Allowed Paths still overlap dirty PROJECT_ROOT paths and emitted source=blocked-dirty-orchestration.

## Evidence

blocked_origin=tickets/inprogress/tickets_166.md; failure_class=dirty_root; dirty_paths=.autoflow/telemetry/runs.jsonl, .autoflow/tickets/inprogress/tickets_166.md, .autoflow/wiki/operations/runner-health.md, .autoflow/wiki/skills-local/.usage.json, .autoflow/logs/verifier_idle_20260505T010947Z.md, .autoflow/tickets/check/check_202.md, .autoflow/wiki/skills-local/orchestration-cleanup/ai-work-for-prd-167-7/SKILL.md

## Recommended Human Action

Orchestrator AI가 dirty path를 Allowed Paths 소유권별로 commit 또는 stash 처리했는지 확인한다.

## Status

- [ ] 사람 확인 완료
