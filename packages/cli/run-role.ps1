[CmdletBinding()]
param(
  [Parameter(Position = 0)]
  # Mirrors `case "$requested_role" in ...` in run-role.sh and the
  # five other role-acceptance lists across the codebase (CLI
  # runner_allowed_role, CLI metrics/doctor validation, desktop
  # allowedRunnerRoles / allowedRunRoles).
  [ValidateSet("ticket", "owner", "ticket-owner", "planner", "plan", "todo", "verifier", "veri", "wiki", "wiki-maintainer", "merge", "merge-bot", "coordinator", "coord", "doctor", "diagnose", "self-improve", "self_improve", "selfimprove")]
  [string]$Role,

  [Parameter(Position = 1, ValueFromRemainingArguments = $true)]
  [string[]]$RemainingArgs
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($Role)) {
  throw "Role is required. 3-runner default: planner / ticket / wiki. Legacy: todo / verifier / coordinator / merge. Trial: self-improve."
}

$runner = Join-Path $PSScriptRoot "invoke-cli-sh.ps1"
& $runner -ScriptName "run-role.sh" $Role @RemainingArgs
exit $LASTEXITCODE
