import {BOARD_ROOT, PROJECT_ROOT, workerId} from "./context";
import {emit} from "./output";
import {ensureExpectedRole, setThreadContextRecord, workerRole} from "./role";
import {migrateLegacyQueueDirs} from "./files";
import {promoteSpecToTodoOrExit, selectPopulatedSpec, selectLegacyPlan} from "./specs";

export function main(): void {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    process.stdout.write(
      "autoflow run planner - Autoflow planner runner.\n" +
        "Usage: autoflow run planner [project-root] [board-dir-name] [id]\n" +
        "Sources: prd-to-todo | legacy-plan | idle\n"
    );
    return;
  }

  ensureExpectedRole("plan");
  migrateLegacyQueueDirs();
  setThreadContextRecord("plan", workerId, "", "", "");

  const spec = selectPopulatedSpec();
  if (spec) promoteSpecToTodoOrExit(spec);

  const legacyPlan = selectLegacyPlan();
  if (legacyPlan) {
    emit({
      status: "ok",
      source: "legacy-plan",
      plan: legacyPlan,
      board_root: BOARD_ROOT,
      project_root: PROJECT_ROOT,
      next_action: `Convert unticketed candidates from legacy plan ${legacyPlan}.`,
    });
    return;
  }

  emit({
    status: "idle",
    reason: "no_actionable_plan_input",
    board_root: BOARD_ROOT,
    project_root: PROJECT_ROOT,
    worker_role: workerRole(),
  });
}

main();
