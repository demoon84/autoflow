---
title: Blocked dirty orchestration requested for tickets_172.md
created_at: 2026-05-05T07:18:23Z
event_type: blocked-dirty-orchestration
prd_key: prd_173
ticket_id: 172
source: start-plan.sh
---

# Blocked dirty orchestration requested for tickets_172.md

## What Happened

Planner runtime detected a blocked ticket whose Allowed Paths still overlap dirty PROJECT_ROOT paths and emitted source=blocked-dirty-orchestration.

## Evidence

blocked_origin=tickets/inprogress/tickets_172.md; failure_class=dirty_root; dirty_paths=.autoflow/runners/config.toml, .autoflow/telemetry/runs.jsonl, packages/cli/runners-project.sh

## Recommended Human Action

Orchestrator AI가 dirty path를 Allowed Paths 소유권별로 commit 또는 stash 처리했는지 확인한다.

## Status

- [ ] 사람 확인 완료
