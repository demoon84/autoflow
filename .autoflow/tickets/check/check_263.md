---
title: Blocked ticket auto-recovered to todo tickets_185.md
created_at: 2026-05-06T00:28:14Z
event_type: blocked-auto-recover
prd_key: prd_186
ticket_id: 185
source: start-plan.sh
---

# Blocked ticket auto-recovered to todo tickets_185.md

## What Happened

A blocked dirty-root ticket was automatically returned to todo after PROJECT_ROOT no longer reported overlapping dirty Allowed Paths.

## Evidence

blocked_origin=tickets/inprogress/tickets_185.md; returned_to=tickets/todo/tickets_185.md; failure_class=dirty_project_root_conflict

## Recommended Human Action

새 worktree claim 후 Recovery State가 resolved 상태로 이어지는지 확인한다.

## Status

- [ ] 사람 확인 완료
