[CmdletBinding()]
param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$RemainingArgs
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$runner = Join-Path $PSScriptRoot "invoke-runtime-sh.ps1"
& $runner -ScriptName "integrate-worktree.sh" @RemainingArgs
exit $LASTEXITCODE
