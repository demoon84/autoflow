[CmdletBinding()]
param(
  [Parameter(Position = 0)]
  [string]$ProjectRoot = ".",

  [Parameter(Position = 1)]
  [string]$BoardDirName = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "cli-common.ps1")
. (Join-Path (Get-RuntimeScriptsRoot) "runner-common.ps1")

if (-not $BoardDirName) {
  $BoardDirName = Get-DefaultBoardDirName
}

function Test-WindowsPlatform {
  return $env:OS -eq "Windows_NT"
}

function Test-ExecutableBit {
  param([string]$Path)

  if (Test-WindowsPlatform) {
    return $true
  }

  $bash = Get-Command -Name bash -ErrorAction SilentlyContinue
  if (-not $bash) {
    return $true
  }

  $escapedPath = $Path.Replace("'", "'\''")
  & $bash.Source -lc "[ -x '$escapedPath' ]"
  return $LASTEXITCODE -eq 0
}

$resolvedProjectRoot = Resolve-ProjectRootOrThrow $ProjectRoot
$boardRoot = Get-BoardRootPath -ProjectRoot $resolvedProjectRoot -BoardDirName $BoardDirName
$packageVersion = Get-PackageVersionValue

$script:errorCount = 0
$script:warningCount = 0
$checkLines = New-Object System.Collections.Generic.List[string]
$detailLines = New-Object System.Collections.Generic.List[string]

function Add-Check {
  param([string]$Id, [string]$Result)

  [void]$checkLines.Add(("check.{0}={1}" -f $Id, $Result))
}

function Add-ErrorLine {
  param([string]$Message)

  $script:errorCount += 1
  [void]$detailLines.Add(("error.{0}={1}" -f $script:errorCount, $Message))
}

function Add-WarningLine {
  param([string]$Message)

  $script:warningCount += 1
  [void]$detailLines.Add(("warning.{0}={1}" -f $script:warningCount, $Message))
}

function ConvertTo-CheckIdFragment {
  param([string]$Value)

  return ($Value -replace "[^A-Za-z0-9_]", "_")
}

