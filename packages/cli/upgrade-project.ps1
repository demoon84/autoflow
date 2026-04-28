[CmdletBinding()]
param(
  [Parameter(Position = 0)]
  [string]$ProjectRoot,

  [Parameter(Position = 1)]
  [string]$BoardDirName = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "package-board-common.ps1")

if (-not $ProjectRoot) {
  throw "Usage: upgrade-project.ps1 /path/to/project [board-dir-name]"
}
if (-not $BoardDirName) {
  $BoardDirName = Get-DefaultBoardDirName
}

$targetProjectRoot = Resolve-ProjectRootOrThrow $ProjectRoot
$targetBoardRoot = Join-Path $targetProjectRoot $BoardDirName
$hostAgentsPath = Join-Path $targetProjectRoot "AGENTS.md"
$hostClaudePath = Join-Path $targetProjectRoot "CLAUDE.md"

Ensure-PackageTemplatesPresent

if (-not (Test-BoardAlreadyInitialized $targetBoardRoot)) {
  throw "Board is not initialized: $targetBoardRoot"
}

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
$script:scaffoldDirectoriesCreatedCount = 0
$script:scaffoldDirectoriesPresentCount = 0
$script:scaffoldFilesCreatedCount = 0
$script:scaffoldFilesPresentCount = 0
$script:hostSkillsCreatedCount = 0
$script:hostSkillsUpdatedCount = 0
$script:hostSkillsUnchangedCount = 0

function Get-UpgradeScaffoldDirectoryEntries {
  return @(
    "agents/adapters"
    "conversations"
    "tickets/inbox"
    "rules/wiki"
    "runners"
    "runners/state"
    "runners/logs"
    "metrics"
    "wiki"
    "wiki/decisions"
    "wiki/features"
    "wiki/architecture"
    "wiki/learnings"
  )
}

function Test-UpgradeScaffoldAsset {
  param([string]$TargetRel)

  return (
    $TargetRel -like "agents/adapters/*" -or
    $TargetRel -eq "conversations/README.md" -or
    $TargetRel -like "rules/wiki/*" -or
    $TargetRel -like "runners/*" -or
    $TargetRel -like "metrics/*" -or
    $TargetRel -like "wiki/*"
  )
}

function Count-UpgradeScaffoldDirectories {
  foreach ($relativeDir in (Get-UpgradeScaffoldDirectoryEntries)) {
    $directoryPath = Join-Path $targetBoardRoot $relativeDir
    if (Test-Path -LiteralPath $directoryPath -PathType Container) {
      $script:scaffoldDirectoriesPresentCount += 1
    }
    else {
      $script:scaffoldDirectoriesCreatedCount += 1
    }
  }
}

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

function Record-ScaffoldSyncAction {
  param(
    [string]$TargetRel,
    [string]$Action
  )

  if (-not (Test-UpgradeScaffoldAsset $TargetRel)) {
    return
  }

  switch ($Action) {
    "created" { $script:scaffoldFilesCreatedCount += 1 }
    "unchanged" { $script:scaffoldFilesPresentCount += 1 }
  }
}

function Record-HostSkillSyncAction {
  param([string]$Action)

  switch ($Action) {
    "created" { $script:hostSkillsCreatedCount += 1 }
    "updated" { $script:hostSkillsUpdatedCount += 1 }
    "unchanged" { $script:hostSkillsUnchangedCount += 1 }
    default { throw "Unknown host skill sync action: $Action" }
  }
}

function Normalize-UpgradeAssetTempFile {
  param([string]$TempFile)

  $content = Get-Content -LiteralPath $TempFile -Raw -ErrorAction Stop
  $content = $content.Replace(".autoflow/tickets/runs/", ".autoflow/tickets/inprogress/")
  $content = $content.Replace("tickets/runs/", "tickets/inprogress/")
  Write-Utf8File -Path $TempFile -Content $content
}

function Sync-BoardAssetForUpgrade {
  param(
    [string]$BoardRoot,
    [string]$BoardDirName,
    [string]$AssetKind,
    [string]$SourceRel,
    [string]$TargetRel,
    [string]$BackupRoot = ""
  )

  $tempFile = New-AssetTempFile -AssetKind $AssetKind -SourceRel $SourceRel -BoardDirName $BoardDirName
  try {
    Normalize-UpgradeAssetTempFile -TempFile $tempFile
    Sync-TempFile -TempFile $tempFile -TargetFile (Join-Path $BoardRoot $TargetRel) -BackupRoot $BackupRoot -BackupRelative $TargetRel -Executable:($AssetKind -eq "source_executable")
  }
  finally {
    Remove-Item -LiteralPath $tempFile -Force -ErrorAction SilentlyContinue
  }
}

