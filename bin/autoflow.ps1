[CmdletBinding()]
param(
  [Parameter(Position = 0)]
  [string]$Command = "help",

  [Parameter(Position = 1, ValueFromRemainingArguments = $true)]
  [string[]]$RemainingArgs
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Show-Usage {
  @"
Autoflow CLI

Usage:
  autoflow init [project-root] [board-dir-name]
  autoflow install-stop-hook [project-root] [board-dir-name]
  autoflow remove-stop-hook [project-root] [board-dir-name]
  autoflow stop-hook-status [project-root] [board-dir-name]
  autoflow render-heartbeats [project-root] [board-dir-name]
  autoflow prd create [project-root] [board-dir-name] [--id NNN] [--title text] [--goal text] [--from-file path] [--raw] [--save-handoff] [--force]
  autoflow spec create [project-root] [board-dir-name] [--id NNN] [--title text] [--goal text] [--from-file path] [--raw] [--save-handoff] [--force] (legacy alias)
  autoflow run planner [project-root] [board-dir-name] [--runner runner-id] [--dry-run]   # Plan AI (3-runner default)
  autoflow run ticket [project-root] [board-dir-name] [--runner runner-id] [--dry-run]    # Impl AI (3-runner default)
  autoflow run wiki [project-root] [board-dir-name] [--runner runner-id] [--dry-run]      # Wiki AI (3-runner default)
  autoflow run todo [project-root] [board-dir-name] [--runner runner-id] [--dry-run]      # legacy role-pipeline
  autoflow run verifier [project-root] [board-dir-name] [--runner runner-id] [--dry-run]  # legacy role-pipeline
  autoflow run coordinator [project-root] [board-dir-name] [--runner runner-id] [--dry-run]  # legacy
  autoflow wiki update [project-root] [board-dir-name] [--dry-run]
  autoflow wiki lint [project-root] [board-dir-name] [--semantic] [--runner RUNNER_ID]
  autoflow wiki query [project-root] [board-dir-name] --term TEXT [--term TEXT]... [--limit N] [--no-tickets] [--no-handoffs] [--no-snippets] [--synth] [--runner RUNNER_ID]
  autoflow runners list [project-root] [board-dir-name]
  autoflow runners add <runner-id> <role> [project-root] [board-dir-name] key=value...
  autoflow runners remove <runner-id> [project-root] [board-dir-name]
  autoflow runners start <runner-id> [project-root] [board-dir-name]
  autoflow runners stop <runner-id> [project-root] [board-dir-name]
  autoflow runners restart <runner-id> [project-root] [board-dir-name]
  autoflow runners artifacts <runner-id> [project-root] [board-dir-name]
  autoflow runners set <runner-id> [project-root] [board-dir-name] key=value...
  autoflow metrics [project-root] [board-dir-name] [--write]
  autoflow status [project-root] [board-dir-name]
  autoflow doctor [project-root] [board-dir-name]
  autoflow upgrade [project-root] [board-dir-name]
  autoflow watch [project-root] [board-dir-name] [config-path]
  autoflow watch-bg [project-root] [board-dir-name] [config-path]
  autoflow watch-status [project-root] [board-dir-name]
  autoflow watch-stop [project-root] [board-dir-name]
  autoflow help
"@ | Write-Host
}

$scriptPath = $PSCommandPath
while ($true) {
  $item = Get-Item -LiteralPath $scriptPath -Force
  if ($item.LinkType -ne 'SymbolicLink' -or -not $item.Target) { break }
  $target = @($item.Target)[0]
  if ([System.IO.Path]::IsPathRooted($target)) {
    $scriptPath = $target
  } else {
    $scriptPath = Join-Path (Split-Path -Parent $scriptPath) $target
  }
}
$scriptPath = (Resolve-Path -LiteralPath $scriptPath).Path
$repoRoot = Split-Path -Parent (Split-Path -Parent $scriptPath)
$cliScriptMap = @{
  "init" = "scaffold-project.ps1"
  "install-stop-hook" = "stop-hook-project.ps1"
  "remove-stop-hook" = "stop-hook-project.ps1"
  "stop-hook-status" = "stop-hook-project.ps1"
  "status" = "status-project.ps1"
  "doctor" = "doctor-project.ps1"
  "upgrade" = "upgrade-project.ps1"
  "render-heartbeats" = "render-heartbeats.ps1"
  "prd" = "spec-project.ps1"
  "spec" = "spec-project.ps1"
  "wiki" = "wiki-project.ps1"
  "runners" = "runners-project.ps1"
  "run" = "run-role.ps1"
  "metrics" = "metrics-project.ps1"
}

if ($Command -in @("help", "-h", "--help")) {
  Show-Usage
  exit 0
}

if ($Command -eq "watch") {
  $watchScript = Join-Path $repoRoot "packages/cli/watch-project.ps1"
  & $watchScript @RemainingArgs
  exit $LASTEXITCODE
}

if ($Command -eq "watch-bg") {
  $watchScript = Join-Path $repoRoot "packages/cli/watch-project.ps1"
  & $watchScript -Background @RemainingArgs
  exit $LASTEXITCODE
}

if ($Command -eq "watch-status") {
  $watchScript = Join-Path $repoRoot "packages/cli/watch-project.ps1"
  & $watchScript -Status @RemainingArgs
  exit $LASTEXITCODE
}

if ($Command -eq "watch-stop") {
  $watchScript = Join-Path $repoRoot "packages/cli/watch-project.ps1"
  & $watchScript -Stop @RemainingArgs
  exit $LASTEXITCODE
}

if ($cliScriptMap.ContainsKey($Command)) {
  $scriptName = $cliScriptMap[$Command]
  $cliScript = Join-Path $repoRoot ("packages/cli/" + $scriptName)

  switch ($Command) {
    "install-stop-hook" {
      & $cliScript "install" @RemainingArgs
    }
    "remove-stop-hook" {
      & $cliScript "remove" @RemainingArgs
    }
    "stop-hook-status" {
      & $cliScript "status" @RemainingArgs
    }
    default {
      & $cliScript @RemainingArgs
    }
  }

  exit $LASTEXITCODE
}

Write-Host "Unknown command: $Command"
Show-Usage
exit 1
