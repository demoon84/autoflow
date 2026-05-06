---
title: Blocked dirty orchestration requested for tickets_184.md
created_at: 2026-05-05T23:59:53Z
event_type: blocked-dirty-orchestration
prd_key: prd_185
ticket_id: 184
source: start-plan.sh
---

# Blocked dirty orchestration requested for tickets_184.md

## What Happened

Planner runtime detected a blocked ticket whose Allowed Paths still overlap dirty PROJECT_ROOT paths and emitted source=blocked-dirty-orchestration.

## Evidence

blocked_origin=tickets/inprogress/tickets_184.md; failure_class=dirty_project_root_conflict; dirty_paths=apps/desktop/src/main.js, apps/desktop/src/renderer/main.tsx, apps/desktop/src/renderer/styles.css, runtime/board-scripts/runners-project.sh

cleanup_commit=7dc2582; commit_subject=[PRD_185][ticket_184] orchestration cleanup: integrate blocked dirty allowed paths

post_commit_status=`git status --short -- apps/desktop/src/main.js apps/desktop/src/renderer/main.tsx apps/desktop/src/renderer/styles.css runtime/board-scripts/runners-project.sh` returned no output.

## Recommended Human Action

Orchestrator AI가 dirty path를 Allowed Paths 소유권별로 commit 또는 stash 처리했는지 확인한다.

## Status

- [ ] 사람 확인 완료
