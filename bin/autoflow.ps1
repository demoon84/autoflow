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
  autoflow render-heartbeats [project-root] [board-dir-name]
  autoflow status [project-root] [board-dir-name]
  autoflow doctor [project-root] [board-dir-name]
  autoflow upgrade [project-root] [board-dir-name]
  autoflow watch [project-root] [board-dir-name] [config-path]
  autoflow watch-bg [project-root] [board-dir-name] [config-path]
  autoflow watch-stop [project-root] [board-dir-name]
  autoflow help
"@ | Write-Host
}

$repoRoot = Split-Path -Parent $PSScriptRoot

if ($Command -in @("help", "-h", "--help")) {
  Show-Usage
  exit 0
}

if ($Command -eq "watch") {
  $watchScript = Join-Path $repoRoot "scripts/cli/watch-project.ps1"
  & $watchScript @RemainingArgs
  exit $LASTEXITCODE
}

if ($Command -eq "watch-bg") {
  $watchScript = Join-Path $repoRoot "scripts/cli/watch-project.ps1"
  & $watchScript -Background @RemainingArgs
  exit $LASTEXITCODE
}

if ($Command -eq "watch-stop") {
  $watchScript = Join-Path $repoRoot "scripts/cli/watch-project.ps1"
  & $watchScript -Stop @RemainingArgs
  exit $LASTEXITCODE
}

switch ($Command) {
  "init" {
    $scriptPath = Join-Path $repoRoot "scripts/cli/scaffold-project.ps1"
  }
  "status" {
    $scriptPath = Join-Path $repoRoot "scripts/cli/status-project.ps1"
  }
  "doctor" {
    $scriptPath = Join-Path $repoRoot "scripts/cli/doctor-project.ps1"
  }
  "upgrade" {
    $scriptPath = Join-Path $repoRoot "scripts/cli/upgrade-project.ps1"
  }
  "render-heartbeats" {
    $scriptPath = Join-Path $repoRoot "scripts/cli/render-heartbeats.ps1"
  }
  default {
    Write-Error "Unknown command: $Command"
    Show-Usage
    exit 1
  }
}
& $scriptPath @RemainingArgs
exit $LASTEXITCODE
