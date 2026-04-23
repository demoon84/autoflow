[CmdletBinding()]
param(
  [Parameter(Position = 0)]
  [string]$ProjectRoot,

  [Parameter(Position = 1)]
  [string]$BoardDirName = "autoflow"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "package-board-common.ps1")

if (-not $ProjectRoot) {
  throw "Usage: upgrade-project.ps1 /path/to/project [board-dir-name]"
}

$targetProjectRoot = Resolve-ProjectRootOrThrow $ProjectRoot
$targetBoardRoot = Join-Path $targetProjectRoot $BoardDirName
$hostAgentsPath = Join-Path $targetProjectRoot "AGENTS.md"

Ensure-PackageTemplatesPresent

if (-not (Test-BoardAlreadyInitialized $targetBoardRoot)) {
  throw "Board is not initialized: $targetBoardRoot"
}

Ensure-BoardDirectories -BoardRoot $targetBoardRoot

$timestamp = (Get-Date).ToUniversalTime().ToString("yyyyMMddTHHmmssZ")
$backupRoot = Join-Path $targetBoardRoot ".autoflow-upgrade-backups/$timestamp"
$previousBoardVersion = Get-BoardVersionValue $targetBoardRoot
if (-not $previousBoardVersion) {
  $previousBoardVersion = "unknown"
}

$script:managedCreatedCount = 0
$script:managedUpdatedCount = 0
$script:managedUnchangedCount = 0
$script:backupCount = 0

function Record-SyncAction {
  param([string]$Action)

  switch ($Action) {
    "created" { $script:managedCreatedCount += 1 }
    "updated" { $script:managedUpdatedCount += 1 }
    "unchanged" { $script:managedUnchangedCount += 1 }
    default { throw "Unknown sync action: $Action" }
  }

  if ($script:SyncBackupCreated) {
    $script:backupCount += 1
  }
}

if (Test-Path -LiteralPath $hostAgentsPath -PathType Leaf) {
  $hostAgentsAction = "preserved"
  $script:SyncActionResult = "unchanged"
}
else {
  Sync-HostAgentsFile -TargetFile $hostAgentsPath -BoardDirName $BoardDirName -BackupRoot $backupRoot
  $hostAgentsAction = $script:SyncActionResult
}
Record-SyncAction $script:SyncActionResult

foreach ($asset in (Get-ManagedBoardAssetEntries)) {
  Sync-BoardAsset -BoardRoot $targetBoardRoot -BoardDirName $BoardDirName -AssetKind $asset.Kind -SourceRel $asset.SourceRel -TargetRel $asset.TargetRel -BackupRoot $backupRoot
  Record-SyncAction $script:SyncActionResult
}

Write-ProjectRootMarker -BoardRoot $targetBoardRoot -BackupRoot $backupRoot
Record-SyncAction $script:SyncActionResult

Write-BoardVersionMarker -BoardRoot $targetBoardRoot -BackupRoot $backupRoot
Record-SyncAction $script:SyncActionResult

$status = "already_current"
if ($script:managedCreatedCount -gt 0 -or $script:managedUpdatedCount -gt 0) {
  $status = "upgraded"
}

if ($script:backupCount -eq 0 -and (Test-Path -LiteralPath $backupRoot -PathType Container)) {
  Remove-Item -LiteralPath $backupRoot -Recurse -Force -ErrorAction SilentlyContinue
  $parent = Split-Path -Parent $backupRoot
  if ($parent) {
    Remove-Item -LiteralPath $parent -Force -ErrorAction SilentlyContinue
  }
}

$currentBoardVersion = Get-BoardVersionValue $targetBoardRoot
if (-not $currentBoardVersion) {
  $currentBoardVersion = Get-PackageVersionValue
}

Write-KeyValueLine "project_root" $targetProjectRoot
Write-KeyValueLine "board_root" $targetBoardRoot
Write-KeyValueLine "board_dir_name" $BoardDirName
Write-KeyValueLine "status" $status
Write-KeyValueLine "previous_board_version" $previousBoardVersion
Write-KeyValueLine "current_board_version" $currentBoardVersion
Write-KeyValueLine "package_version" (Get-PackageVersionValue)
Write-KeyValueLine "host_agents_action" $hostAgentsAction
Write-KeyValueLine "managed_files_created" ([string]$script:managedCreatedCount)
Write-KeyValueLine "managed_files_updated" ([string]$script:managedUpdatedCount)
Write-KeyValueLine "managed_files_unchanged" ([string]$script:managedUnchangedCount)
Write-KeyValueLine "backups_created" ([string]$script:backupCount)
if ($script:backupCount -gt 0) {
  Write-KeyValueLine "backup_root" $backupRoot
}
else {
  Write-KeyValueLine "backup_root" ""
}
