---
auto_generated: telemetry-summary
slug: operations/runner-health
window: 7d
source_event_count: 17
last_synced_at: 2026-05-06T01:09:13Z
input_fingerprint: fc28425c6a9f742beaab859626ba62f3bd284473c64189b4e7114b32aa00e751
---

> This page is auto-generated from `.autoflow/telemetry/*.jsonl`; manual edits may be overwritten on the next sync. Keep durable human notes in `wiki/answers/`, `wiki/decisions/`, or another human-owned wiki page.

## Failure Patterns

| failure_class | count |
| --- | ---: |
| adapter_exit_126 | 9 |
| adapter_timeout | 5 |
| adapter_exit_15 | 1 |
| adapter_exit_125 | 1 |
| adapter_exit_1 | 1 |

## Frequent Patterns

| pattern | count |
| --- | ---: |
| wiki / adapter_timeout / killed | 5 |
| planner / adapter_exit_126 / failed | 5 |
| worker / adapter_exit_126 / failed | 4 |
| worker / adapter_exit_15 / failed | 1 |
| wiki / adapter_exit_125 / failed | 1 |

## Recovery Rate

- Auto recovery rate: 100%
- Recovery denominator: 17 failure events in the selected window.