function Add-RunnerAdapterCheck {
  param(
    [Parameter(Mandatory = $true)][object]$Runner
  )

  $runnerId = [string]$Runner.id
  $role = [string]$Runner.role
  $agent = [string]$Runner.agent
  $mode = [string]$Runner.mode
  $enabled = [string]$Runner.enabled
  $commandValue = [string]$Runner.command
  $intervalSeconds = [string]$Runner.interval_seconds
  $checkId = "runner_{0}" -f (ConvertTo-CheckIdFragment $runnerId)

  if ([string]::IsNullOrWhiteSpace($agent)) {
    $agent = "manual"
  }
  if ([string]::IsNullOrWhiteSpace($mode)) {
    $mode = "one-shot"
  }
  if ([string]::IsNullOrWhiteSpace($enabled)) {
    $enabled = "true"
  }
  if ([string]::IsNullOrWhiteSpace($intervalSeconds)) {
    $intervalSeconds = "60"
  }

  Add-Check "${checkId}_defined" "ok"
  [void]$checkLines.Add(("runner.{0}.role={1}" -f $checkId, $role))
  [void]$checkLines.Add(("runner.{0}.agent={1}" -f $checkId, $agent))
  [void]$checkLines.Add(("runner.{0}.interval_seconds={1}" -f $checkId, $intervalSeconds))

  if ($role -in @("ticket-owner", "owner", "planner", "todo", "verifier", "wiki-maintainer", "coordinator", "doctor", "watcher")) {
    Add-Check "${checkId}_role" "ok"
  }
  else {
    Add-Check "${checkId}_role" "warning"
    Add-WarningLine "runner $runnerId has unsupported role=$role; expected ticket-owner, planner, todo, verifier, wiki-maintainer, coordinator, doctor, or watcher"
  }

  if ($enabled -in @("true", "false")) {
    Add-Check "${checkId}_enabled" "ok"
  }
  else {
    Add-Check "${checkId}_enabled" "warning"
    Add-WarningLine "runner $runnerId has invalid enabled=$enabled; expected true or false"
  }

  if ($enabled -ne "true") {
    Add-Check "${checkId}_adapter" "disabled"
    Add-Check "${checkId}_interval" "disabled"
    return
  }

  switch ($mode) {
    { $_ -in @("one-shot", "loop") } {
      Add-Check "${checkId}_mode" "ok"
      break
    }
    "watch" {
      Add-Check "${checkId}_mode" "warning"
      Add-WarningLine "runner $runnerId uses mode=watch; use the file watcher controls until watcher runners are implemented"
      break
    }
    default {
      Add-Check "${checkId}_mode" "warning"
      Add-WarningLine "runner $runnerId uses unsupported mode=$mode; expected one-shot, loop, or watch"
    }
  }

  if ($mode -eq "loop") {
    $intervalValue = 0
    if (-not [int]::TryParse($intervalSeconds, [ref]$intervalValue) -or $intervalValue -lt 1 -or $intervalValue -gt 86400) {
      Add-Check "${checkId}_interval" "warning"
      Add-WarningLine "runner $runnerId has invalid interval_seconds=$intervalSeconds; expected an integer between 1 and 86400"
    }
    else {
      Add-Check "${checkId}_interval" "ok"
    }
  }
  else {
    Add-Check "${checkId}_interval" "not_applicable"
  }

  switch ($agent) {
    { $_ -in @("shell", "manual") } {
      Add-Check "${checkId}_adapter" "ok"
      break
    }
    { $_ -in @("codex", "claude", "opencode", "gemini") } {
      if (-not [string]::IsNullOrWhiteSpace($commandValue)) {
        Add-Check "${checkId}_adapter" "custom_command"
      }
      else {
        $adapter = Get-Command -Name $agent -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($adapter) {
          Add-Check "${checkId}_adapter" "ok"
          [void]$checkLines.Add(("runner.{0}.adapter_path={1}" -f $checkId, $adapter.Source))
        }
        else {
          Add-Check "${checkId}_adapter" "warning"
          Add-WarningLine "runner $runnerId uses agent=$agent, but $agent is not on PATH"
        }
      }
      break
    }
    default {
      Add-Check "${checkId}_adapter" "warning"
      Add-WarningLine "runner $runnerId uses unsupported agent=$agent; use shell, manual, codex, claude, opencode, or gemini"
      break
    }
  }
}

function Test-ProcessAliveById {
  param([string]$ProcessIdValue)

  if ([string]::IsNullOrWhiteSpace($ProcessIdValue)) {
    return $false
  }

  $parsedProcessId = 0
  if (-not [int]::TryParse($ProcessIdValue, [ref]$parsedProcessId)) {
    return $false
  }
  if ($parsedProcessId -le 0) {
    return $false
  }

  return $null -ne (Get-Process -Id $parsedProcessId -ErrorAction SilentlyContinue)
}

