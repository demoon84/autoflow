---
title: Blocked dirty orchestration requested for tickets_166.md
created_at: 2026-05-05T01:25:44Z
event_type: blocked-dirty-orchestration
prd_key: prd_167
ticket_id: 166
source: start-plan.sh
---

# Blocked dirty orchestration requested for tickets_166.md

## What Happened

Planner runtime detected a blocked ticket whose Allowed Paths still overlap dirty PROJECT_ROOT paths and emitted source=blocked-dirty-orchestration.

Planner follow-up in the same tick classified this as an `iteration_no_progress` loop instead of making another cleanup commit. The dirty set was recurring board/runtime evidence only, and related live-lock repair work is now active as `tickets/inprogress/tickets_167.md`; later follow-up scope remains in `tickets/inbox/order_175.md`.

## Evidence

blocked_origin=tickets/inprogress/tickets_166.md; failure_class=dirty_root; dirty_paths=.autoflow/telemetry/runs.jsonl, .autoflow/tickets/inprogress/tickets_166.md, .autoflow/logs/verifier_idle_20260505T012217Z.md, .autoflow/logs/verifier_idle_20260505T012427Z.md, .autoflow/tickets/check/check_205.md

## Recommended Human Action

`tickets/inprogress/tickets_166.md` 의 `Recovery State` 가 `needs_user` / `iteration_no_progress` 로 parked 되었는지 확인하고, worker 가 `tickets/inprogress/tickets_167.md` 를 계속 처리하는지 확인한다. 이 check record 자체는 추가 cleanup commit 을 요구하지 않는다.

## Status

- [ ] 사람 확인 완료
