import * as shared from "../shared";
const {fs, path, spawnSync, crypto, CLI_DIR, REPO_ROOT, out, err, fail, shellQuoteStrip, packageVersion, oneLine, defaultBoardDirName, resolveProjectRoot, boardRootPath, projectContext, ensureBoard, ensureDir, writeFile, writeFileAtomic, copyTree, walkMarkdownFiles, readSingleLine, cleanupObsoleteBoardFiles, legacyWorkerTermReplacements, isTextMigrationTarget, migrateWorkerTerminology, parseArgs, firstFlag, allFlags, hasFlag, readStdin, readRequestText, listMarkdownIds, nextNumericId, requiredTsxCli, runNodeOrTsScript, boardScriptPath, runBoardScript, countFiles, countTicketDirs, countTopLevelMarkdown, fileContainsTicketStage, countTicketStage, gitRun, realPathSafe, samePath, gitState, appendGitignorePatterns, boardGitignorePattern, ensureInstallGitignore, ensureGitBaseline, runnerConfigFieldOrder, runnerStringFieldDefaults, runnerConfigBasePath, runnerConfigLocalPath, runnerConfigPath, runnerConfigWritePath, stripTomlInlineComment, parseTomlScalar, parseRunnerConfig, readRunnerState, runnerTokenStateDefaults, serializeRunnerState, writeRunnerState, pidIsRunning, intState, runnerOwnsCodeMetrics, codeMetricTotals, runnerEffectiveStateStatus, runnerConfigFingerprint, formatTomlValue, serializeRunnerConfig, writeRunnerConfig, runnerUpdateEntries, outputRunner} = shared;

export function usage(): void {
    out(`Autoflow CLI

Usage:
  autoflow tool list [project-root] [board-dir-name]
  autoflow init [project-root] [board-dir-name]
  autoflow upgrade [project-root] [board-dir-name]
  autoflow order create [project-root] [board-dir-name] [--title text] [--request text] [--allowed-path path]... [--verification command]
  autoflow prd create [project-root] [board-dir-name] [--title text] [--goal text] [--from-file path]
  autoflow run <planner|ticket|worker|verifier|wiki|todo|self-improve> [project-root] [board-dir-name]
  autoflow wiki <update|query|lint> [project-root] [board-dir-name]
  autoflow runners <list|start|stop|restart|artifacts|set|add|remove> ...
  autoflow metrics [project-root] [board-dir-name]
  autoflow status [project-root] [board-dir-name]
  autoflow doctor [--fix] [project-root] [board-dir-name]
  autoflow origin <status|list|search|of-ticket|of-commit|sync> [args...]
  autoflow help`);
}
