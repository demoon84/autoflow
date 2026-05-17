import {BOARD_ROOT, PROJECT_ROOT, workerId} from "./context";
import {emit} from "./output";
import {ensureExpectedRole, setThreadContextRecord, workerRole} from "./role";
import {boardRelativePath, extractNumericId} from "./ids";
import {migrateLegacyQueueDirs} from "./files";
import {selectRetryOrder, selectNonretryOrder} from "./orders";
import {createGeneratedPrdFromOrder} from "./order-to-prd";
import {selectOrderGeneratedSpec, promoteSpecToTodoOrExit, selectPopulatedSpec, choosePolicyPick, selectLegacyPlan} from "./specs";

export function main(): void {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    process.stdout.write(
      "autoflow run planner - Autoflow planner runner.\n" +
        "Usage: autoflow run planner [project-root] [board-dir-name] [id]\n" +
        "Sources: prd-to-todo | order-to-prd | order-retry | order | legacy-plan | idle\n"
    );
    return;
  }

  ensureExpectedRole("plan");
  migrateLegacyQueueDirs();
  setThreadContextRecord("plan", workerId, "", "", "");

  const orderGeneratedSpec = selectOrderGeneratedSpec();
  if (orderGeneratedSpec) promoteSpecToTodoOrExit(orderGeneratedSpec);

  const retryOrder = selectRetryOrder();
  if (retryOrder) {
    emit({
      status: "ok",
      source: "order-retry",
      order: retryOrder,
      order_id: extractNumericId(retryOrder),
      board_root: BOARD_ROOT,
      project_root: PROJECT_ROOT,
      next_action: `Promote retry order ${boardRelativePath(retryOrder)} per plan-to-ticket-agent.md, then rerun start-plan.`,
    });
    return;
  }

  const nonretryOrder = selectNonretryOrder();
  const spec = selectPopulatedSpec();
  const policyPick = choosePolicyPick(nonretryOrder, spec);

  if (policyPick === "spec" && spec) promoteSpecToTodoOrExit(spec);

  if (policyPick === "order" && nonretryOrder) {
    const generated = createGeneratedPrdFromOrder(nonretryOrder);
    promoteSpecToTodoOrExit(generated.specFile);
  }

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
