[CmdletBinding()]
param(
  [Parameter(Position = 0, ValueFromRemainingArguments = $true)]
  [string[]]$RemainingArgs
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$runner = Join-Path $PSScriptRoot "invoke-cli-sh.ps1"
& $runner -ScriptName "metrics-project.sh" @RemainingArgs
exit $LASTEXITCODE
