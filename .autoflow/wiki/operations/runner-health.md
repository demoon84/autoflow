---
auto_generated: telemetry-summary
slug: operations/runner-health
window: 7d
source_event_count: 26
last_synced_at: 2026-05-09T07:20:33Z
input_fingerprint: e20d53705c6a850ac29a8af515fa2d50dc3d6ae8afe05680377f9d6f52d43052
---

> This page is auto-generated from `.autoflow/telemetry/*.jsonl`; manual edits may be overwritten on the next sync. Keep durable human notes in `wiki/answers/`, `wiki/decisions/`, or another human-owned wiki page.

## Failure Patterns

| failure_class | count |
| --- | ---: |
| adapter_exit_126 | 10 |
| adapter_timeout | 6 |
| adapter_exit_1 | 6 |
| adapter_exit_15 | 2 |
| adapter_exit_125 | 2 |

## Frequent Patterns

| pattern | count |
| --- | ---: |
| wiki / adapter_timeout / killed | 6 |
| worker / adapter_exit_126 / failed | 5 |
| planner / adapter_exit_126 / failed | 5 |
| worker / adapter_exit_1 / failed | 3 |
| worker / adapter_exit_15 / failed | 2 |

## Recovery Rate

- Auto recovery rate: 100%
- Recovery denominator: 26 failure events in the selected window.

