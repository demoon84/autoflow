[CmdletBinding()]
param(
  [Parameter(Position = 0)]
  [ValidateSet("update", "lint", "help")]
  [string]$Action = "help",

  [Parameter(Position = 1, ValueFromRemainingArguments = $true)]
  [string[]]$RemainingArgs
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$runner = Join-Path $PSScriptRoot "invoke-cli-sh.ps1"
& $runner -ScriptName "wiki-project.sh" $Action @RemainingArgs
exit $LASTEXITCODE
