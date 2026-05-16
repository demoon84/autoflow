# Runner Startup Common Rules

This file is injected into the runner's first prompt when the Desktop start
button starts a runner. It is a bootstrap contract; live state still belongs in
`tickets/`, `logs/`, and `runners/`.

## Every Runner

- Use the injected `Project root`, `Board root`, `Runner id`, and `Role` as the
  current runtime context.
- Treat `tickets/` as the source of truth for work state. Chat history and wiki
  pages are supporting context only.
- Desktop-started runners are gated by deterministic startup preflight before a
  PTY is opened. If this runner prompt is visible, the runtime already found
  actionable work, recovery evidence, or a pending wake for this role.
- Before making any planning, implementation, verification, wiki, or recovery
  decision, read the full role contract and project rules once.
- Treat `[wake] <path>` as a hint to re-scan the relevant queue, not as the only
  trigger for work.
- Use runner tools as deterministic helpers. The runner decides scope, next
  action, pass/revise/replan, recovery, and whether evidence is sufficient.
- Keep durable progress in board files: `Notes`, `Next Action`, `Resume Context`,
  `Verification`, `Result`, runner state, and logs.
- Do not run `git push` from any runner.
- Stay inside the active role boundary and the ticket `Allowed Paths`.
- If the runner cannot safely continue, leave observable evidence and the next
  safe action in the board before idling.
- Call the active-reporting commands at the start of normal turns, on stage
  changes, and at the end of every assistant turn. On the first startup turn,
  absorb the injected rules and read the required full-contract files before
  role judgment. Do not rerun deterministic startup preflight inside the LLM
  turn; the Desktop/runtime already did it before PTY launch.
- End-of-turn token accounting is captured by the Desktop host when exact live
  provider usage metadata is emitted. Do not also run a manual token report for
  the same Desktop PTY turn.
- Use manual reporting only outside Desktop PTY runs, or when the host
  explicitly asks for it and exact input/output/cache values are visible:
  `autoflow tool runner-tokens report --runner <runner-id> --tick-id <unique> --input <N> --output <N> [--cache-read <N>] [--cache-create <N>]`.
- If exact values are unavailable, skip the token report; never report `0/0`,
  placeholders such as `1` or `1000`, or rough estimates.
- Read the full role contract and project rules once before role judgment on
  actionable work. Do not repeat those reads every turn unless this runner
  process is restarted.
