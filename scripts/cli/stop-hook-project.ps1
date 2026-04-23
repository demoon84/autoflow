[CmdletBinding()]
param(
  [Parameter(Position = 0)]
  [ValidateSet("install", "remove", "status")]
  [string]$Action = "install",

  [Parameter(Position = 1)]
  [string]$ProjectRoot = ".",

  [Parameter(Position = 2)]
  [string]$BoardDirName = "autoflow"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "cli-common.ps1")

$resolvedProjectRoot = Resolve-ProjectRootOrThrow $ProjectRoot
$boardRoot = Get-BoardRootPath -ProjectRoot $resolvedProjectRoot -BoardDirName $BoardDirName
$runtimeScript = Join-Path $boardRoot "scripts/install-stop-hook.ps1"

if (-not (Test-Path -LiteralPath $runtimeScript -PathType Leaf)) {
  throw "Board stop-hook installer script is missing: $runtimeScript"
}

& $runtimeScript $Action
exit $LASTEXITCODE
