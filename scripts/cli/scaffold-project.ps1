[CmdletBinding()]
param(
  [Parameter(Position = 0)]
  [string]$ProjectRoot,

  [Parameter(Position = 1)]
  [string]$BoardDirName = ".autoflow"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "package-board-common.ps1")

if (-not $ProjectRoot) {
  throw "Usage: scaffold-project.ps1 /path/to/project [board-dir-name]"
}

$targetProjectRootInput = $ProjectRoot
if (Test-Path -LiteralPath $targetProjectRootInput -PathType Container) {
  $targetProjectRoot = (Resolve-Path -LiteralPath $targetProjectRootInput).Path
}
else {
  New-Item -ItemType Directory -Force -Path $targetProjectRootInput | Out-Null
  $targetProjectRoot = (Resolve-Path -LiteralPath $targetProjectRootInput).Path
}

$targetBoardRoot = Join-Path $targetProjectRoot $BoardDirName
Ensure-PackageTemplatesPresent

$status = "initialized"
if ((Test-Path -LiteralPath $targetBoardRoot -PathType Container) -and (Test-BoardDirHasEntries $targetBoardRoot)) {
  if (Test-BoardAlreadyInitialized $targetBoardRoot) {
    $status = "already_initialized"
  }
  else {
    throw "Target board directory exists and is not empty: $targetBoardRoot"
  }
}

if ($status -eq "initialized") {
  New-Item -ItemType Directory -Force -Path $targetBoardRoot | Out-Null
  Ensure-BoardDirectories -BoardRoot $targetBoardRoot

  foreach ($asset in (Get-ManagedBoardAssetEntries)) {
    Sync-BoardAsset -BoardRoot $targetBoardRoot -BoardDirName $BoardDirName -AssetKind $asset.Kind -SourceRel $asset.SourceRel -TargetRel $asset.TargetRel
  }

  foreach ($asset in (Get-StarterBoardStateAssetEntries)) {
    Sync-BoardAsset -BoardRoot $targetBoardRoot -BoardDirName $BoardDirName -AssetKind $asset.Kind -SourceRel $asset.SourceRel -TargetRel $asset.TargetRel
  }

  Write-ProjectRootMarker -BoardRoot $targetBoardRoot
  Write-BoardVersionMarker -BoardRoot $targetBoardRoot
}

$hostAgentsPath = Join-Path $targetProjectRoot "AGENTS.md"
$hostAgentsAction = "unchanged"
if (-not (Test-Path -LiteralPath $hostAgentsPath -PathType Leaf)) {
  Sync-HostAgentsFile -TargetFile $hostAgentsPath -BoardDirName $BoardDirName
  $hostAgentsAction = $script:SyncActionResult
}

Write-KeyValueLine "project_root" $targetProjectRoot
Write-KeyValueLine "board_root" $targetBoardRoot
Write-KeyValueLine "host_agents" $hostAgentsPath
Write-KeyValueLine "host_agents_action" $hostAgentsAction
Write-KeyValueLine "board_version" (Get-PackageVersionValue)
Write-KeyValueLine "status" $status
