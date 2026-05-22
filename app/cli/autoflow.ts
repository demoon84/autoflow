#!/usr/bin/env npx tsx

import {fail} from "./shared";
import {usage} from "./system/usage";
import {printToolCatalog} from "./system/tool-catalog";
import {runRuntimeTool} from "./system/tool-run";
import {installBoard} from "./system/install-board";
import {installCli} from "./system/install-cli";
import {stopHookProject} from "./system/stop-hook";
import {watchProject} from "./system/watch";
import {specProject} from "./runners/planner/spec";
import {todoProject} from "./runners/planner/todo";
import {runRole} from "./system/run-role";
import {wikiProject} from "./runners/wiki/wiki";
import {runnersProject} from "./system/runners";
import {metricsProject} from "./system/metrics";
import {statusProject} from "./system/status";
import {guardProject} from "./system/guard";
import {originProject} from "./system/origin";
import {telemetryProject} from "./system/telemetry";

function runAutoflow(argv: string[]): void {
    const cmd = argv.shift() || "help";
    switch (cmd) {
        case "tool": {
            const subcmd = argv.shift() || "";
            if (!subcmd) {
                fail("Usage: autoflow tool <name> [args...] | autoflow tool list");
            }
            if (subcmd === "list") {
                printToolCatalog(argv);
            } else {
                runRuntimeTool(subcmd, argv);
            }
            break;
        }
        case "init":
            installBoard(argv, "init");
            break;
        case "upgrade":
            installBoard(argv, "upgrade");
            break;
        case "install-cli":
            installCli(argv);
            break;
        case "install-stop-hook":
            stopHookProject(["install", ...argv]);
            break;
        case "remove-stop-hook":
            stopHookProject(["remove", ...argv]);
            break;
        case "stop-hook-status":
            stopHookProject(["status", ...argv]);
            break;
        case "watch":
            watchProject(argv);
            break;
        case "watch-bg":
            watchProject(["--background", ...argv]);
            break;
        case "watch-status":
            watchProject(["--status", ...argv]);
            break;
        case "watch-stop":
            watchProject(["--stop", ...argv]);
            break;
        case "prd":
        case "spec":
            specProject(argv);
            break;
        case "todo":
            todoProject(argv);
            break;
        case "run":
            runRole(argv);
            break;
        case "wiki":
            wikiProject(argv);
            break;
        case "runners":
            runnersProject(argv);
            break;
        case "metrics":
            metricsProject(argv);
            break;
        case "status":
            statusProject(argv);
            break;
        case "guard":
            guardProject(argv);
            break;
        case "origin":
            originProject(argv);
            break;
        case "telemetry":
            telemetryProject(argv);
            break;
        case "help":
        case "-h":
        case "--help":
            usage();
            break;
        default:
            fail(`Unknown command: ${cmd}`);
    }
}

runAutoflow(process.argv.slice(2));
