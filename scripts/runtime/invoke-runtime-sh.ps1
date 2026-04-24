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
  param(
    [string]$PathValue,
    [string]$BashFlavor = "wsl"
  )

  if ([string]::IsNullOrWhiteSpace($PathValue)) {
    return $PathValue
  }

  if ($PathValue -match '^[A-Za-z]:[\\/](.*)$') {
    $drive = $PathValue.Substring(0, 1).ToLowerInvariant()
    $rest = ($PathValue.Substring(2) -replace '\\', '/').TrimStart('/')
    switch ($BashFlavor) {
      "msys" { return "/$drive/$rest" }
      "cygwin" { return "/cygdrive/$drive/$rest" }
      default { return "/mnt/$drive/$rest" }
    }
  }

  return ($PathValue -replace '\\', '/')
}

function Get-BashFlavor {
  $uname = ""
  try {
    $output = & bash -lc "uname -s" 2>$null
    if ($LASTEXITCODE -eq 0 -and $null -ne $output) {
      $uname = [string]($output | Select-Object -First 1)
    }
  } catch {
    $uname = ""
  }

  if ($uname -match '^(MINGW|MSYS)') {
    return "msys"
  }
  if ($uname -match '^CYGWIN') {
    return "cygwin"
  }
  return "wsl"
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

$bashFlavor = Get-BashFlavor
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$boardRoot = Get-BoardRoot -RuntimeScriptDir $scriptDir
$bashScript = Join-Path $scriptDir $ScriptName
if (-not (Test-Path -LiteralPath $bashScript)) {
  throw "Runtime shell script not found: $bashScript"
}

$boardRootBash = Convert-ToBashPath -PathValue $boardRoot -BashFlavor $bashFlavor
$bashScriptPath = Convert-ToBashPath -PathValue $bashScript -BashFlavor $bashFlavor

$envAssignments = @(
  "AUTOFLOW_BOARD_ROOT=$(Convert-ToBashLiteral $boardRootBash)",
  "AUTOFLOW_BASH_FLAVOR=$(Convert-ToBashLiteral $bashFlavor)"
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
    $value = "$($item.Value)"
    if ($value -match '^[A-Za-z]:[\\/]') {
      $value = Convert-ToBashPath -PathValue $value -BashFlavor $bashFlavor
    }
    $envAssignments += ("{0}={1}" -f $name, (Convert-ToBashLiteral $value))
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
