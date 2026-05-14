import {boardRoot, projectRoot, requestedTicket, runnerId} from "./context";
import {asArray, asObject, oneLine, printPairs} from "./io";
import {tool} from "./tool";
import {findTicket, ticketItemFromPath} from "./ticket";
import {emitActiveTicket, emitTodoCandidate, emitIdle} from "./emit";

export function main(): void {
  try {
    const active = tool("worker", "active-get", "--runner", runnerId);
    const owned = asArray(active.owned);
    if (owned.length > 0) {
      emitActiveTicket(owned[0], "active");
      return;
    }

    if (requestedTicket) {
      const requested = findTicket(requestedTicket);
      if (!requested) {
        emitIdle("requested_ticket_not_found", requestedTicket);
        process.exit(1);
      }
      if (requested.state === "todo") {
        emitTodoCandidate(ticketItemFromPath(requested.path), "requested");
        return;
      }
      emitActiveTicket(ticketItemFromPath(requested.path), requested.state);
      return;
    }

    const snapshot = tool("worker", "todo-snapshot", "--runner", runnerId);
    const todos = asArray(snapshot.todos);
    const claimable = todos.find((item) => Boolean(asObject(item).claimable));
    if (!claimable) {
      const blocked = todos.find((item) => String(asObject(item).blocked_reason || "") !== "");
      if (blocked) {
        const blockedObj = asObject(blocked);
        emitIdle(String(blockedObj.blocked_reason || "ticket_blocked"), String(blockedObj.path || ""));
        return;
      }
      emitIdle("no_actionable_ticket", "");
      return;
    }

    emitTodoCandidate(claimable, "todo");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    printPairs({
      status: "error",
      runner: runnerId,
      reason: oneLine(message),
      board_root: boardRoot,
      project_root: projectRoot,
    });
    process.exit(1);
  }
}

main();
