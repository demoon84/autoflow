---
title: Blocked dirty orchestration requested for tickets_188.md
created_at: 2026-05-06T01:17:07Z
event_type: blocked-dirty-orchestration
prd_key: prd_189
ticket_id: 188
source: start-plan.sh
---

# Blocked dirty orchestration requested for tickets_188.md

## What Happened

Planner runtime detected a blocked ticket whose Allowed Paths still overlap dirty PROJECT_ROOT paths and emitted source=blocked-dirty-orchestration.

## Evidence

blocked_origin=tickets/inprogress/tickets_188.md; failure_class=dirty_project_root_conflict; dirty_paths=packages/cli/run-role.sh, runtime/board-scripts/run-role.sh

## Recommended Human Action

Orchestrator AI가 dirty path를 Allowed Paths 소유권별로 commit 또는 stash 처리했는지 확인한다.

## Status

- [ ] 사람 확인 완료
