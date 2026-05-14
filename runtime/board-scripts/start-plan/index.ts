import {path, BOARD_ROOT, PROJECT_ROOT, workerId} from "./context";
import {emit} from "./output";
import {ensureExpectedRole, setThreadContextRecord, workerRole} from "./role";
import {boardRelativePath, extractNumericId} from "./ids";
import {migrateLegacyQueueDirs} from "./files";
import {selectExpressOrder, createExpressTodoFromOrder, selectRetryOrder, selectNonretryOrder} from "./orders";
import {selectOrderGeneratedSpec, promoteSpecToTodoOrExit, selectPopulatedSpec, choosePolicyPick, selectLegacyPlan} from "./specs";

export function main(): void {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    process.stdout.write(
      "start-plan.ts - Autoflow Planner AI runner.\n" +
        "Usage: npx tsx start-plan.ts [id]\n" +
        "Sources: express-order-to-todo | prd-to-todo | order-retry | order | legacy-plan | idle\n"
    );
    return;
  }

  ensureExpectedRole("plan");
  migrateLegacyQueueDirs();
  setThreadContextRecord("plan", workerId, "", "", "");

  const expressOrder = selectExpressOrder();
  if (expressOrder) {
    const ticket = createExpressTodoFromOrder(expressOrder);
    if (ticket) {
      const orderId = extractNumericId(expressOrder);
      emit({
        status: "ok",
        source: "express-order-to-todo",
        order: `tickets/done/express_${orderId}/${path.basename(expressOrder)}`,
        todo_ticket: ticket,
        project_key: `express_${orderId}`,
        path: "express",
        board_root: BOARD_ROOT,
        project_root: PROJECT_ROOT,
        next_action: `Express ticket ${path.basename(ticket)} ready for worker; PRD authoring skipped.`,
      });
      return;
    }
  }

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
    emit({
      status: "ok",
      source: "order",
      order: nonretryOrder,
      order_id: extractNumericId(nonretryOrder),
      board_root: BOARD_ROOT,
      project_root: PROJECT_ROOT,
      next_action: `Promote order ${boardRelativePath(nonretryOrder)} per plan-to-ticket-agent.md, then rerun start-plan.`,
    });
    return;
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
