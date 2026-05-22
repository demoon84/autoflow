export function usage(): void {
  process.stdout.write(`Usage:
  autoflow tool runner-tool [--project <path>] [--board <path>] <role> <command> ...

  autoflow tool runner-tool planner queue-snapshot
  autoflow tool runner-tool planner reserve-id --kind <prd|ticket> [--ttl-sec <seconds>]
  autoflow tool runner-tool planner write-prd --id <NNN> --content-file <file> [--reservation <path>] [--overwrite]
  autoflow tool runner-tool planner write-ticket --id <NNN> --content-file <file> [--reservation <path>] [--overwrite] [--allow-missing-prd]
  autoflow tool runner-tool planner item-archive --from <board-path> --project-key <key> [--as <filename>]
  autoflow tool runner-tool planner guard [--strict]

  autoflow tool runner-tool worker active-get [--runner <id>]
  autoflow tool runner-tool worker todo-snapshot [--runner <id>]
  autoflow tool runner-tool worker claim --ticket <TODO-NNN|path> [--runner <id>]
  autoflow tool runner-tool worker worktree-status --ticket <TODO-NNN|path>
  autoflow tool runner-tool worker worktree-ensure --ticket <TODO-NNN|path>
  autoflow tool runner-tool worker stage-set --ticket <TODO-NNN|path> --stage <value> [--runner <id>]
  autoflow tool runner-tool worker context-update --ticket <TODO-NNN|path> [--next-action <text>] [--resume-current <text>] [--resume-last <text>] [--resume-first <text>] [--note <text>]
  autoflow tool runner-tool worker verification-record --ticket <TODO-NNN|path> --result <value> [--command <cmd>] [--exit-code <n>] [--summary <text>|--summary-file <file>]
  autoflow tool runner-tool worker done-when-check --ticket <TODO-NNN|path>
  autoflow tool runner-tool worker diff-check --ticket <TODO-NNN|path>
  autoflow tool runner-tool worker code-report --ticket <TODO-NNN|path> [--runner <id>]
  autoflow tool runner-tool worker submit-to-verifier --ticket <TODO-NNN|path> --summary <text>
  autoflow tool runner-tool worker finalize-approved --ticket <TODO-NNN|path> --summary <text>
  autoflow tool runner-tool worker request-replan --ticket <TODO-NNN|path> --reason <text>

  autoflow tool runner-tool verifier queue-snapshot [--runner <id>]
  autoflow tool runner-tool verifier evidence --ticket <TODO-NNN|path> [--patch-bytes <n>]
  autoflow tool runner-tool verifier decision-record --ticket <TODO-NNN|path> --decision <pass|revise|replan> --reason <text> [--runner <id>]
  autoflow tool runner-tool verifier approve-merge --ticket <TODO-NNN|path> --summary <text> [--runner <id>]
  autoflow tool runner-tool verifier request-revision --ticket <TODO-NNN|path> --reason <text> [--runner <id>]
  autoflow tool runner-tool verifier request-replan --ticket <TODO-NNN|path> --reason <text> [--runner <id>]

  autoflow tool runner-tool wiki source-snapshot [--runner <id>] [--max-items <n>]
  autoflow tool runner-tool wiki tick [--runner <id>] [--max-items <n>] [--window 7d|30d|all] [--skip-telemetry] [--skip-lint] [--force-index] [--wait-index] [--no-index] [--no-tickets] [--verbose]
  autoflow tool runner-tool wiki telemetry-summary [--slug-set telemetry-default|--slug <slug>] [--window 7d|30d|all] [--runner <id>]
  autoflow tool runner-tool wiki query --term <text> [--term <text>]... [--limit <n>] [--rag] [--synth] [--save-as <slug>] [--runner <id>]
  autoflow tool runner-tool wiki lint [--runner <id>]
  autoflow tool runner-tool wiki index-refresh [--no-tickets] [--runner <id>]
  autoflow tool runner-tool wiki ingest [--no-tickets] [--runner <id>]  # compatibility alias for index-refresh
  autoflow tool runner-tool wiki write-page --path wiki/<path>.md --content-file <file> [--overwrite]
  autoflow tool runner-tool wiki diff-snapshot

Output is JSON. Runner tools do not infer scope, draft Done When, or choose work.
`);
}
