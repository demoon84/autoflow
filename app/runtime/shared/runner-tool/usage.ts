export function usage(): void {
  process.stdout.write(`Usage:
  autoflow tool runner-tool planner queue-snapshot
  autoflow tool runner-tool planner reserve-id --kind <prd|ticket|order> [--ttl-sec <seconds>]
  autoflow tool runner-tool planner write-prd --id <NNN> --content-file <file> [--reservation <path>] [--overwrite]
  autoflow tool runner-tool planner write-ticket --id <NNN> --content-file <file> [--reservation <path>] [--overwrite]
  autoflow tool runner-tool planner item-archive --from <board-path> --project-key <key> [--as <filename>]
  autoflow tool runner-tool planner recovery-update --ticket <board-path> --status <value> [--failure-class <value>] [--evidence <text>] [--decision <text>] [--instruction <text>] [--note <text>]
  autoflow tool runner-tool planner guard [--strict]

  autoflow tool runner-tool worker active-get [--runner <id>]
  autoflow tool runner-tool worker todo-snapshot [--runner <id>]
  autoflow tool runner-tool worker claim --ticket <Todo-NNN|path> [--runner <id>]
  autoflow tool runner-tool worker worktree-status --ticket <Todo-NNN|path>
  autoflow tool runner-tool worker worktree-ensure --ticket <Todo-NNN|path>
  autoflow tool runner-tool worker stage-set --ticket <Todo-NNN|path> --stage <value> [--runner <id>]
  autoflow tool runner-tool worker context-update --ticket <Todo-NNN|path> [--next-action <text>] [--resume-current <text>] [--resume-last <text>] [--resume-first <text>] [--note <text>]
  autoflow tool runner-tool worker verification-record --ticket <Todo-NNN|path> --result <value> [--command <cmd>] [--exit-code <n>] [--summary <text>|--summary-file <file>]
  autoflow tool runner-tool worker done-when-check --ticket <Todo-NNN|path>
  autoflow tool runner-tool worker diff-check --ticket <Todo-NNN|path>
  autoflow tool runner-tool worker code-report --ticket <Todo-NNN|path> [--runner <id>]
  autoflow tool runner-tool worker submit-to-verifier --ticket <Todo-NNN|path> --summary <text>
  autoflow tool runner-tool worker finalize-approved --ticket <Todo-NNN|path> --summary <text>
  autoflow tool runner-tool worker create-retry-order --ticket <Todo-NNN|path> --reason <text>

  autoflow tool runner-tool verifier queue-snapshot [--runner <id>]
  autoflow tool runner-tool verifier evidence --ticket <Todo-NNN|path> [--patch-bytes <n>]
  autoflow tool runner-tool verifier decision-record --ticket <Todo-NNN|path> --decision <pass|revise|replan> --reason <text> [--runner <id>]
  autoflow tool runner-tool verifier approve-merge --ticket <Todo-NNN|path> --summary <text> [--runner <id>]
  autoflow tool runner-tool verifier request-revision --ticket <Todo-NNN|path> --reason <text> [--runner <id>]
  autoflow tool runner-tool verifier request-replan --ticket <Todo-NNN|path> --reason <text> [--runner <id>]
  autoflow tool runner-tool verifier wake

  autoflow tool runner-tool wiki source-snapshot [--runner <id>] [--max-items <n>]
  autoflow tool runner-tool wiki update-baseline [--dry-run]
  autoflow tool runner-tool wiki telemetry-summary [--slug-set telemetry-default|--slug <slug>] [--window 7d|30d|all] [--runner <id>]
  autoflow tool runner-tool wiki query --term <text> [--term <text>]... [--limit <n>] [--rag] [--synth] [--save-as <slug>] [--runner <id>]
  autoflow tool runner-tool wiki lint [--semantic] [--runner <id>]
  autoflow tool runner-tool wiki index-refresh [--no-tickets] [--runner <id>]
  autoflow tool runner-tool wiki ingest [--no-tickets] [--runner <id>]  # compatibility alias for index-refresh
  autoflow tool runner-tool wiki retrofit-frontmatter [--dry-run] [--page wiki/<kind>/<slug>.md] [--allow-adapter] [--runner <id>]
  autoflow tool runner-tool wiki write-page --path wiki/<path>.md --content-file <file> [--overwrite]
  autoflow tool runner-tool wiki diff-snapshot
  autoflow tool runner-tool wiki wake

Output is JSON. Runner tools do not infer scope, draft Done When, or choose work.
`);
}
