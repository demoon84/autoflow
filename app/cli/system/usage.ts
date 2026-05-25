import * as shared from "../shared";
const {fs, path, spawnSync, crypto, CLI_DIR, REPO_ROOT, out, err, fail, shellQuoteStrip, packageVersion, oneLine, defaultBoardDirName, resolveProjectRoot, boardRootPath, projectContext, ensureBoard, ensureDir, writeFile, writeFileAtomic, copyTree, walkMarkdownFiles, readSingleLine, cleanupObsoleteBoardFiles, legacyWorkerTermReplacements, isTextMigrationTarget, migrateWorkerTerminology, parseArgs, firstFlag, allFlags, hasFlag, readStdin, readRequestText, listMarkdownIds, nextNumericId, requiredTsxCli, runNodeOrTsScript, runtimeScriptPath, runRuntimeScript, countFiles, countTicketDirs, countTopLevelMarkdown, fileContainsTicketStage, countTicketStage, gitRun, realPathSafe, samePath, gitState, appendGitignorePatterns, boardGitignorePattern, ensureInstallGitignore, ensureGitBaseline, runnerConfigFieldOrder, runnerStringFieldDefaults, runnerConfigBasePath, runnerConfigLocalPath, runnerConfigPath, runnerConfigWritePath, stripTomlInlineComment, parseTomlScalar, parseRunnerConfig, readRunnerState, runnerTokenStateDefaults, serializeRunnerState, writeRunnerState, pidIsRunning, intState, runnerOwnsCodeMetrics, codeMetricTotals, runnerEffectiveStateStatus, runnerConfigFingerprint, formatTomlValue, serializeRunnerConfig, writeRunnerConfig, runnerUpdateEntries, outputRunner} = shared;

export function usage(): void {
    out(`Autoflow CLI

Usage:
  autoflow tool list [project-root] [board-dir-name]
  autoflow init [project-root] [board-dir-name] [--refresh-host-guidance]
  autoflow upgrade [project-root] [board-dir-name] [--refresh-host-guidance]
  autoflow dev-link [core-root] [--name dev] [--share-root <dir>] [--no-active]
  autoflow prd create [project-root] [board-dir-name] [--title text] [--goal text] [--from-file path] [--save-handoff]
  autoflow run <planner|worker|verifier|wiki> [project-root] [board-dir-name]
  autoflow wiki <update|query|ingest|lint|summarize-telemetry> [project-root] [board-dir-name]
  autoflow runners <list|start|stop|restart|artifacts|set|add|remove> ...
  autoflow metrics [project-root] [board-dir-name]
  autoflow status [project-root] [board-dir-name]
  autoflow origin <status|list|search|of-ticket|of-commit|sync> [args...]
  autoflow tool assignment <create|current|list|verify|start|complete|release> ...
  autoflow help`);
}
