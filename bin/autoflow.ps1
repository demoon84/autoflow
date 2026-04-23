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
  autoflow status [project-root] [board-dir-name]
  autoflow doctor [project-root] [board-dir-name]
  autoflow upgrade [project-root] [board-dir-name]
  autoflow watch [project-root] [board-dir-name] [config-path]
  autoflow watch-bg [project-root] [board-dir-name] [config-path]
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
}

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

if ($cliScriptMap.ContainsKey($Command)) {
  $scriptName = $cliScriptMap[$Command]
  $cliScript = Join-Path $repoRoot ("scripts/cli/" + $scriptName)

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
