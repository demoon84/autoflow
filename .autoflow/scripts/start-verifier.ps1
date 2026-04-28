[CmdletBinding()]
param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$RemainingArgs
)

# DEPRECATED: legacy verifier runtime (Windows wrapper).
#
# In the 3-runner topology (planner-1 + owner-1 + wiki-1), Impl AI
# (`owner-1`) runs AI-led verification inline via
# `verify-ticket-owner.*` and decides pass/fail based on the
# evidence. There is no separate verifier worker.
#
# This wrapper is kept reachable as `autoflow run verifier` (and the
# `#veri` heartbeat) only for backwards compatibility. New boards
# should use the ticket-owner flow instead. See start-verifier.sh for
# the same notice on the bash side.

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$runner = Join-Path $PSScriptRoot "invoke-runtime-sh.ps1"
& $runner -ScriptName "start-verifier.sh" @RemainingArgs
exit $LASTEXITCODE
