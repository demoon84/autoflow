import { args, fail, hasFlag } from "./shared";
import { usage } from "./usage";
import { dispatchPlanner } from "./planner";
import { dispatchWorker } from "./worker";
import { dispatchVerifier } from "./verifier";
import { dispatchWiki } from "./wiki";

export function main(): void {
  if (args.length === 0 || hasFlag("-h") || hasFlag("--help")) {
    usage();
    process.exit(0);
  }

  const runner = args.shift();
  const command = args.shift();
  if (!command) fail(2, `missing ${runner || "runner"} command`);

  switch (runner) {
    case "planner":
      dispatchPlanner(command);
      return;
    case "worker":
      dispatchWorker(command);
      return;
    case "verifier":
      dispatchVerifier(command);
      return;
    case "wiki":
      dispatchWiki(command);
      return;
    default:
      fail(2, `unknown runner tool group: ${runner || ""}`);
  }
}
