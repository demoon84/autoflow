[CmdletBinding()]
param(
  [Parameter(Position = 0)]
  [string]$ProjectRoot = ".",

  [Parameter(Position = 1)]
  [string]$BoardDirName = "autoflow"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "cli-common.ps1")

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
  Add-Check "host_agents" "error"
  Add-ErrorLine "host AGENTS.md is missing: $(Join-Path $resolvedProjectRoot 'AGENTS.md')"
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

  foreach ($ticketDir in @("todo", "inprogress", "verifier", "done", "reject")) {
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
      "tickets/runs",
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

  foreach ($runtimeFile in @(
      "common.sh",
      "check-stop.sh",
      "file-watch-common.sh",
      "install-stop-hook.sh",
      "run-hook.sh",
      "watch-board.sh",
      "set-thread-context.sh",
      "clear-thread-context.sh",
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
      "check-stop.ps1",
      "install-stop-hook.ps1",
      "set-thread-context.ps1",
      "clear-thread-context.ps1",
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
      "reference/tickets-board.md",
      "reference/ticket-template.md",
      "reference/logs.md",
      "reference/hook-logs.md",
      "automations/templates/heartbeat-set.template.toml",
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

  $ticketTemplate = Join-Path $boardRoot "reference/ticket-template.md"
  if (Test-Path -LiteralPath $ticketTemplate -PathType Leaf) {
    foreach ($requiredField in @("Stage", "Claimed By", "Execution Owner", "Verifier Owner")) {
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
      foreach ($requiredField in @("Stage", "Execution Owner", "Verifier Owner")) {
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
