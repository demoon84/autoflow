import {spawnSync, boardRoot, projectRoot, workerId} from "./context";
import {nowIso, printPairs} from "./io";
import {appendNote, replaceScalar, replaceSection, scalar} from "./sections";
import {formatOutput} from "./output";
import {idFromPath, resolveTicketFile, specVerificationCommand, ticketWorkingRoot} from "./ticket";

export function main(): void {
  const [ticketRef, overrideCommand = ""] = process.argv.slice(2);
  if (!ticketRef) {
    process.stderr.write("Usage: verify-ticket.ts <ticket-id-or-path> [verification-command]\n");
    process.exit(1);
  }

  const ticketFile = resolveTicketFile(ticketRef);
  if (!ticketFile) {
    printPairs({
      status: "idle",
      reason: "worker_verify_ticket_missing",
      ticket_ref: ticketRef,
      board_root: boardRoot,
      project_root: projectRoot,
    });
    process.exit(1);
  }

  const ticketId = idFromPath(ticketFile);
  const workingRoot = ticketWorkingRoot(ticketFile);
  const verificationCommand = process.env.AUTOFLOW_VERIFY_COMMAND || overrideCommand || scalar(ticketFile, "Verification", "Command") || specVerificationCommand(ticketFile);
  const startedAt = nowIso();

  if (!workingRoot) {
    appendNote(ticketFile, `Worker verification blocked at ${startedAt}: missing ready worktree.`);
    printPairs({
      status: "blocked",
      reason: "missing_worktree",
      ticket: ticketFile,
      ticket_id: ticketId,
      board_root: boardRoot,
      project_root: projectRoot,
      next_action: `Run autoflow tool runner-tool worker worktree-ensure --ticket ${ticketId}; do not verify or implement in PROJECT_ROOT fallback.`,
    });
    return;
  }

  if (!verificationCommand) {
    appendNote(ticketFile, `Worker verification blocked at ${startedAt}: missing verification command.`);
    printPairs({
      status: "blocked",
      reason: "missing_verification_command",
      ticket: ticketFile,
      ticket_id: ticketId,
      board_root: boardRoot,
      project_root: projectRoot,
    });
    return;
  }

  const result = spawnSync(verificationCommand, {
    cwd: workingRoot,
    env: {
      ...process.env,
      AUTOFLOW_BOARD_ROOT: boardRoot,
      AUTOFLOW_PROJECT_ROOT: projectRoot,
      BOARD_ROOT: boardRoot,
      PROJECT_ROOT: projectRoot,
    },
    shell: true,
    encoding: "utf8",
  });
  const exitCode = typeof result.status === "number" ? result.status : 1;
  const finishedAt = nowIso();
  const passed = exitCode === 0;
  const resultLine = passed ? "passed" : "failed";
  const output = formatOutput(`${result.stdout || ""}${result.stderr || ""}`, exitCode);

  replaceSection(ticketFile, "Verification", `- Command: \`${verificationCommand}\`
- Working Root: \`${workingRoot}\`
- Result: ${resultLine} by ${workerId} at ${finishedAt}
- Exit Code: ${exitCode}
- Started At: ${startedAt}${output ? `\n- Output:\n\`\`\`\n${output}\n\`\`\`` : ""}`);
  replaceScalar(ticketFile, "Ticket", "Last Updated", finishedAt);
  appendNote(ticketFile, `Worker verification ${resultLine} by ${workerId} at ${finishedAt}: command exited ${exitCode}`);

  printPairs({
    status: passed ? "pass" : "fail",
    ticket: ticketFile,
    ticket_id: ticketId,
    working_root: workingRoot,
    command: verificationCommand,
    exit_code: String(exitCode),
    board_root: boardRoot,
    project_root: projectRoot,
    next_action: passed
      ? `Worker must inspect this local verification evidence, then call autoflow tool runner-tool worker submit-to-verifier --ticket ${ticketId} --summary "<short summary>" to hand off to verifier before any PROJECT_ROOT merge.`
      : `Fix inside scope in the same worktree and rerun verification. If the ticket itself must be replaced, record Recovery State evidence and use the verifier/replan path; do not merge or finalize this failed result.`,
  });
}

main();
