import { fail } from "../../../shared/runner-tool";
import { cmdVerifierQueueSnapshot } from "./queue-snapshot";
import { cmdVerifierEvidence } from "./evidence";
import { cmdVerifierDecisionRecord } from "./decision-record";
import { cmdVerifierComplete } from "./finish";
import { cmdVerifierWake } from "./wake";

export function dispatchVerifier(command: string): void {
  switch (command) {
    case "queue-snapshot":
      cmdVerifierQueueSnapshot();
      return;
    case "evidence":
      cmdVerifierEvidence();
      return;
    case "decision-record":
      cmdVerifierDecisionRecord();
      return;
    case "approve-merge":
      cmdVerifierComplete("pass");
      return;
    case "request-revision":
      cmdVerifierComplete("revise");
      return;
    case "request-replan":
      cmdVerifierComplete("replan");
      return;
    case "wake":
      cmdVerifierWake();
      return;
    default:
      fail(2, `unknown verifier command: ${command}`);
  }
}
