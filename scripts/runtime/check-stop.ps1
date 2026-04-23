[CmdletBinding()]
param()

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
  return "'" + $Value + "'"
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

  & bash -lc ($commandParts -join " ")
  exit $LASTEXITCODE
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

Invoke-BashScript -BoardRootValue (Convert-ToBashPath $boardRoot) -BashScriptPath $bashScript -ScriptArguments @()
