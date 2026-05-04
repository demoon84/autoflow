---
title: Blocked dirty orchestration requested for tickets_163.md
created_at: 2026-05-03T15:05:17Z
event_type: blocked-dirty-orchestration
prd_key: prd_164
ticket_id: 163
source: start-plan.sh
---

# Blocked dirty orchestration requested for tickets_163.md

## What Happened

Planner runtime detected a blocked ticket whose Allowed Paths still overlap dirty PROJECT_ROOT paths and emitted source=blocked-dirty-orchestration.

## Evidence

blocked_origin=tickets/inprogress/tickets_163.md; failure_class=dirty_project_root_conflict; dirty_paths=.autoflow/telemetry/runs.jsonl, .autoflow/tickets/done/prd_169/order_148.md, .autoflow/tickets/inprogress/tickets_162.md, .autoflow/tickets/todo/tickets_163.md, .autoflow/tickets/check/check_017.md, .autoflow/tickets/check/check_018.md, .autoflow/tickets/check/check_019.md, .autoflow/tickets/check/check_020.md, .autoflow/tickets/check/check_021.md, .autoflow/tickets/check/check_022.md, .autoflow/tickets/check/check_023.md, .autoflow/tickets/check/check_024.md, .autoflow/tickets/check/check_025.md, .autoflow/tickets/check/check_026.md, .autoflow/tickets/check/check_027.md, .autoflow/tickets/check/check_028.md, .autoflow/tickets/check/check_029.md, .autoflow/tickets/check/check_030.md, .autoflow/tickets/done/prd_168/prd_168.md, .autoflow/tickets/done/prd_169/prd_169.md, .autoflow/tickets/inbox/order_149.md, .autoflow/tickets/inprogress/tickets_163.md, .autoflow/tickets/inprogress/verify_163.md, .autoflow/tickets/todo/tickets_167.md, .autoflow/tickets/todo/tickets_168.md

## Recommended Human Action

Orchestrator AI가 dirty path를 Allowed Paths 소유권별로 commit 또는 stash 처리했는지 확인한다.

## Status

- [ ] 사람 확인 완료
