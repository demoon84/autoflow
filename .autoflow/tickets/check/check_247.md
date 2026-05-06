---
title: Blocked dirty PROJECT_ROOT path integrated for tickets_191
created_at: 2026-05-05T22:30:50Z
event_type: blocked-dirty-orchestration
prd_key: prd_192
ticket_id: tickets_191
source: planner
---

# Blocked dirty PROJECT_ROOT path integrated for tickets_191

## What Happened

Planner integrated the runtime-listed dirty PROJECT_ROOT path apps/desktop/src/main.js into local cleanup commit 96a7a24.

## Evidence

source=blocked-dirty-orchestration; dirty_paths=apps/desktop/src/main.js; commit=96a7a24; wiki_query_result_count=0

## Recommended Human Action

사람은 commit 96a7a24와 tickets_191 Recovery State를 확인하고, 다음 planner tick에서 blocked-auto-recover가 todo로 되돌리는지 확인한다.

## Status

- [ ] 사람 확인 완료
