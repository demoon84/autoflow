---
title: Blocked dirty orchestration requested for tickets_162.md
created_at: 2026-05-03T14:36:18Z
event_type: blocked-dirty-orchestration
prd_key: prd_163
ticket_id: 162
source: start-plan.sh
---

# Blocked dirty orchestration requested for tickets_162.md

## What Happened

Planner runtime detected a blocked ticket whose Allowed Paths still overlap dirty PROJECT_ROOT paths and emitted source=blocked-dirty-orchestration.

## Evidence

blocked_origin=tickets/inprogress/tickets_162.md; failure_class=dirty_project_root_conflict; dirty_paths=.autoflow/telemetry/runs.jsonl, .autoflow/tickets/inprogress/tickets_162.md, .autoflow/tickets/check/check_017.md, .autoflow/tickets/inbox/order_149.md

## Recommended Human Action

Orchestrator AI가 dirty path를 Allowed Paths 소유권별로 commit 또는 stash 처리했는지 확인한다.

## Status

- [x] 사람 확인 완료 — 2026-05-03T14:36:30Z 16번째 누적 check entry. 사용자가 order_149.md 로 self-referential live-lock 보고. Planner 가 ticket_162 Recovery State 를 needs_user 로 escalate. Runtime fixpoint guard fix 는 backlog/prd_168.md.
