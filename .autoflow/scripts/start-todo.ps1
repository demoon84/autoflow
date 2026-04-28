[CmdletBinding()]
param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$RemainingArgs
)

# DEPRECATED: legacy todo runtime (Windows wrapper).
#
# In the 3-runner topology (planner-1 + owner-1 + wiki-1), Impl AI
# (`owner-1`) claims directly from `tickets/todo/` via
# `start-ticket-owner.*`, implements, verifies, and merges in one
# flow. There is no separate todo worker.
#
# This wrapper is kept reachable as `autoflow run todo` (and the
# `#todo` heartbeat) only for backwards compatibility. New boards
# should use the ticket-owner flow instead. See start-todo.sh for
# the same notice on the bash side.

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$runner = Join-Path $PSScriptRoot "invoke-runtime-sh.ps1"
& $runner -ScriptName "start-todo.sh" @RemainingArgs
exit $LASTEXITCODE
