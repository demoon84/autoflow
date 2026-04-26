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
  throw "Usage: scaffold-project.ps1 /path/to/project [board-dir-name]"
}
if (-not $BoardDirName) {
  $BoardDirName = Get-DefaultBoardDirName
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
$hostClaudePath = Join-Path $targetProjectRoot "CLAUDE.md"
$hostAgentsAction = "unchanged"
if (-not (Test-Path -LiteralPath $hostAgentsPath -PathType Leaf)) {
  Sync-HostAgentsFile -TargetFile $hostAgentsPath -BoardDirName $BoardDirName
  $hostAgentsAction = $script:SyncActionResult
}
$hostClaudeAction = "unchanged"
if (-not (Test-Path -LiteralPath $hostClaudePath -PathType Leaf)) {
  Sync-HostClaudeFile -TargetFile $hostClaudePath -BoardDirName $BoardDirName
  $hostClaudeAction = $script:SyncActionResult
}

function Record-HostSkillAction {
  param([string]$Action)

  switch ($Action) {
    "created" { $script:hostSkillsCreatedCount += 1 }
    "updated" { $script:hostSkillsUpdatedCount += 1 }
    "unchanged" { $script:hostSkillsUnchangedCount += 1 }
    "preserved" { $script:hostSkillsPreservedCount += 1 }
    default { throw "Unknown host skill sync action: $Action" }
  }
}

$script:hostSkillsCreatedCount = 0
$script:hostSkillsUpdatedCount = 0
$script:hostSkillsUnchangedCount = 0
$script:hostSkillsPreservedCount = 0
foreach ($asset in (Get-ManagedHostSkillAssetEntries)) {
  Sync-HostSkillAssetIfMissing -TargetProjectRoot $targetProjectRoot -BoardDirName $BoardDirName -AssetKind $asset.Kind -SourceRel $asset.SourceRel -TargetRel $asset.TargetRel
  Record-HostSkillAction $script:SyncActionResult
}

Write-KeyValueLine "project_root" $targetProjectRoot
Write-KeyValueLine "board_root" $targetBoardRoot
Write-KeyValueLine "host_agents" $hostAgentsPath
Write-KeyValueLine "host_agents_action" $hostAgentsAction
Write-KeyValueLine "host_claude" $hostClaudePath
Write-KeyValueLine "host_claude_action" $hostClaudeAction
Write-KeyValueLine "host_skills_created" ([string]$script:hostSkillsCreatedCount)
Write-KeyValueLine "host_skills_updated" ([string]$script:hostSkillsUpdatedCount)
Write-KeyValueLine "host_skills_unchanged" ([string]$script:hostSkillsUnchangedCount)
Write-KeyValueLine "host_skills_preserved" ([string]$script:hostSkillsPreservedCount)
Write-KeyValueLine "board_version" (Get-PackageVersionValue)
Write-KeyValueLine "status" $status