function Add-RunnerStateCheck {
  param(
    [Parameter(Mandatory = $true)][object]$Runner
  )

  $runnerId = [string]$Runner.id
  $checkId = "runner_{0}" -f (ConvertTo-CheckIdFragment $runnerId)
  $stateStatus = [string](Get-AutoflowRunnerStateValue -RunnerId $runnerId -Field "status")
  $processIdValue = [string](Get-AutoflowRunnerStateValue -RunnerId $runnerId -Field "pid")
  $statePath = Get-AutoflowRunnerStatePath -RunnerId $runnerId
  $lastRuntimeLog = [string](Get-AutoflowRunnerStateValue -RunnerId $runnerId -Field "last_runtime_log")
  $lastPromptLog = [string](Get-AutoflowRunnerStateValue -RunnerId $runnerId -Field "last_prompt_log")
  $lastStdoutLog = [string](Get-AutoflowRunnerStateValue -RunnerId $runnerId -Field "last_stdout_log")
  $lastStderrLog = [string](Get-AutoflowRunnerStateValue -RunnerId $runnerId -Field "last_stderr_log")

  if ([string]::IsNullOrWhiteSpace($stateStatus)) {
    Add-Check "${checkId}_state" "missing"
    return
  }

  Add-Check "${checkId}_state" "ok"
  [void]$checkLines.Add(("runner.{0}.state_status={1}" -f $checkId, $stateStatus))
  [void]$checkLines.Add(("runner.{0}.pid={1}" -f $checkId, $processIdValue))
  [void]$checkLines.Add(("runner.{0}.state_path={1}" -f $checkId, $statePath))
  [void]$checkLines.Add(("runner.{0}.last_runtime_log={1}" -f $checkId, $lastRuntimeLog))
  [void]$checkLines.Add(("runner.{0}.last_prompt_log={1}" -f $checkId, $lastPromptLog))
  [void]$checkLines.Add(("runner.{0}.last_stdout_log={1}" -f $checkId, $lastStdoutLog))
  [void]$checkLines.Add(("runner.{0}.last_stderr_log={1}" -f $checkId, $lastStderrLog))

  $artifactIssueCount = 0
  $artifactCount = 0
  $boardFullPath = [System.IO.Path]::GetFullPath($boardRoot).TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar)
  $artifactValues = @(
    @{ Label = "runtime"; Path = $lastRuntimeLog },
    @{ Label = "prompt"; Path = $lastPromptLog },
    @{ Label = "stdout"; Path = $lastStdoutLog },
    @{ Label = "stderr"; Path = $lastStderrLog }
  )

  foreach ($artifact in $artifactValues) {
    $artifactPath = [string]$artifact.Path
    if ([string]::IsNullOrWhiteSpace($artifactPath)) {
      continue
    }

    $artifactCount += 1
    try {
      $artifactFullPath = [System.IO.Path]::GetFullPath($artifactPath)
      $isInsideBoard = $artifactFullPath.StartsWith($boardFullPath + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::Ordinal)
      if (-not $isInsideBoard) {
        $artifactIssueCount += 1
        Add-WarningLine "runner $runnerId last $($artifact.Label) artifact is outside board root: $artifactPath"
      }
      elseif (-not (Test-Path -LiteralPath $artifactPath -PathType Leaf)) {
        $artifactIssueCount += 1
        Add-WarningLine "runner $runnerId last $($artifact.Label) artifact is missing: $artifactPath"
      }
    }
    catch {
      $artifactIssueCount += 1
      Add-WarningLine "runner $runnerId last $($artifact.Label) artifact path is invalid: $artifactPath"
    }
  }

  if ($artifactCount -eq 0) {
    Add-Check "${checkId}_artifacts" "not_applicable"
  }
  elseif ($artifactIssueCount -eq 0) {
    Add-Check "${checkId}_artifacts" "ok"
  }
  else {
    Add-Check "${checkId}_artifacts" "warning"
  }

  if ($stateStatus -eq "running" -and -not [string]::IsNullOrWhiteSpace($processIdValue) -and -not (Test-ProcessAliveById -ProcessIdValue $processIdValue)) {
    Add-Check "${checkId}_pid" "warning"
    Add-WarningLine "runner $runnerId state says running with stale pid=$processIdValue; run autoflow runners stop $runnerId or restart it"
  }
  elseif ($stateStatus -eq "running" -and -not [string]::IsNullOrWhiteSpace($processIdValue)) {
    Add-Check "${checkId}_pid" "ok"
  }
  else {
    Add-Check "${checkId}_pid" "not_applicable"
  }
}

function Add-WatcherStateCheck {
  $pidFile = Join-Path $boardRoot "logs/hooks/watch-board.pid"
  [void]$checkLines.Add(("watcher.pid_file={0}" -f $pidFile))

  if (-not (Test-Path -LiteralPath $pidFile -PathType Leaf)) {
    Add-Check "watcher_pid" "not_running"
    [void]$checkLines.Add("watcher.status=not_running")
    return
  }

  $processIdValue = (Get-Content -Raw -LiteralPath $pidFile).Trim()
  [void]$checkLines.Add(("watcher.pid={0}" -f $processIdValue))

  if (Test-ProcessAliveById -ProcessIdValue $processIdValue) {
    Add-Check "watcher_pid" "ok"
    [void]$checkLines.Add("watcher.status=running")
    return
  }

  Add-Check "watcher_pid" "warning"
  [void]$checkLines.Add("watcher.status=stale_pid")
  Add-WarningLine "watcher pid file is stale or invalid: $pidFile pid=$(if ($processIdValue) { $processIdValue } else { 'empty' }); run autoflow watch-stop to clean it up"
}

