[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$ScriptName,

  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$ScriptArguments
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Convert-ToBashPath {
  param([string]$PathValue)

  if ($PathValue -match '^[A-Za-z]:[\\/](.*)$') {
    $drive = $PathValue.Substring(0, 1).ToLowerInvariant()
    $rest = ($PathValue.Substring(2) -replace '\\', '/').TrimStart('/')
    return "/mnt/$drive/$rest"
  }

  return ($PathValue -replace '\\', '/')
}

function Convert-ToBashLiteral {
  param([string]$Value)

  $escaped = $Value.Replace("'", "'\''")
  return "'" + $escaped + "'"
}

function Get-BoardRoot {
  param([string]$RuntimeScriptDir)

  $scriptDirName = Split-Path -Leaf $RuntimeScriptDir
  if ($scriptDirName -eq "runtime") {
    return (Resolve-Path (Join-Path $RuntimeScriptDir "..\..")).Path
  }

  return (Resolve-Path (Join-Path $RuntimeScriptDir "..")).Path
}

if (-not (Get-Command -Name bash -ErrorAction SilentlyContinue)) {
  throw "bash executable was not found. Install Git Bash or WSL, then run this PowerShell wrapper again."
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$boardRoot = Get-BoardRoot -RuntimeScriptDir $scriptDir
$bashScript = Join-Path $scriptDir $ScriptName
if (-not (Test-Path -LiteralPath $bashScript)) {
  throw "Runtime shell script not found: $bashScript"
}

$boardRootBash = Convert-ToBashPath $boardRoot
$bashScriptPath = Convert-ToBashPath $bashScript

$envAssignments = @(
  "AUTOFLOW_BOARD_ROOT=$(Convert-ToBashLiteral $boardRootBash)"
)

$forwardedEnvNames = @(
  "AUTOFLOW_THREAD_KEY",
  "CODEX_THREAD_ID",
  "AUTOFLOW_ROLE",
  "AUTOFLOW_WORKER_ID",
  "AUTOFLOW_EXECUTION_POOL",
  "AUTOFLOW_VERIFIER_POOL",
  "AUTOFLOW_MAX_EXECUTION_LOAD_PER_WORKER",
  "AUTOFLOW_PROJECT_ROOT",
  "AUTOFLOW_BACKGROUND",
  "AUTOFLOW_STOP_BYPASS",
  "AUTOFLOW_WORKTREE_MODE",
  "AUTOFLOW_WORKTREE_ROOT"
)

foreach ($name in $forwardedEnvNames) {
  $item = Get-Item -Path ("Env:" + $name) -ErrorAction SilentlyContinue
  if ($null -ne $item -and $null -ne $item.Value -and "$($item.Value)" -ne "") {
    $envAssignments += ("{0}={1}" -f $name, (Convert-ToBashLiteral $item.Value))
  }
}

$commandParts = @()
$commandParts += ($envAssignments -join " ")
$commandParts += (Convert-ToBashLiteral $bashScriptPath)
foreach ($argument in $ScriptArguments) {
  $commandParts += (Convert-ToBashLiteral $argument)
}

& bash -lc ($commandParts -join " ")
exit $LASTEXITCODE
