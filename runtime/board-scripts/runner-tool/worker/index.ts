import { fail } from "../shared";
import { cmdWorkerActiveGet } from "./active-get";
import { cmdWorkerTodoSnapshot } from "./todo-snapshot";
import { cmdWorkerClaim } from "./claim";
import { cmdWorkerWorktreeStatus } from "./worktree-status";
import { cmdWorkerWorktreeEnsure } from "./worktree-ensure";
import { cmdWorkerStageSet } from "./stage-set";
import { cmdWorkerContextUpdate } from "./context-update";
import { cmdWorkerVerificationRecord } from "./verification-record";
import { cmdWorkerDoneWhenCheck } from "./done-when-check";
import { cmdWorkerDiffCheck } from "./diff-check";
import { cmdWorkerCodeReport } from "./code-report";
import { cmdWorkerComplete } from "./finish";

export function dispatchWorker(command: string): void {
  switch (command) {
    case "active-get":
      cmdWorkerActiveGet();
      return;
    case "todo-snapshot":
      cmdWorkerTodoSnapshot();
      return;
    case "claim":
      cmdWorkerClaim();
      return;
    case "worktree-status":
      cmdWorkerWorktreeStatus();
      return;
    case "worktree-ensure":
      cmdWorkerWorktreeEnsure();
      return;
    case "stage-set":
      cmdWorkerStageSet();
      return;
    case "context-update":
      cmdWorkerContextUpdate();
      return;
    case "verification-record":
      cmdWorkerVerificationRecord();
      return;
    case "done-when-check":
      cmdWorkerDoneWhenCheck();
      return;
    case "diff-check":
      cmdWorkerDiffCheck();
      return;
    case "code-report":
      cmdWorkerCodeReport();
      return;
    case "submit-to-verifier":
      cmdWorkerComplete("submit-to-verifier");
      return;
    case "finalize-approved":
      cmdWorkerComplete("finalize-approved");
      return;
    case "create-retry-order":
      cmdWorkerComplete("create-retry-order");
      return;
    default:
      fail(2, `unknown worker command: ${command}`);
  }
}
