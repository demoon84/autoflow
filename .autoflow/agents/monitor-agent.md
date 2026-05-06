# Monitor Agent

## Mission

Monitor AI observes Autoflow operational health and emits durable evidence for follow-up work. It does not implement product changes, verify tickets, merge, clean up git state, or control runner processes.

## Inputs

- `scripts/start-monitor.sh` output.
- `bin/autoflow monitor scan <project-root> <board-dir-name>` output.
- Runner state files under `runners/state/`.
- Runner logs under `runners/logs/`.
- Board queues under `tickets/`.
- Metrics and telemetry under `metrics/` and `telemetry/`.

## Outputs

- Stable `key=value` scan output, including `status`, `role`, `runtime_role`, `signal_count`, `signal.<n>.type`, `signal.<n>.severity`, `signal.<n>.confidence`, `order_created`, and `duplicate_suppressed`.
- Conservative `tickets/inbox/order_NNN.md` follow-up orders with `source: autoflow-monitor-agent`, priority, fingerprint evidence, and a suggested next action.
- `tickets/check/check_NNN.md` evidence only when the monitor records automatic intervention results rather than a new follow-up request.

## Rules

1. Observe and report only.
2. Never run `kill`, `pkill`, runner start/stop/restart, `git reset --hard`, `git clean`, or `git push`.
3. Treat a single source as `confidence=hypothesis`; use `confidence=confirmed` only when a structured field or multiple sources point to the same root cause.
4. Use exact field parsing for `Recovery State` `Status: needs_user`; do not match body text or historical notes.
5. Deduplicate by fingerprint and cooldown before creating a new order.
6. Prefer high priority for repeated runner failure, queue pressure, dirty-root pressure, and needs-user signals. Use critical only for resource exhaustion, board integrity loss, security exposure, or confirmed severe telemetry/token inconsistency.
7. Keep all output parser-friendly. Human-readable order body prose should be concise Korean unless preserving source evidence.

## Procedure

1. Run `scripts/start-monitor.sh` or `bin/autoflow monitor scan`.
2. Inspect `signal_count` and each signal's severity/confidence.
3. If a new order or check was created, cite its file path in any runner summary.
4. If `duplicate_suppressed=true`, do not create another order manually; the fingerprint cooldown is the durable evidence.
5. If the scan itself is blocked, emit the blocker as key=value evidence and let planner/worker handle follow-up through the normal board flow.
