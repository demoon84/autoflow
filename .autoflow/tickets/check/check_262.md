---
title: Blocked dirty orchestration requested for tickets_184.md
created_at: 2026-05-06T00:24:27Z
event_type: blocked-dirty-orchestration
prd_key: prd_185
ticket_id: 184
source: start-plan.sh
---

# Blocked dirty orchestration requested for tickets_184.md

## What Happened

Planner runtime detected a blocked ticket whose Allowed Paths still overlap dirty PROJECT_ROOT paths and emitted source=blocked-dirty-orchestration.

## Evidence

blocked_origin=tickets/inprogress/tickets_184.md; failure_class=dirty_project_root_conflict; dirty_paths=.autoflow/README.md, .autoflow/agents/monitor-agent.md, .autoflow/automations/README.md, .autoflow/runners/config.toml, .autoflow/scripts/start-monitor.sh, AGENTS.md, apps/desktop/src/main.js, apps/desktop/src/renderer/main.tsx, bin/autoflow, packages/cli/doctor-project.sh, packages/cli/monitor-project.sh, packages/cli/package-board-common.sh, packages/cli/run-role.sh, packages/cli/runners-project.sh, runtime/board-scripts/run-role.sh, runtime/board-scripts/runners-project.sh, runtime/board-scripts/start-monitor.sh, tests/smoke/monitor-agent-smoke.sh

## Recommended Human Action

Orchestrator AI가 dirty path를 Allowed Paths 소유권별로 commit 또는 stash 처리했는지 확인한다.

## Status

- [ ] 사람 확인 완료
