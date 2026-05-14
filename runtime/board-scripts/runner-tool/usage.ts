export function usage(): void {
  process.stdout.write(`Usage:
  runner-tool.ts planner queue-snapshot
  runner-tool.ts planner reserve-id --kind <prd|ticket|order> [--ttl-sec <seconds>]
  runner-tool.ts planner write-prd --id <NNN> --content-file <file> [--reservation <path>] [--overwrite]
  runner-tool.ts planner write-ticket --id <NNN> --content-file <file> [--reservation <path>] [--overwrite]
  runner-tool.ts planner item-archive --from <board-path> --project-key <key> [--as <filename>]
  runner-tool.ts planner recovery-update --ticket <board-path> --status <value> [--failure-class <value>] [--evidence <text>] [--decision <text>] [--instruction <text>] [--note <text>]
  runner-tool.ts planner guard [--strict]

  runner-tool.ts worker active-get [--runner <id>]
  runner-tool.ts worker todo-snapshot [--runner <id>]
  runner-tool.ts worker claim --ticket <Todo-NNN|path> [--runner <id>]
  runner-tool.ts worker worktree-status --ticket <Todo-NNN|path>
  runner-tool.ts worker worktree-ensure --ticket <Todo-NNN|path>
  runner-tool.ts worker stage-set --ticket <Todo-NNN|path> --stage <value> [--runner <id>]
  runner-tool.ts worker context-update --ticket <Todo-NNN|path> [--next-action <text>] [--resume-current <text>] [--resume-last <text>] [--resume-first <text>] [--note <text>]
  runner-tool.ts worker verification-record --ticket <Todo-NNN|path> --result <value> [--command <cmd>] [--exit-code <n>] [--summary <text>|--summary-file <file>]
  runner-tool.ts worker done-when-check --ticket <Todo-NNN|path>
  runner-tool.ts worker diff-check --ticket <Todo-NNN|path>
  runner-tool.ts worker code-report --ticket <Todo-NNN|path> [--runner <id>]
  runner-tool.ts worker submit-to-verifier --ticket <Todo-NNN|path> --summary <text>
  runner-tool.ts worker finalize-approved --ticket <Todo-NNN|path> --summary <text>
  runner-tool.ts worker create-retry-order --ticket <Todo-NNN|path> --reason <text>

  runner-tool.ts verifier queue-snapshot [--runner <id>]
  runner-tool.ts verifier evidence --ticket <Todo-NNN|path> [--patch-bytes <n>]
  runner-tool.ts verifier decision-record --ticket <Todo-NNN|path> --decision <pass|revise|replan> --reason <text> [--runner <id>]
  runner-tool.ts verifier approve-merge --ticket <Todo-NNN|path> --summary <text> [--runner <id>]
  runner-tool.ts verifier request-revision --ticket <Todo-NNN|path> --reason <text> [--runner <id>]
  runner-tool.ts verifier request-replan --ticket <Todo-NNN|path> --reason <text> [--runner <id>]
  runner-tool.ts verifier wake

  runner-tool.ts wiki source-snapshot [--runner <id>] [--max-items <n>]
  runner-tool.ts wiki update-baseline [--dry-run]
  runner-tool.ts wiki telemetry-summary [--slug-set telemetry-default|--slug <slug>] [--window 7d|30d|all] [--runner <id>]
  runner-tool.ts wiki query --term <text> [--term <text>]... [--limit <n>] [--rag] [--synth] [--save-as <slug>] [--runner <id>]
  runner-tool.ts wiki lint [--semantic] [--runner <id>]
  runner-tool.ts wiki ingest --source <file> [--slug <slug>] [--no-summary] [--runner <id>]
  runner-tool.ts wiki retrofit-frontmatter [--dry-run] [--page wiki/<kind>/<slug>.md] [--allow-adapter] [--runner <id>]
  runner-tool.ts wiki write-page --path wiki/<path>.md --content-file <file> [--overwrite]
  runner-tool.ts wiki diff-snapshot
  runner-tool.ts wiki wake

Output is JSON. Runner tools do not infer scope, draft Done When, or choose work.
`);
}
