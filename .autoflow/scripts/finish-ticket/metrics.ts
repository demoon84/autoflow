import {fs, path, boardRoot, projectRoot, scriptDir, timestamp, workerId} from "./context";
import {appendNote, scalar} from "./ticket-sections";
import {boardRel, oneLine, parseJsonObject} from "./io";
import {spawnOutputText, spawnTsScript} from "./git";

export function recordCodeMetricsWithRunnerTool(ticketFile: string, ticketId: string): { status: string; stdout: string; stderr: string } {
  const tool = path.join(scriptDir, "runner-tool.ts");
  if (!fs.existsSync(tool)) {
    return { status: "missing_runner_tool", stdout: "", stderr: "" };
  }
  const runner = codeMetricRunnerId(ticketFile);
  const result = spawnTsScript(tool, ["worker", "code-report", "--ticket", boardRel(ticketFile), "--runner", runner], {
    ...process.env,
    PROJECT_ROOT: projectRoot,
    AUTOFLOW_PROJECT_ROOT: projectRoot,
    BOARD_ROOT: boardRoot,
    AUTOFLOW_BOARD_ROOT: boardRoot,
    AUTOFLOW_ROLE: "worker",
    AUTOFLOW_RUNNER_ID: runner,
    RUNNER_ID: runner,
  });
  const status = typeof result.status === "number" ? result.status : 1;
  const stdout = spawnOutputText(result.stdout);
  const stderr = spawnOutputText(result.stderr);
  if (status === 0) {
    const parsed = parseJsonObject(stdout);
    if (String(parsed.counted || "") === "true" || parsed.counted === true) {
      appendNote(ticketFile, `Code metrics recorded at ${timestamp}: runner=${runner} files=${parsed.code_files_changed_count ?? 0} +${parsed.code_insertions_count ?? 0}/-${parsed.code_deletions_count ?? 0} volume=${parsed.code_volume_count ?? 0}.`);
    }
  } else {
    appendNote(ticketFile, `Code metrics report skipped at ${timestamp}: runner-tool exit_${status}; ${oneLine(stderr || stdout)}`);
  }
  return {
    status: status === 0 ? "ok" : `exit_${status}`,
    stdout,
    stderr,
  };
}

export function codeMetricRunnerId(ticketFile: string): string {
  const candidate = scalar(ticketFile, "Ticket", "Execution AI") || scalar(ticketFile, "Ticket", "Claimed By");
  if (candidate && !/^verifier(?:-\d+)?$/i.test(candidate)) return candidate;
  if (workerId && !/^verifier(?:-\d+)?$/i.test(workerId)) return workerId;
  return "worker";
}
