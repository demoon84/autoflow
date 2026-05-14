import * as shared from "../shared";
const {fs, path, spawnSync, crypto, CLI_DIR, REPO_ROOT, out, err, fail, shellQuoteStrip, packageVersion, oneLine, defaultBoardDirName, resolveProjectRoot, boardRootPath, projectContext, ensureBoard, ensureDir, writeFile, writeFileAtomic, copyTree, walkMarkdownFiles, readSingleLine, cleanupObsoleteBoardFiles, legacyWorkerTermReplacements, isTextMigrationTarget, migrateWorkerTerminology, parseArgs, firstFlag, allFlags, hasFlag, readStdin, readRequestText, listMarkdownIds, nextNumericId, requiredTsxCli, runNodeOrTsScript, boardScriptPath, runBoardScript, countFiles, countTicketDirs, countTopLevelMarkdown, fileContainsTicketStage, countTicketStage, gitRun, realPathSafe, samePath, gitState, appendGitignorePatterns, boardGitignorePattern, ensureInstallGitignore, ensureGitBaseline, runnerConfigFieldOrder, runnerStringFieldDefaults, runnerConfigBasePath, runnerConfigLocalPath, runnerConfigPath, runnerConfigWritePath, stripTomlInlineComment, parseTomlScalar, parseRunnerConfig, readRunnerState, runnerTokenStateDefaults, serializeRunnerState, writeRunnerState, pidIsRunning, intState, runnerOwnsCodeMetrics, codeMetricTotals, runnerEffectiveStateStatus, runnerConfigFingerprint, formatTomlValue, serializeRunnerConfig, writeRunnerConfig, runnerUpdateEntries, outputRunner} = shared;
import {telemetryProject} from "./telemetry";

export function wikiProject(args: string[]): never | void {
    const subcmd = args.shift() || "query";
    const parsed = parseArgs(args);
    const ctx = projectContext(parsed.positionals[0] || ".", parsed.positionals[1] || defaultBoardDirName());
    switch (subcmd) {
        case "update":
            runBoardScript(ctx, "update-wiki.ts", args.slice(2));
            break;
        case "query": {
            ensureBoard(ctx);
            const terms = allFlags(parsed, "term").map((term) => term.toLowerCase()).filter(Boolean);
            const limit = Number.parseInt(firstFlag(parsed, "limit") || "10", 10) || 10;
            const candidates = [
                ...walkMarkdownFiles(path.join(ctx.boardRoot, "wiki")),
                ...(hasFlag(parsed, "no-tickets") ? [] : walkMarkdownFiles(path.join(ctx.boardRoot, "tickets", "done"))),
            ];
            const matches: Array<{file: string; score: number; line: string}> = [];
            for (const file of candidates) {
                const text = fs.readFileSync(file, "utf8");
                const lower = text.toLowerCase();
                if (terms.length > 0 && !terms.every((term) => lower.includes(term))) {
                    continue;
                }
                const firstLine = text.split(/\r?\n/).find((line) => line.trim()) || "";
                const score = terms.reduce((sum, term) => sum + (lower.split(term).length - 1), 0);
                matches.push({file, score, line: firstLine.trim()});
            }
            matches.sort((a, b) => b.score - a.score || a.file.localeCompare(b.file));
            out("status=ok");
            out(hasFlag(parsed, "rag") ? "rag_backend=chunk_grep" : "query_backend=markdown_scan");
            out(`result_count=${Math.min(matches.length, limit)}`);
            matches.slice(0, limit).forEach((match, index) => {
                out(`match.${index + 1}.path=${path.relative(ctx.boardRoot, match.file)}`);
                out(`match.${index + 1}.score=${match.score}`);
                out(`match.${index + 1}.title=${match.line}`);
            });
            break;
        }
        case "lint":
            out("status=ok");
            out("semantic_lint=skipped");
            out(`project_root=${ctx.projectRoot}`);
            out(`board_root=${ctx.boardRoot}`);
            break;
        case "ingest":
            out("status=ok");
            out("ingest_status=skipped");
            out(`project_root=${ctx.projectRoot}`);
            out(`board_root=${ctx.boardRoot}`);
            break;
        case "summarize-telemetry":
            telemetryProject([ctx.projectRoot, ctx.boardDirName, "token-usage"]);
            break;
        default:
            fail(`Unknown wiki command: ${subcmd}`);
    }
}
