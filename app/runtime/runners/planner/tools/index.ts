import { fail } from "../../../shared/runner-tool";
import { cmdPlannerQueueSnapshot } from "./queue-snapshot";
import { cmdPlannerReserveId } from "./reserve-id";
import { cmdPlannerWritePrd } from "./write-prd";
import { cmdPlannerWriteTicket } from "./write-ticket";
import { cmdPlannerItemArchive } from "./item-archive";
import { cmdPlannerGuard } from "./guard";

export function dispatchPlanner(command: string): void {
  switch (command) {
    case "queue-snapshot":
      cmdPlannerQueueSnapshot();
      return;
    case "reserve-id":
      cmdPlannerReserveId();
      return;
    case "write-prd":
      cmdPlannerWritePrd();
      return;
    case "write-ticket":
      cmdPlannerWriteTicket();
      return;
    case "item-archive":
      cmdPlannerItemArchive();
      return;
    case "guard":
      cmdPlannerGuard();
      return;
    default:
      fail(2, `unknown planner command: ${command}`);
  }
}