function Test-ProjectSpecExistsForKey {
  param([string]$ProjectKey)

  return (Test-Path -LiteralPath (Join-Path $boardRoot "tickets/backlog/$ProjectKey.md") -PathType Leaf) -or
    (Test-Path -LiteralPath (Join-Path $boardRoot "tickets/done/$ProjectKey/$ProjectKey.md") -PathType Leaf)
}

function Add-ConversationHandoffCheck {
  $conversationsRoot = Join-Path $boardRoot "conversations"
  if (-not (Test-Path -LiteralPath $conversationsRoot -PathType Container)) {
    Add-Check "conversation_scaffold" "warning"
    Add-WarningLine "conversation scaffold is missing; run autoflow upgrade to add conversations/"
    return
  }

  Add-Check "conversation_scaffold" "ok"
  $handoffFiles = @(Get-ChildItem -LiteralPath $conversationsRoot -File -Filter "spec-handoff.md" -Recurse | Sort-Object FullName)
  $invalidCount = 0

  foreach ($handoffFile in $handoffFiles) {
    $projectKey = Split-Path -Leaf (Split-Path -Parent $handoffFile.FullName)
    if ($projectKey -notmatch '^project_[0-9][0-9][0-9]$') {
      $invalidCount += 1
      Add-WarningLine "handoff is not under conversations/prd_NNN/: $($handoffFile.FullName)"
      continue
    }

    if (-not (Test-ProjectSpecExistsForKey -ProjectKey $projectKey)) {
      $invalidCount += 1
      Add-WarningLine "handoff has no matching spec in backlog or done: $($handoffFile.FullName)"
    }
  }

  [void]$checkLines.Add(("conversation.handoff_count={0}" -f $handoffFiles.Count))
  if ($invalidCount -gt 0) {
    Add-Check "conversation_handoffs" "warning"
  }
  else {
    Add-Check "conversation_handoffs" "ok"
  }
}

if (Test-Path -LiteralPath $boardRoot -PathType Container) {
  Add-Check "board_root_exists" "ok"
}
else {
  Add-Check "board_root_exists" "error"
  Add-ErrorLine "board root does not exist: $boardRoot"
}

if (Test-Path -LiteralPath (Join-Path $resolvedProjectRoot "AGENTS.md") -PathType Leaf) {
  Add-Check "host_agents" "ok"
}
else {
  Add-Check "host_agents" "not_applicable"
}

