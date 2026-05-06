---
title: Blocked dirty orchestration requested for tickets_183.md
created_at: 2026-05-05T23:41:00Z
event_type: blocked-dirty-orchestration
prd_key: prd_184
ticket_id: 183
source: start-plan.sh
---

# Blocked dirty orchestration requested for tickets_183.md

## What Happened

Planner runtime detected a blocked ticket whose Allowed Paths still overlap dirty PROJECT_ROOT paths and emitted source=blocked-dirty-orchestration.

## Evidence

blocked_origin=tickets/inprogress/tickets_183.md; failure_class=dirty_project_root_conflict; dirty_paths=apps/desktop/src/renderer/main.tsx, apps/desktop/src/renderer/styles.css, packages/cli/runners-project.sh

cleanup_commit=3421172; commit_subject=[PRD_184][tickets_183] orchestration cleanup: desktop runner reconnect paths; post_commit_status=listed dirty paths clean

## Recommended Human Action

Orchestrator AI가 dirty path를 Allowed Paths 소유권별로 commit 또는 stash 처리했는지 확인한다.

## Status

- [ ] 사람 확인 완료