Count-UpgradeScaffoldDirectories
Ensure-BoardDirectories -BoardRoot $targetBoardRoot

if (Test-Path -LiteralPath $hostAgentsPath -PathType Leaf) {
  $hostAgentsAction = "preserved"
  $script:SyncActionResult = "unchanged"
}
else {
  $hostAgentsAction = "absent"
  $script:SyncBackupCreated = $false
  $script:SyncActionResult = "unchanged"
}
Record-SyncAction $script:SyncActionResult

$hostClaudeAction = "unchanged"
if (Test-Path -LiteralPath $hostClaudePath -PathType Leaf) {
  $hostClaudeAction = "preserved"
  $script:SyncActionResult = "unchanged"
}
elseif (Test-Path -LiteralPath $hostAgentsPath -PathType Leaf) {
  Sync-HostClaudeFile -TargetFile $hostClaudePath -BoardDirName $BoardDirName -BackupRoot $backupRoot
  $hostClaudeAction = $script:SyncActionResult
}
else {
  $hostClaudeAction = "absent"
  $script:SyncBackupCreated = $false
  $script:SyncActionResult = "unchanged"
}
Record-SyncAction $script:SyncActionResult

foreach ($asset in (Get-ManagedHostSkillAssetEntries)) {
  Sync-HostSkillAsset -TargetProjectRoot $targetProjectRoot -BoardDirName $BoardDirName -AssetKind $asset.Kind -SourceRel $asset.SourceRel -TargetRel $asset.TargetRel -BackupRoot $backupRoot
  Record-SyncAction $script:SyncActionResult
  Record-HostSkillSyncAction $script:SyncActionResult
}

foreach ($asset in (Get-ManagedBoardAssetEntries)) {
  $targetFile = Join-Path $targetBoardRoot $asset.TargetRel
  if ((Test-UpgradeScaffoldAsset $asset.TargetRel) -and (Test-Path -LiteralPath $targetFile -PathType Leaf)) {
    $script:SyncBackupCreated = $false
    $script:SyncActionResult = "unchanged"
    Record-SyncAction $script:SyncActionResult
    Record-ScaffoldSyncAction -TargetRel $asset.TargetRel -Action $script:SyncActionResult
    continue
  }
  Sync-BoardAssetForUpgrade -BoardRoot $targetBoardRoot -BoardDirName $BoardDirName -AssetKind $asset.Kind -SourceRel $asset.SourceRel -TargetRel $asset.TargetRel -BackupRoot $backupRoot
  Record-SyncAction $script:SyncActionResult
  Record-ScaffoldSyncAction -TargetRel $asset.TargetRel -Action $script:SyncActionResult
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
Write-KeyValueLine "host_claude_action" $hostClaudeAction
Write-KeyValueLine "host_skills_created" ([string]$script:hostSkillsCreatedCount)
Write-KeyValueLine "host_skills_updated" ([string]$script:hostSkillsUpdatedCount)
Write-KeyValueLine "host_skills_unchanged" ([string]$script:hostSkillsUnchangedCount)
Write-KeyValueLine "managed_files_created" ([string]$script:managedCreatedCount)
Write-KeyValueLine "managed_files_updated" ([string]$script:managedUpdatedCount)
Write-KeyValueLine "managed_files_unchanged" ([string]$script:managedUnchangedCount)
Write-KeyValueLine "scaffold_directories_created" ([string]$script:scaffoldDirectoriesCreatedCount)
Write-KeyValueLine "scaffold_directories_present" ([string]$script:scaffoldDirectoriesPresentCount)
Write-KeyValueLine "scaffold_files_created" ([string]$script:scaffoldFilesCreatedCount)
Write-KeyValueLine "scaffold_files_present" ([string]$script:scaffoldFilesPresentCount)
Write-KeyValueLine "backups_created" ([string]$script:backupCount)
if ($script:backupCount -gt 0) {
  Write-KeyValueLine "backup_root" $backupRoot
}
else {
  Write-KeyValueLine "backup_root" ""
}
