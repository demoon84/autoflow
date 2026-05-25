#!/usr/bin/env tsx
/*
 * Runtime runner-tool dispatcher for LLM-called runner tools.
 *
 * Command implementations live under ./<role>/tools/<command>.ts so
 * each file owns one narrow feature while this file preserves the installed contract.
 */

import {args, fail, hasFlag} from "../shared/runner-tool";
import {usage} from "../shared/runner-tool/usage";
import {dispatchPlanner} from "./planner/tools";
import {dispatchWorker} from "./worker/tools";
import {dispatchVerifier} from "./verifier/tools";
import {dispatchWiki} from "./wiki/tools";

function main(): void {
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

main();
