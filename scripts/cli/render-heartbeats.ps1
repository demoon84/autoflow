[CmdletBinding()]
param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$RemainingArgs
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$runner = Join-Path $PSScriptRoot "invoke-cli-sh.ps1"
& $runner -ScriptName "render-heartbeats.sh" @RemainingArgs
exit $LASTEXITCODE
