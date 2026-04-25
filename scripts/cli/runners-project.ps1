[CmdletBinding()]
param(
  [Parameter(Position = 0)]
  [ValidateSet("list", "add", "remove", "start", "stop", "restart", "artifacts", "set")]
  [string]$Action = "list",

  [Parameter(Position = 1, ValueFromRemainingArguments = $true)]
  [string[]]$RemainingArgs
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$runner = Join-Path $PSScriptRoot "invoke-cli-sh.ps1"
& $runner -ScriptName "runners-project.sh" $Action @RemainingArgs
exit $LASTEXITCODE
