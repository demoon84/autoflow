---
title: Blocked dirty orchestration requested for tickets_191.md
created_at: 2026-05-05T22:22:48Z
event_type: blocked-dirty-orchestration
prd_key: prd_192
ticket_id: 191
source: start-plan.sh
---

# Blocked dirty orchestration requested for tickets_191.md

## What Happened

Planner runtime detected a blocked ticket whose Allowed Paths still overlap dirty PROJECT_ROOT paths and emitted source=blocked-dirty-orchestration.

## Evidence

blocked_origin=tickets/inprogress/tickets_191.md; failure_class=dirty_project_root_conflict; dirty_paths=apps/desktop/src/main.js, apps/desktop/src/renderer/main.tsx

## Recommended Human Action

Orchestrator AI가 dirty path를 Allowed Paths 소유권별로 commit 또는 stash 처리했는지 확인한다.

## Status

- [ ] 사람 확인 완료
