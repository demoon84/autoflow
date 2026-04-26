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

if (-not (Get-Command -Name bash -ErrorAction SilentlyContinue)) {
  throw "bash executable was not found. Install Git Bash or WSL, then run this PowerShell wrapper again."
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$bashScript = Join-Path $scriptDir $ScriptName
if (-not (Test-Path -LiteralPath $bashScript)) {
  throw "CLI shell script not found: $bashScript"
}

$bashScriptPath = Convert-ToBashPath $bashScript
$forwardedArgs = New-Object System.Collections.Generic.List[string]
foreach ($argument in $ScriptArguments) {
  if ($argument -match '^[A-Za-z]:[\\/]') {
    $forwardedArgs.Add((Convert-ToBashPath $argument))
    continue
  }
  $forwardedArgs.Add($argument)
}

& bash $bashScriptPath @forwardedArgs
exit $LASTEXITCODE
