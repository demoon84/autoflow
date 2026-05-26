export function usage(): void {
  process.stdout.write(`Usage:
  autoflow tool runner-tool [--project <path>] [--board <path>] <role> <command> ...

  autoflow tool runner-tool planner queue-snapshot
  autoflow tool runner-tool planner reserve-id --kind <prd|ticket> [--ttl-sec <seconds>]
  autoflow tool runner-tool planner write-prd --id <NNN> --content-file <file> [--reservation <path>] [--overwrite] [--md-only]
  autoflow tool runner-tool planner ensure-prd-worktree --id <NNN>
  autoflow tool runner-tool planner write-ticket --id <NNN> --content-file <file> [--reservation <path>] [--overwrite] [--allow-missing-prd]
  autoflow tool runner-tool planner item-archive --from <board-path> --project-key <key> [--as <filename>]
  autoflow tool runner-tool planner guard [--strict]

  autoflow tool runner-tool worker active-get [--runner <id>]
  autoflow tool runner-tool worker work-snapshot [--runner <id>]
  autoflow tool runner-tool worker claim --ticket <work-item-id|path> [--runner <id>]
  autoflow tool runner-tool worker worktree-status --ticket <work-item-id|path>
  autoflow tool runner-tool worker worktree-ensure --ticket <work-item-id|path>
  autoflow tool runner-tool worker stage-set --ticket <work-item-id|path> --stage <value> [--runner <id>]
  autoflow tool runner-tool worker context-update --ticket <work-item-id|path> [--next-action <text>] [--resume-current <text>] [--resume-last <text>] [--resume-first <text>] [--note <text>]
  autoflow tool runner-tool worker verification-record --ticket <work-item-id|path> --result <value> [--command <cmd>] [--exit-code <n>] [--summary <text>|--summary-file <file>]
  autoflow tool runner-tool worker done-when-check --ticket <work-item-id|path>
  autoflow tool runner-tool worker diff-check --ticket <work-item-id|path>
  autoflow tool runner-tool worker code-report --ticket <work-item-id|path> [--runner <id>]
  autoflow tool runner-tool worker finalize-approved --ticket <work-item-id|path> --summary <text>
  autoflow tool runner-tool worker request-replan --ticket <work-item-id|path> --reason <text>

  # legacy 호환 그룹은 기본 도움말에서 활성 역할로 다루지 않습니다.
  # 워커 finalize-approved 가 sanity gate + merge target verification rerun 으로 단일 마무리합니다.

  autoflow tool runner-tool wiki source-snapshot [--runner <id>] [--max-items <n>]
  autoflow tool runner-tool wiki tick [--runner <id>] [--max-items <n>] [--window 7d|30d|all] [--skip-telemetry] [--skip-lint] [--force-index] [--wait-index] [--no-index] [--no-tickets] [--verbose]
  autoflow tool runner-tool wiki telemetry-summary [--slug-set telemetry-default|--slug <slug>] [--window 7d|30d|all] [--runner <id>]
  autoflow tool runner-tool wiki query --term <text> [--term <text>]... [--limit <n>] [--rag] [--synth] [--save-as <slug>] [--runner <id>]
  autoflow tool runner-tool wiki lint [--runner <id>]
  autoflow tool runner-tool wiki index-refresh [--no-tickets] [--runner <id>]
  autoflow tool runner-tool wiki ingest [--no-tickets] [--runner <id>]
  autoflow tool runner-tool wiki write-page --path wiki/<path>.md --content-file <file> [--overwrite]
  autoflow tool runner-tool wiki diff-snapshot

출력은 JSON입니다. Runner tool은 scope, Done When, work 선택을 추론하지 않습니다. runner assignment가 있으면 요청 item과 맞아야 하며, 없으면 3개 고정 러너(planner/worker/wiki)가 해당 role의 대기열에서 하나만 선택해 실행합니다.
`);
}
