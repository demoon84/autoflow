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

function Convert-ToBashPath {
  param(
    [Parameter(Mandatory = $true)]
    [string]$PathValue
  )

  if ($PathValue -match '^[A-Za-z]:[\\/](.*)$') {
    $drive = $PathValue.Substring(0, 1).ToLowerInvariant()
    $rest = $PathValue.Substring(2) -replace '\\', '/'
    return "/mnt/$drive/$rest"
  }

  return $PathValue
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$bashEntry = Convert-ToBashPath (Join-Path $PSScriptRoot "autoflow")

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

$commandsWithProjectRoot = @("init", "status", "doctor", "upgrade", "render-heartbeats")
$forwardedArgs = New-Object System.Collections.Generic.List[string]
$forwardedArgs.Add($Command)

for ($i = 0; $i -lt $RemainingArgs.Count; $i++) {
  $arg = $RemainingArgs[$i]
  if ($i -eq 0 -and $commandsWithProjectRoot -contains $Command) {
    $forwardedArgs.Add((Convert-ToBashPath $arg))
    continue
  }
  $forwardedArgs.Add($arg)
}

& bash $bashEntry @forwardedArgs
exit $LASTEXITCODE
