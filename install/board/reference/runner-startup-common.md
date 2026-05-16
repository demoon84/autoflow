# Runner Startup Common Rules

This file is injected into the runner's first prompt when the Desktop start
button starts a runner. It is a bootstrap contract; live state still belongs in
`tickets/`, `logs/`, and `runners/`.

## Every Runner

- Use the injected `Project root`, `Board root`, `Runner id`, and `Role` as the
  current runtime context.
- Treat `tickets/` as the source of truth for work state. Chat history and wiki
  pages are supporting context only.
- Run the startup scan immediately after absorbing the injected rules and the
  required one-time full-contract reads. Do not wait for a fresh `[wake]`
  message before checking the current board.
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
  polling.
- End-of-turn token accounting is captured by the Desktop host when provider
  session metadata is available. If the CLI itself shows exact values, the
  runner may also report them:
  `node autoflow tool runner-tokens report --runner <runner-id> --tick-id <unique> --input <N> --output <N> [--cache-read <N>] [--cache-create <N>]`.
- Token reporting must use exact input/output/cache values from the active CLI
  status, result output, or host-captured session metadata. If exact values are
  unavailable, skip the token report; never report `0/0`, placeholders such as
  `1` or `1000`, or rough estimates.
- Read the full role contract and project rules once at runner startup. Do not
  repeat those reads every turn unless this runner process is restarted.
