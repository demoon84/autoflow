import {path, REPO_ROOT, fail, runNodeOrTsScript} from "./shared";
import {usage} from "./commands/usage";
import {printToolCatalog} from "./commands/tool-catalog";
import {scaffoldProject} from "./commands/scaffold";
import {stopHookProject} from "./commands/stop-hook";
import {watchProject} from "./commands/watch";
import {specProject} from "./commands/spec";
import {orderProject} from "./commands/order";
import {runRole} from "./commands/run-role";
import {wikiProject} from "./commands/wiki";
import {runnersProject} from "./commands/runners";
import {metricsProject} from "./commands/metrics";
import {statusProject} from "./commands/status";
import {doctorProject} from "./commands/doctor";
import {originProject} from "./commands/origin";
import {cleanupRunnerLogs} from "./commands/cleanup-runner-logs";
import {renderHeartbeats} from "./commands/render-heartbeats";
import {coordinatorProject} from "./commands/coordinator";
import {telemetryProject} from "./commands/telemetry";
import {packageBoardCommon} from "./commands/package-board-common";

export function runPackageCommand(command: string, argv: string[]): void {
    switch (command) {
        case "scaffold-project":
            scaffoldProject(argv, "init");
            break;
        case "upgrade-project":
            scaffoldProject(argv, "upgrade");
            break;
        case "stop-hook-project":
            stopHookProject(argv);
            break;
        case "watch-project":
            watchProject(argv);
            break;
        case "spec-project":
            specProject([...argv]);
            break;
        case "order-project":
            orderProject([...argv]);
            break;
        case "run-role":
            runRole([...argv]);
            break;
        case "wiki-project":
            wikiProject([...argv]);
            break;
        case "runners-project":
            runnersProject([...argv]);
            break;
        case "metrics-project":
            metricsProject(argv);
            break;
        case "status-project":
            statusProject(argv);
            break;
        case "doctor-project":
            doctorProject(argv);
            break;
        case "origin-project":
            originProject(argv);
            break;
        case "cleanup-runner-logs":
            cleanupRunnerLogs(argv);
            break;
        case "render-heartbeats":
            renderHeartbeats(argv);
            break;
        case "coordinator-project":
            coordinatorProject(argv);
            break;
        case "telemetry-project":
            telemetryProject(argv);
            break;
        case "package-board-common":
        case "cli-common":
            packageBoardCommon(argv);
            break;
        default:
            fail(`Unknown package command: ${command}`);
    }
}

export function runAutoflow(argv: string[]): void {
    const cmd = argv.shift() || "help";
    switch (cmd) {
        case "tool": {
            const subcmd = argv.shift() || "";
            if (subcmd !== "list") {
                fail(`Unknown tool command: ${subcmd}`);
            }
            printToolCatalog(argv);
            break;
        }
        case "init":
            runPackageCommand("scaffold-project", argv);
            break;
        case "upgrade":
            runPackageCommand("upgrade-project", argv);
            break;
        case "install-stop-hook":
            runPackageCommand("stop-hook-project", ["install", ...argv]);
            break;
        case "remove-stop-hook":
            runPackageCommand("stop-hook-project", ["remove", ...argv]);
            break;
        case "stop-hook-status":
            runPackageCommand("stop-hook-project", ["status", ...argv]);
            break;
        case "watch":
            runPackageCommand("watch-project", argv);
            break;
        case "watch-bg":
            runPackageCommand("watch-project", ["--background", ...argv]);
            break;
        case "watch-status":
            runPackageCommand("watch-project", ["--status", ...argv]);
            break;
        case "watch-stop":
            runPackageCommand("watch-project", ["--stop", ...argv]);
            break;
        case "prd":
        case "spec":
            runPackageCommand("spec-project", argv);
            break;
        case "order":
            runPackageCommand("order-project", argv);
            break;
        case "run":
            runPackageCommand("run-role", argv);
            break;
        case "wiki":
            runPackageCommand("wiki-project", argv);
            break;
        case "monitor":
            runPackageCommand("run-role", ["monitor", ...argv]);
            break;
        case "runners":
            runPackageCommand("runners-project", argv);
            break;
        case "metrics":
            runPackageCommand("metrics-project", argv);
            break;
        case "status":
            runPackageCommand("status-project", argv);
            break;
        case "guard":
            runNodeOrTsScript(path.join(REPO_ROOT, "packages", "cli", "guard-project.ts"), argv);
            break;
        case "render-heartbeats":
            runPackageCommand("render-heartbeats", argv);
            break;
        case "doctor":
            runPackageCommand("doctor-project", argv);
            break;
        case "origin":
            runPackageCommand("origin-project", argv);
            break;
        case "cleanup-runner-logs":
            runPackageCommand("cleanup-runner-logs", argv);
            break;
        case "telemetry":
            runPackageCommand("telemetry-project", argv);
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

export {defaultBoardDirName} from "./shared";
