[CmdletBinding()]
param(
  [Parameter(Position = 0)]
  [ValidateSet("planner", "plan", "todo", "verifier", "veri", "wiki", "wiki-maintainer")]
  [string]$Role,

  [Parameter(Position = 1, ValueFromRemainingArguments = $true)]
  [string[]]$RemainingArgs
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($Role)) {
  throw "Role is required. Use planner, todo, verifier, or wiki."
}

$runner = Join-Path $PSScriptRoot "invoke-cli-sh.ps1"
& $runner -ScriptName "run-role.sh" $Role @RemainingArgs
exit $LASTEXITCODE
