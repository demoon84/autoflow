---
title: Blocked dirty orchestration requested for tickets_163.md
created_at: 2026-05-03T15:31:10Z
event_type: blocked-dirty-orchestration
prd_key: prd_164
ticket_id: 163
source: start-plan.sh
---

# Blocked dirty orchestration requested for tickets_163.md

## What Happened

Planner runtime detected a blocked ticket whose Allowed Paths still overlap dirty PROJECT_ROOT paths and emitted source=blocked-dirty-orchestration.

## Evidence

blocked_origin=tickets/inprogress/tickets_163.md; failure_class=dirty_project_root_conflict; dirty_paths=.autoflow/telemetry/runs.jsonl, .autoflow/tickets/inprogress/tickets_163.md

## Recommended Human Action

Orchestrator AI가 dirty path를 Allowed Paths 소유권별로 commit 또는 stash 처리했는지 확인한다.

## Status

- [ ] 사람 확인 완료
