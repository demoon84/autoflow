[CmdletBinding()]
param(
  [Parameter(Position = 0)]
  [ValidateSet("create", "new", "help")]
  [string]$Action = "help",

  [Parameter(Position = 1, ValueFromRemainingArguments = $true)]
  [string[]]$RemainingArgs
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$runner = Join-Path $PSScriptRoot "invoke-cli-sh.ps1"
& $runner -ScriptName "spec-project.sh" $Action @RemainingArgs
exit $LASTEXITCODE