if (Test-Path -LiteralPath $boardRoot -PathType Container) {
  foreach ($fileCheck in @(
      @{ Id = "board_agents"; Path = (Join-Path $boardRoot "AGENTS.md"); Label = "board AGENTS.md" },
      @{ Id = "board_readme"; Path = (Join-Path $boardRoot "README.md"); Label = "board README.md" }
    )) {
    if (Test-Path -LiteralPath $fileCheck.Path -PathType Leaf) {
      Add-Check $fileCheck.Id "ok"
    }
    else {
      Add-Check $fileCheck.Id "error"
      Add-ErrorLine "$($fileCheck.Label) is missing: $($fileCheck.Path)"
    }
  }

  foreach ($requiredDir in @("agents", "automations", "reference", "rules", "scripts", "tickets", "logs")) {
    $dirPath = Join-Path $boardRoot $requiredDir
    if (Test-Path -LiteralPath $dirPath -PathType Container) {
      Add-Check ("dir_{0}" -f $requiredDir) "ok"
    }
    else {
      Add-Check ("dir_{0}" -f $requiredDir) "error"
      Add-ErrorLine "required board directory is missing: $dirPath"
    }
  }

  foreach ($ticketDir in @("todo", "inprogress", "ready-to-merge", "merge-blocked", "verifier", "done", "reject")) {
    $dirPath = Join-Path $boardRoot "tickets/$ticketDir"
    if (Test-Path -LiteralPath $dirPath -PathType Container) {
      Add-Check ("tickets_{0}" -f $ticketDir) "ok"
    }
    else {
      Add-Check ("tickets_{0}" -f $ticketDir) "error"
      Add-ErrorLine "ticket state directory is missing: $dirPath"
    }
  }

  foreach ($nestedDir in @(
      "tickets/backlog",
      "rules/verifier",
      "logs/hooks",
      "tickets/plan",
      "automations/state",
      "automations/state/threads"
    )) {
    $dirPath = Join-Path $boardRoot $nestedDir
    $checkId = "dir_{0}" -f ($nestedDir -replace "[/.-]", "_")
    if (Test-Path -LiteralPath $dirPath -PathType Container) {
      Add-Check $checkId "ok"
    }
    else {
      Add-Check $checkId "error"
      Add-ErrorLine "required nested board directory is missing: $dirPath"
    }
  }

  $runnerScaffoldOk = $true
  foreach ($runnerScaffoldPath in @(
      "runners",
      "runners/state",
      "runners/logs",
      "runners/config.toml"
    )) {
    if (-not (Test-Path -LiteralPath (Join-Path $boardRoot $runnerScaffoldPath))) {
      $runnerScaffoldOk = $false
    }
  }
  if ($runnerScaffoldOk) {
    Add-Check "runner_scaffold" "ok"
  }
  else {
    Add-Check "runner_scaffold" "warning"
    Add-WarningLine "runner scaffold is missing or incomplete; run autoflow upgrade to add runners/config.toml, runners/state, and runners/logs"
  }

  $runnerConfigPath = Join-Path $boardRoot "runners/config.toml"
  $runners = @()
  if (Test-Path -LiteralPath $runnerConfigPath -PathType Leaf) {
    $runners = @(Get-AutoflowRunnerDefinitions -ConfigPath $runnerConfigPath)
    foreach ($runner in $runners) {
      Add-RunnerAdapterCheck -Runner $runner
      Add-RunnerStateCheck -Runner $runner
    }
  }
  [void]$checkLines.Add(("runner_count={0}" -f $runners.Count))
  Add-WatcherStateCheck
  Add-ConversationHandoffCheck

  $wikiScaffoldOk = $true
  foreach ($wikiScaffoldPath in @(
      "wiki",
      "wiki/index.md",
      "wiki/log.md",
      "wiki/project-overview.md",
      "rules/wiki"
    )) {
    if (-not (Test-Path -LiteralPath (Join-Path $boardRoot $wikiScaffoldPath))) {
      $wikiScaffoldOk = $false
    }
  }
  if ($wikiScaffoldOk) {
    Add-Check "wiki_scaffold" "ok"
  }
  else {
    Add-Check "wiki_scaffold" "warning"
    Add-WarningLine "wiki scaffold is missing or incomplete; run autoflow upgrade to add wiki pages and rules/wiki"
  }

  $metricsScaffoldOk = $true
  foreach ($metricsScaffoldPath in @(
      "metrics",
      "metrics/README.md",
      "metrics/.gitignore"
    )) {
    if (-not (Test-Path -LiteralPath (Join-Path $boardRoot $metricsScaffoldPath))) {
      $metricsScaffoldOk = $false
    }
  }
  if ($metricsScaffoldOk) {
    Add-Check "metrics_scaffold" "ok"
  }
  else {
    Add-Check "metrics_scaffold" "warning"
    Add-WarningLine "metrics scaffold is missing or incomplete; run autoflow upgrade to add metrics/README.md and metrics/.gitignore"
  }

  $adapterScaffoldOk = $true
  foreach ($adapterScaffoldPath in @(
      "agents/adapters",
      "agents/adapters/README.md",
      "agents/adapters/shell.md",
      "agents/adapters/codex-cli.md",
      "agents/adapters/claude-cli.md",
      "agents/adapters/opencode.md",
      "agents/adapters/gemini-cli.md"
    )) {
    if (-not (Test-Path -LiteralPath (Join-Path $boardRoot $adapterScaffoldPath))) {
      $adapterScaffoldOk = $false
    }
  }
  if ($adapterScaffoldOk) {
    Add-Check "adapter_scaffold" "ok"
  }
  else {
    Add-Check "adapter_scaffold" "warning"
    Add-WarningLine "adapter scaffold is missing or incomplete; run autoflow upgrade to add agents/adapters docs"
  }

  foreach ($runtimeFile in @(
      "common.sh",
      "runner-common.sh",
      "check-stop.sh",
      "file-watch-common.sh",
      "install-stop-hook.sh",
      "run-hook.sh",
      "watch-board.sh",
      "set-thread-context.sh",
      "clear-thread-context.sh",
      "start-ticket-owner.sh",
      "verify-ticket-owner.sh",
      "finish-ticket-owner.sh",
      "merge-ready-ticket.sh",
      "update-wiki.sh",
      "start-plan.sh",
      "start-todo.sh",
      "handoff-todo.sh",
      "start-verifier.sh",
      "start-spec.sh",
      "integrate-worktree.sh",
      "write-verifier-log.sh"
    )) {
    $scriptPath = Join-Path $boardRoot "scripts/$runtimeFile"
    if (Test-Path -LiteralPath $scriptPath -PathType Leaf) {
      Add-Check ("script_{0}" -f $runtimeFile) "ok"
    }
    else {
      Add-Check ("script_{0}" -f $runtimeFile) "error"
      Add-ErrorLine "runtime script is missing: $scriptPath"
      continue
    }

    if (Test-WindowsPlatform) {
      Add-Check ("script_{0}_executable" -f $runtimeFile) "skipped_windows"
    }
    elseif (Test-ExecutableBit $scriptPath) {
      Add-Check ("script_{0}_executable" -f $runtimeFile) "ok"
    }
    else {
      Add-Check ("script_{0}_executable" -f $runtimeFile) "error"
      Add-ErrorLine "runtime script is not executable: $scriptPath"
    }
  }

  foreach ($runtimePs1 in @(
      "invoke-runtime-sh.ps1",
      "runner-common.ps1",
      "codex-stop-hook.ps1",
      "check-stop.ps1",
      "install-stop-hook.ps1",
      "set-thread-context.ps1",
      "clear-thread-context.ps1",
      "start-ticket-owner.ps1",
      "verify-ticket-owner.ps1",
      "finish-ticket-owner.ps1",
      "merge-ready-ticket.ps1",
      "start-spec.ps1",
      "start-plan.ps1",
      "start-todo.ps1",
      "handoff-todo.ps1",
      "start-verifier.ps1",
      "integrate-worktree.ps1",
      "write-verifier-log.ps1",
      "run-hook.ps1",
      "watch-board.ps1"
    )) {
    $scriptPath = Join-Path $boardRoot "scripts/$runtimePs1"
    if (Test-Path -LiteralPath $scriptPath -PathType Leaf) {
      Add-Check ("script_{0}" -f $runtimePs1) "ok"
    }
    else {
      Add-Check ("script_{0}" -f $runtimePs1) "error"
      Add-ErrorLine "runtime script is missing: $scriptPath"
    }
  }

  $projectRootMarkerPath = Join-Path $boardRoot ".project-root"
  if (Test-Path -LiteralPath $projectRootMarkerPath -PathType Leaf) {
    $markerValue = Get-ProjectRootMarkerValue $boardRoot
    Add-Check "project_root_marker" "ok"
    [void]$checkLines.Add(("project_root_marker_value={0}" -f $markerValue))

    try {
      $resolvedFromMarker = Resolve-ProjectRootFromBoard $boardRoot
      Add-Check "project_root_marker_resolves" "ok"
      [void]$checkLines.Add(("project_root_marker_resolved={0}" -f $resolvedFromMarker))
      if ($resolvedFromMarker -eq $resolvedProjectRoot) {
        Add-Check "project_root_marker_matches_host" "ok"
      }
      else {
        Add-Check "project_root_marker_matches_host" "error"
        Add-ErrorLine "project-root marker resolves to $resolvedFromMarker, expected $resolvedProjectRoot"
      }
    }
    catch {
      Add-Check "project_root_marker_resolves" "error"
      Add-ErrorLine "project-root marker could not be resolved from $projectRootMarkerPath"
    }
  }
  else {
    Add-Check "project_root_marker" "error"
    Add-ErrorLine "board project-root marker is missing: $projectRootMarkerPath"
  }

  $boardVersion = Get-BoardVersionValue $boardRoot
  if ($boardVersion) {
    Add-Check "board_version_marker" "ok"
    [void]$checkLines.Add(("board_version={0}" -f $boardVersion))
    [void]$checkLines.Add(("package_version={0}" -f $packageVersion))
    if ($boardVersion -eq $packageVersion) {
      Add-Check "board_version_matches_package" "ok"
    }
    else {
      Add-Check "board_version_matches_package" "warning"
      Add-WarningLine "board version $boardVersion differs from package version $packageVersion; run autoflow upgrade"
    }
  }
  else {
    Add-Check "board_version_marker" "warning"
    [void]$checkLines.Add(("package_version={0}" -f $packageVersion))
    Add-WarningLine "board version marker is missing: $(Join-Path $boardRoot '.autoflow-version')"
  }

  foreach ($starterFile in @(
      "automations/heartbeat-set.toml",
      "automations/file-watch.psd1",
      "automations/state/README.md",
      "automations/state/.gitignore",
      "reference/README.md",
      "reference/backlog.md",
      "reference/backlog-processed.md",
      "reference/project-spec-template.md",
      "reference/feature-spec-template.md",
      "reference/plan.md",
      "reference/plan-template.md",
      "reference/roadmap.md",
      "reference/runner-harness.md",
      "reference/wiki.md",
      "reference/tickets-board.md",
      "reference/ticket-template.md",
      "reference/logs.md",
      "reference/hook-logs.md",
      "automations/templates/heartbeat-set.template.toml",
      "automations/templates/ticket-owner-heartbeat.template.toml",
      "automations/templates/plan-heartbeat.template.toml",
      "automations/templates/todo-heartbeat.template.toml",
      "automations/templates/verifier-heartbeat.template.toml",
      "rules/verifier/checklist-template.md",
      "rules/verifier/verification-template.md"
    )) {
    $filePath = Join-Path $boardRoot $starterFile
    $checkId = "starter_{0}" -f ((Split-Path -Leaf $starterFile) -replace "[.-]", "_")
    if (Test-Path -LiteralPath $filePath -PathType Leaf) {
      Add-Check $checkId "ok"
    }
    else {
      Add-Check $checkId "error"
      Add-ErrorLine "starter file is missing: $filePath"
    }
  }

  foreach ($forbiddenStateFile in @(
      "tickets/backlog/README.md",
      "tickets/backlog/project-spec-template.md",
      "tickets/backlog/feature-spec-template.md",
      "tickets/backlog/processed/README.md",
      "tickets/plan/README.md",
      "tickets/plan/plan_template.md",
      "tickets/plan/roadmap.md",
      "tickets/README.md",
      "tickets/tickets_template.md",
      "logs/README.md",
      "logs/hooks/README.md"
    )) {
    $filePath = Join-Path $boardRoot $forbiddenStateFile
    if (Test-Path -LiteralPath $filePath -PathType Leaf) {
      Add-Check ("state_doc_{0}" -f ($forbiddenStateFile -replace "[/.-]", "_")) "error"
      Add-ErrorLine "state folder contains reference/template file; move it under reference/: $filePath"
    }
  }

  $legacyPlanInprogress = Join-Path $boardRoot "tickets/plan/inprogress"
  if ((Test-Path -LiteralPath $legacyPlanInprogress -PathType Container) -and
      (Get-ChildItem -LiteralPath $legacyPlanInprogress -File -Filter "plan_*.md" | Select-Object -First 1)) {
    Add-Check "legacy_plan_inprogress_empty" "error"
    Add-ErrorLine "legacy plan inprogress folder still contains plan files; use tickets/inprogress instead: $legacyPlanInprogress"
  }

  $legacyRejectRoot = Join-Path $boardRoot "tickets/reject"
  if ((Test-Path -LiteralPath $legacyRejectRoot -PathType Container) -and
      (Get-ChildItem -LiteralPath $legacyRejectRoot -File -Filter "tickets_*.md" |
        Where-Object { $_.Name -match '^tickets_[0-9][0-9][0-9]\.md$' } |
        Select-Object -First 1)) {
    Add-Check "legacy_reject_ticket_names" "error"
    Add-ErrorLine "reject folder still contains tickets_NNN.md files; run autoflow upgrade so failed tickets use reject_NNN.md: $legacyRejectRoot"
  }
  else {
    Add-Check "legacy_reject_ticket_names" "ok"
  }

  $ticketLocations = @{}
  foreach ($ticketStateDir in @("todo", "inprogress", "ready-to-merge", "merge-blocked", "verifier", "done")) {
    $stateRoot = Join-Path $boardRoot "tickets/$ticketStateDir"
    if (-not (Test-Path -LiteralPath $stateRoot -PathType Container)) {
      continue
    }

    if ($ticketStateDir -eq "done") {
      $ticketFiles = Get-ChildItem -LiteralPath $stateRoot -File -Filter "tickets_*.md" -Recurse
    }
    else {
      $ticketFiles = Get-ChildItem -LiteralPath $stateRoot -File -Filter "tickets_*.md"
    }

    foreach ($ticketFile in ($ticketFiles | Where-Object { $_.Name -match '^tickets_[0-9][0-9][0-9]\.md$' } | Sort-Object FullName)) {
      $relativePath = $ticketFile.FullName.Substring($boardRoot.Length).TrimStart([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar)
      $relativePath = $relativePath -replace '\\', '/'
      if (-not $ticketLocations.ContainsKey($ticketFile.Name)) {
        $ticketLocations[$ticketFile.Name] = New-Object System.Collections.Generic.List[string]
      }
      [void]$ticketLocations[$ticketFile.Name].Add($relativePath)
    }
  }

  $duplicateTicketIds = @($ticketLocations.Keys | Where-Object { $ticketLocations[$_].Count -gt 1 } | Sort-Object)
  if ($duplicateTicketIds.Count -gt 0) {
    Add-Check "ticket_duplicate_ids" "error"
    foreach ($duplicateTicketId in $duplicateTicketIds) {
      Add-ErrorLine ("duplicate ticket id {0} exists in multiple state folders: {1}" -f $duplicateTicketId, (($ticketLocations[$duplicateTicketId] | Sort-Object) -join ", "))
    }
  }
  else {
    Add-Check "ticket_duplicate_ids" "ok"
  }

  $ticketTemplate = Join-Path $boardRoot "reference/ticket-template.md"
  if (Test-Path -LiteralPath $ticketTemplate -PathType Leaf) {
    foreach ($requiredField in @("Plan Candidate", "Stage", "Claimed By", "Execution AI", "Verifier AI")) {
      $checkId = "ticket_template_{0}" -f ($requiredField -replace " ", "_")
      if (Test-MarkdownFieldPresentInSection -FilePath $ticketTemplate -Heading "Ticket" -Field $requiredField) {
        Add-Check $checkId "ok"
      }
      else {
        Add-Check $checkId "error"
        Add-ErrorLine "ticket template is missing field $requiredField: $ticketTemplate"
      }
    }
  }

  $inprogressRoot = Join-Path $boardRoot "tickets/inprogress"
  if (Test-Path -LiteralPath $inprogressRoot -PathType Container) {
    foreach ($ticket in (Get-ChildItem -LiteralPath $inprogressRoot -File -Filter "tickets_*.md" | Sort-Object FullName)) {
      foreach ($requiredField in @("Stage", "Execution AI", "Verifier AI")) {
        if (-not (Test-MarkdownFieldPresentInSection -FilePath $ticket.FullName -Heading "Ticket" -Field $requiredField)) {
          Add-WarningLine "live inprogress ticket is missing field $requiredField: $($ticket.FullName)"
        }
      }
    }
  }

  if (Test-BoardIsInitialized $boardRoot) {
    Add-Check "board_initialized" "ok"
  }
  else {
    Add-Check "board_initialized" "warning"
    Add-WarningLine "board root exists but does not look fully initialized"
  }
}

$status = "ok"
if ($errorCount -gt 0) {
  $status = "fail"
}

Write-KeyValueLine "project_root" $resolvedProjectRoot
Write-KeyValueLine "board_root" $boardRoot
Write-KeyValueLine "board_dir_name" $BoardDirName
Write-KeyValueLine "status" $status
Write-KeyValueLine "package_version" $packageVersion
Write-KeyValueLine "error_count" ([string]$script:errorCount)
Write-KeyValueLine "warning_count" ([string]$script:warningCount)
$checkLines
$detailLines

if ($script:errorCount -gt 0) {
  exit 1
}
