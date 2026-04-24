[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-HookDiagnostic {
  param([string]$Message)

  try {
    $logRoot = Join-Path $env:USERPROFILE ".codex\log"
    if (-not (Test-Path -LiteralPath $logRoot)) {
      New-Item -ItemType Directory -Path $logRoot -Force | Out-Null
    }

    $timestamp = (Get-Date).ToString("o")
    Add-Content -LiteralPath (Join-Path $logRoot "autoflow-stop-hook.log") -Value "[$timestamp] $Message"
  }
  catch {
    # Stop hook diagnostics are best-effort.
  }
}

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

function Invoke-BashScript {
  param(
    [string]$BoardRootValue,
    [string]$BashScriptPath,
    [string[]]$ScriptArguments
  )

  $envAssignments = @(
    "AUTOFLOW_BOARD_ROOT=$(Convert-ToBashLiteral $BoardRootValue)"
  )

  foreach ($name in @("AUTOFLOW_THREAD_KEY", "CODEX_THREAD_ID", "AUTOFLOW_ROLE", "AUTOFLOW_WORKER_ID", "AUTOFLOW_EXECUTION_POOL", "AUTOFLOW_VERIFIER_POOL", "AUTOFLOW_PROJECT_ROOT", "AUTOFLOW_BACKGROUND", "AUTOFLOW_STOP_BYPASS")) {
    $item = Get-Item -Path ("Env:" + $name) -ErrorAction SilentlyContinue
    if ($null -ne $item -and $null -ne $item.Value -and "$($item.Value)" -ne "") {
      $envAssignments += ("{0}={1}" -f $name, (Convert-ToBashLiteral $item.Value))
    }
  }

  $commandParts = @()
  $envPrefix = $envAssignments -join " "
  if ($envPrefix) {
    $commandParts += $envPrefix
  }
  $commandParts += (Convert-ToBashLiteral $BashScriptPath)
  foreach ($argument in $ScriptArguments) {
    $commandParts += (Convert-ToBashLiteral $argument)
  }

  try {
    if (-not (Get-Command -Name bash -ErrorAction SilentlyContinue)) {
      Write-HookDiagnostic "bash executable was not found for board stop hook."
      exit 0
    }

    & bash -lc ($commandParts -join " ")
    if ($LASTEXITCODE -ne 0) {
      Write-HookDiagnostic "check-stop.sh exited with code $LASTEXITCODE."
    }
    exit 0
  }
  catch {
    Write-HookDiagnostic "check-stop.ps1 failed open: $($_.Exception.Message)"
    exit 0
  }
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$scriptDirName = Split-Path -Leaf $scriptDir
if ($scriptDirName -eq "runtime") {
  $boardRoot = (Resolve-Path (Join-Path $scriptDir "..\\..")).Path
}
else {
  $boardRoot = (Resolve-Path (Join-Path $scriptDir "..")).Path
}
$bashScript = Convert-ToBashPath (Join-Path $scriptDir "check-stop.sh")

try {
  Invoke-BashScript -BoardRootValue (Convert-ToBashPath $boardRoot) -BashScriptPath $bashScript -ScriptArguments @()
}
catch {
  Write-HookDiagnostic "check-stop.ps1 failed open: $($_.Exception.Message)"
  exit 0
}
