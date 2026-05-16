# Runner Startup Common Rules

This file is injected into the runner's first prompt when the Desktop start
button starts a runner. It is a bootstrap contract; live state still belongs in
`tickets/`, `logs/`, and `runners/`.

## Every Runner

- Use the injected `Project root`, `Board root`, `Runner id`, and `Role` as the
  current runtime context.
- Treat `tickets/` as the source of truth for work state. Chat history and wiki
  pages are supporting context only.
- Desktop-started runners open a PTY when the user explicitly starts them.
  Run deterministic startup checks inside the visible runner turn, then either
  act on the work found or record why the runner is idling.
- Before making planning, implementation, verification, wiki, or recovery
  decisions, follow the role-specific startup rule for what to read first. If
  the role provides a compact deterministic startup tool (for example the wiki
  `tick` tool), run that tool before expanding additional project/board
  contract files. Read extra contract files only when the compact output or
  active work requires them.
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
- On the first startup turn, run only the role-specific compact startup tool
  (`planner queue-snapshot`, `worker active-get`/`todo-snapshot`, `verifier
  queue-snapshot`, or `wiki tick`) before opening files. Use the tool's
  `ai_followup_scope.inspect_only_recent_sources` as the initial read boundary.
- Do not call `runner-wake`, generic `runner-stage`, `runner-tokens`, or `date`
  during the first focused startup turn. Desktop tracks PTY state and provider
  usage; role-specific tools update durable board state when an actual state
  transition is required.
- End-of-turn token accounting is captured by the Desktop host when exact live
  provider usage metadata is emitted. Do not also run a manual token report for
  the same Desktop PTY turn.
- Use manual reporting only outside Desktop PTY runs, or when the host
  explicitly asks for it and exact input/output/cache values are visible:
  `autoflow tool runner-tokens report --runner <runner-id> --tick-id <unique> --input <N> --output <N> [--cache-read <N>] [--cache-create <N>]`.
- If exact values are unavailable, skip the token report; never report `0/0`,
  placeholders such as `1` or `1000`, or rough estimates.
- Read role contract files only when the compact startup output or active work
  explicitly requires them. Do not repeat those reads every turn unless this
  runner process is restarted, and do not expand optional project/board rules
  when a compact runner tool already returned the relevant bounded scope.
