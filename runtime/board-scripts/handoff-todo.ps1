[CmdletBinding()]
param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$RemainingArgs
)

# DEPRECATED: legacy todo→verifier handoff runtime (Windows wrapper).
#
# In the 3-runner topology (planner-1 + owner-1 + wiki-1), Impl AI
# (`owner-1`) does not hand a ticket to a separate verifier — it
# verifies and merges its own ticket inline via
# `verify-ticket-owner.*` + `finish-ticket-owner.*`.
#
# This wrapper is kept reachable for backwards compatibility with
# the legacy todo role-pipeline (`autoflow run todo` / `#todo`
# heartbeat). New boards should not depend on it. See handoff-todo.sh
# for the same notice on the bash side.

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$runner = Join-Path $PSScriptRoot "invoke-runtime-sh.ps1"
& $runner -ScriptName "handoff-todo.sh" @RemainingArgs
exit $LASTEXITCODE
