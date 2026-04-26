Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "cli-common.ps1")

$script:SyncActionResult = ""
$script:SyncBackupCreated = $false

function Join-RepoRelativePath {
  param([string]$PathValue)

  if ([System.IO.Path]::IsPathRooted($PathValue)) {
    return $PathValue
  }

  return (Join-Path $script:AutoflowRepoRoot $PathValue)
}

$script:TemplateBoardRoot = Join-RepoRelativePath (Get-ScaffoldManifestValue -Section "sources" -Name "board" -DefaultValue "scaffold/board")
$script:HostAgentsTemplatePath = Join-RepoRelativePath (Get-ScaffoldManifestValue -Section "sources" -Name "host" -DefaultValue "scaffold/host/AGENTS.md")
$script:HostClaudeTemplatePath = Join-RepoRelativePath (Get-ScaffoldManifestValue -Section "sources" -Name "host_claude" -DefaultValue "scaffold/host/CLAUDE.md")
$script:ClaudeSkillsRoot = Join-RepoRelativePath (Get-ScaffoldManifestValue -Section "sources" -Name "claude_skills" -DefaultValue "integrations/claude/skills")
$script:CodexSkillsRoot = Join-RepoRelativePath (Get-ScaffoldManifestValue -Section "sources" -Name "codex_skills" -DefaultValue "integrations/codex/skills")
$script:RuntimeScriptsRoot = Join-RepoRelativePath (Get-ScaffoldManifestValue -Section "sources" -Name "runtime_scripts" -DefaultValue "runtime/board-scripts")

function Ensure-PackageTemplatesPresent {
  if (-not (Test-Path -LiteralPath $script:TemplateBoardRoot -PathType Container)) {
    throw "Template board root not found: $script:TemplateBoardRoot"
  }

  if (-not (Test-Path -LiteralPath $script:RuntimeScriptsRoot -PathType Container)) {
    throw "Runtime scripts root not found: $script:RuntimeScriptsRoot"
  }

  if (-not (Test-Path -LiteralPath $script:ClaudeSkillsRoot -PathType Container)) {
    throw "Claude skills root not found: $script:ClaudeSkillsRoot"
  }

  if (-not (Test-Path -LiteralPath $script:CodexSkillsRoot -PathType Container)) {
    throw "Codex skills root not found: $script:CodexSkillsRoot"
  }
}

function Test-BoardDirHasEntries {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path -PathType Container)) {
    return $false
  }

  return $null -ne (Get-ChildItem -Force -LiteralPath $Path | Select-Object -First 1)
}

function Test-BoardAlreadyInitialized {
  param([string]$BoardRoot)

  return (Test-Path -LiteralPath (Join-Path $BoardRoot "AGENTS.md") -PathType Leaf) -and
    (Test-Path -LiteralPath (Join-Path $BoardRoot "tickets") -PathType Container) -and
    (
      (Test-Path -LiteralPath (Join-Path $BoardRoot "tickets/backlog") -PathType Container) -or
      (Test-Path -LiteralPath (Join-Path $BoardRoot "rules/spec") -PathType Container)
    )
}

function Render-TextContent {
  param(
    [string]$SourceFile,
    [string]$BoardDirName
  )

  $content = Get-FileContentRawSafe $SourceFile
  return $content.Replace("{{BOARD_DIR}}", $BoardDirName)
}

function Get-ManagedBoardAssetEntries {
  return @(
    [pscustomobject]@{ Kind = "template_text"; SourceRel = "AGENTS.md"; TargetRel = "AGENTS.md" }
    [pscustomobject]@{ Kind = "template_text"; SourceRel = "README.md"; TargetRel = "README.md" }
    [pscustomobject]@{ Kind = "template_text"; SourceRel = "agents/adapters/README.md"; TargetRel = "agents/adapters/README.md" }
    [pscustomobject]@{ Kind = "template_text"; SourceRel = "agents/adapters/shell.md"; TargetRel = "agents/adapters/shell.md" }
    [pscustomobject]@{ Kind = "template_text"; SourceRel = "agents/adapters/codex-cli.md"; TargetRel = "agents/adapters/codex-cli.md" }
    [pscustomobject]@{ Kind = "template_text"; SourceRel = "agents/adapters/claude-cli.md"; TargetRel = "agents/adapters/claude-cli.md" }
    [pscustomobject]@{ Kind = "template_text"; SourceRel = "agents/adapters/opencode.md"; TargetRel = "agents/adapters/opencode.md" }
    [pscustomobject]@{ Kind = "template_text"; SourceRel = "agents/adapters/gemini-cli.md"; TargetRel = "agents/adapters/gemini-cli.md" }
    [pscustomobject]@{ Kind = "template_text"; SourceRel = "agents/plan-to-ticket-agent.md"; TargetRel = "agents/plan-to-ticket-agent.md" }
    [pscustomobject]@{ Kind = "template_text"; SourceRel = "agents/todo-queue-agent.md"; TargetRel = "agents/todo-queue-agent.md" }
    [pscustomobject]@{ Kind = "template_text"; SourceRel = "agents/verifier-agent.md"; TargetRel = "agents/verifier-agent.md" }
    [pscustomobject]@{ Kind = "template_text"; SourceRel = "agents/spec-author-agent.md"; TargetRel = "agents/spec-author-agent.md" }
    [pscustomobject]@{ Kind = "template_text"; SourceRel = "agents/ticket-owner-agent.md"; TargetRel = "agents/ticket-owner-agent.md" }
    [pscustomobject]@{ Kind = "template_text"; SourceRel = "agents/merge-bot-agent.md"; TargetRel = "agents/merge-bot-agent.md" }
    [pscustomobject]@{ Kind = "template_text"; SourceRel = "agents/wiki-maintainer-agent.md"; TargetRel = "agents/wiki-maintainer-agent.md" }
    [pscustomobject]@{ Kind = "template_text"; SourceRel = "conversations/README.md"; TargetRel = "conversations/README.md" }
    [pscustomobject]@{ Kind = "template_text"; SourceRel = "automations/README.md"; TargetRel = "automations/README.md" }
    [pscustomobject]@{ Kind = "template_text"; SourceRel = "automations/file-watch.psd1"; TargetRel = "automations/file-watch.psd1" }
    [pscustomobject]@{ Kind = "template_text"; SourceRel = "automations/state/README.md"; TargetRel = "automations/state/README.md" }
    [pscustomobject]@{ Kind = "template_text"; SourceRel = "automations/state/.gitignore"; TargetRel = "automations/state/.gitignore" }
    [pscustomobject]@{ Kind = "template_text"; SourceRel = "automations/templates/heartbeat-set.template.toml"; TargetRel = "automations/templates/heartbeat-set.template.toml" }
    [pscustomobject]@{ Kind = "template_text"; SourceRel = "automations/templates/ticket-owner-heartbeat.template.toml"; TargetRel = "automations/templates/ticket-owner-heartbeat.template.toml" }
    [pscustomobject]@{ Kind = "template_text"; SourceRel = "automations/templates/plan-heartbeat.template.toml"; TargetRel = "automations/templates/plan-heartbeat.template.toml" }
    [pscustomobject]@{ Kind = "template_text"; SourceRel = "automations/templates/todo-heartbeat.template.toml"; TargetRel = "automations/templates/todo-heartbeat.template.toml" }
    [pscustomobject]@{ Kind = "template_text"; SourceRel = "automations/templates/verifier-heartbeat.template.toml"; TargetRel = "automations/templates/verifier-heartbeat.template.toml" }
    [pscustomobject]@{ Kind = "template_text"; SourceRel = "rules/README.md"; TargetRel = "rules/README.md" }
    [pscustomobject]@{ Kind = "template_text"; SourceRel = "rules/wiki/README.md"; TargetRel = "rules/wiki/README.md" }
    [pscustomobject]@{ Kind = "template_text"; SourceRel = "rules/wiki/page-template.md"; TargetRel = "rules/wiki/page-template.md" }
    [pscustomobject]@{ Kind = "template_text"; SourceRel = "rules/wiki/lint-checklist.md"; TargetRel = "rules/wiki/lint-checklist.md" }
    [pscustomobject]@{ Kind = "template_text"; SourceRel = "reference/README.md"; TargetRel = "reference/README.md" }
    [pscustomobject]@{ Kind = "template_text"; SourceRel = "reference/backlog.md"; TargetRel = "reference/backlog.md" }
    [pscustomobject]@{ Kind = "template_text"; SourceRel = "reference/backlog-processed.md"; TargetRel = "reference/backlog-processed.md" }
    [pscustomobject]@{ Kind = "template_text"; SourceRel = "reference/project-spec-template.md"; TargetRel = "reference/project-spec-template.md" }
    [pscustomobject]@{ Kind = "template_text"; SourceRel = "reference/feature-spec-template.md"; TargetRel = "reference/feature-spec-template.md" }
    [pscustomobject]@{ Kind = "template_text"; SourceRel = "reference/tickets-board.md"; TargetRel = "reference/tickets-board.md" }
    [pscustomobject]@{ Kind = "template_text"; SourceRel = "reference/ticket-template.md"; TargetRel = "reference/ticket-template.md" }
    [pscustomobject]@{ Kind = "template_text"; SourceRel = "reference/plan.md"; TargetRel = "reference/plan.md" }
    [pscustomobject]@{ Kind = "template_text"; SourceRel = "reference/plan-template.md"; TargetRel = "reference/plan-template.md" }
    [pscustomobject]@{ Kind = "template_text"; SourceRel = "reference/roadmap.md"; TargetRel = "reference/roadmap.md" }
    [pscustomobject]@{ Kind = "template_text"; SourceRel = "reference/runner-harness.md"; TargetRel = "reference/runner-harness.md" }
    [pscustomobject]@{ Kind = "template_text"; SourceRel = "reference/wiki.md"; TargetRel = "reference/wiki.md" }
    [pscustomobject]@{ Kind = "template_text"; SourceRel = "reference/logs.md"; TargetRel = "reference/logs.md" }
    [pscustomobject]@{ Kind = "template_text"; SourceRel = "reference/hook-logs.md"; TargetRel = "reference/hook-logs.md" }
    [pscustomobject]@{ Kind = "template_text"; SourceRel = "runners/README.md"; TargetRel = "runners/README.md" }
    [pscustomobject]@{ Kind = "template_text"; SourceRel = "runners/config.toml"; TargetRel = "runners/config.toml" }
    [pscustomobject]@{ Kind = "template_text"; SourceRel = "runners/state/README.md"; TargetRel = "runners/state/README.md" }
    [pscustomobject]@{ Kind = "template_text"; SourceRel = "runners/state/.gitignore"; TargetRel = "runners/state/.gitignore" }
    [pscustomobject]@{ Kind = "template_text"; SourceRel = "runners/logs/README.md"; TargetRel = "runners/logs/README.md" }
    [pscustomobject]@{ Kind = "template_text"; SourceRel = "runners/logs/.gitignore"; TargetRel = "runners/logs/.gitignore" }
    [pscustomobject]@{ Kind = "template_text"; SourceRel = "metrics/README.md"; TargetRel = "metrics/README.md" }
    [pscustomobject]@{ Kind = "template_text"; SourceRel = "metrics/.gitignore"; TargetRel = "metrics/.gitignore" }
    [pscustomobject]@{ Kind = "template_text"; SourceRel = "wiki/index.md"; TargetRel = "wiki/index.md" }
    [pscustomobject]@{ Kind = "template_text"; SourceRel = "wiki/log.md"; TargetRel = "wiki/log.md" }
    [pscustomobject]@{ Kind = "template_text"; SourceRel = "wiki/project-overview.md"; TargetRel = "wiki/project-overview.md" }
    [pscustomobject]@{ Kind = "template_text"; SourceRel = "wiki/decisions/README.md"; TargetRel = "wiki/decisions/README.md" }
    [pscustomobject]@{ Kind = "template_text"; SourceRel = "wiki/features/README.md"; TargetRel = "wiki/features/README.md" }
    [pscustomobject]@{ Kind = "template_text"; SourceRel = "wiki/architecture/README.md"; TargetRel = "wiki/architecture/README.md" }
    [pscustomobject]@{ Kind = "template_text"; SourceRel = "wiki/learnings/README.md"; TargetRel = "wiki/learnings/README.md" }
    [pscustomobject]@{ Kind = "runtime_executable"; SourceRel = "common.sh"; TargetRel = "scripts/common.sh" }
    [pscustomobject]@{ Kind = "runtime_executable"; SourceRel = "runner-common.sh"; TargetRel = "scripts/runner-common.sh" }
    [pscustomobject]@{ Kind = "runtime_executable"; SourceRel = "check-stop.sh"; TargetRel = "scripts/check-stop.sh" }
    [pscustomobject]@{ Kind = "runtime_executable"; SourceRel = "file-watch-common.sh"; TargetRel = "scripts/file-watch-common.sh" }
    [pscustomobject]@{ Kind = "runtime_executable"; SourceRel = "install-stop-hook.sh"; TargetRel = "scripts/install-stop-hook.sh" }
    [pscustomobject]@{ Kind = "runtime_executable"; SourceRel = "run-hook.sh"; TargetRel = "scripts/run-hook.sh" }
    [pscustomobject]@{ Kind = "runtime_executable"; SourceRel = "set-thread-context.sh"; TargetRel = "scripts/set-thread-context.sh" }
    [pscustomobject]@{ Kind = "runtime_executable"; SourceRel = "clear-thread-context.sh"; TargetRel = "scripts/clear-thread-context.sh" }
    [pscustomobject]@{ Kind = "runtime_executable"; SourceRel = "start-ticket-owner.sh"; TargetRel = "scripts/start-ticket-owner.sh" }
    [pscustomobject]@{ Kind = "runtime_executable"; SourceRel = "verify-ticket-owner.sh"; TargetRel = "scripts/verify-ticket-owner.sh" }
    [pscustomobject]@{ Kind = "runtime_executable"; SourceRel = "finish-ticket-owner.sh"; TargetRel = "scripts/finish-ticket-owner.sh" }
    [pscustomobject]@{ Kind = "runtime_executable"; SourceRel = "merge-ready-ticket.sh"; TargetRel = "scripts/merge-ready-ticket.sh" }
    [pscustomobject]@{ Kind = "runtime_executable"; SourceRel = "update-wiki.sh"; TargetRel = "scripts/update-wiki.sh" }
    [pscustomobject]@{ Kind = "runtime_executable"; SourceRel = "start-plan.sh"; TargetRel = "scripts/start-plan.sh" }
    [pscustomobject]@{ Kind = "runtime_executable"; SourceRel = "start-todo.sh"; TargetRel = "scripts/start-todo.sh" }
    [pscustomobject]@{ Kind = "runtime_executable"; SourceRel = "handoff-todo.sh"; TargetRel = "scripts/handoff-todo.sh" }
    [pscustomobject]@{ Kind = "runtime_executable"; SourceRel = "start-verifier.sh"; TargetRel = "scripts/start-verifier.sh" }
    [pscustomobject]@{ Kind = "runtime_executable"; SourceRel = "start-spec.sh"; TargetRel = "scripts/start-spec.sh" }
    [pscustomobject]@{ Kind = "runtime_executable"; SourceRel = "integrate-worktree.sh"; TargetRel = "scripts/integrate-worktree.sh" }
    [pscustomobject]@{ Kind = "runtime_file"; SourceRel = "invoke-runtime-sh.ps1"; TargetRel = "scripts/invoke-runtime-sh.ps1" }
    [pscustomobject]@{ Kind = "runtime_file"; SourceRel = "runner-common.ps1"; TargetRel = "scripts/runner-common.ps1" }
    [pscustomobject]@{ Kind = "runtime_file"; SourceRel = "codex-stop-hook.ps1"; TargetRel = "scripts/codex-stop-hook.ps1" }
    [pscustomobject]@{ Kind = "runtime_file"; SourceRel = "check-stop.ps1"; TargetRel = "scripts/check-stop.ps1" }
    [pscustomobject]@{ Kind = "runtime_file"; SourceRel = "install-stop-hook.ps1"; TargetRel = "scripts/install-stop-hook.ps1" }
    [pscustomobject]@{ Kind = "runtime_file"; SourceRel = "set-thread-context.ps1"; TargetRel = "scripts/set-thread-context.ps1" }
    [pscustomobject]@{ Kind = "runtime_file"; SourceRel = "clear-thread-context.ps1"; TargetRel = "scripts/clear-thread-context.ps1" }
    [pscustomobject]@{ Kind = "runtime_file"; SourceRel = "start-ticket-owner.ps1"; TargetRel = "scripts/start-ticket-owner.ps1" }
    [pscustomobject]@{ Kind = "runtime_file"; SourceRel = "verify-ticket-owner.ps1"; TargetRel = "scripts/verify-ticket-owner.ps1" }
    [pscustomobject]@{ Kind = "runtime_file"; SourceRel = "finish-ticket-owner.ps1"; TargetRel = "scripts/finish-ticket-owner.ps1" }
    [pscustomobject]@{ Kind = "runtime_file"; SourceRel = "merge-ready-ticket.ps1"; TargetRel = "scripts/merge-ready-ticket.ps1" }
    [pscustomobject]@{ Kind = "runtime_file"; SourceRel = "start-spec.ps1"; TargetRel = "scripts/start-spec.ps1" }
    [pscustomobject]@{ Kind = "runtime_file"; SourceRel = "start-plan.ps1"; TargetRel = "scripts/start-plan.ps1" }
    [pscustomobject]@{ Kind = "runtime_file"; SourceRel = "start-todo.ps1"; TargetRel = "scripts/start-todo.ps1" }
    [pscustomobject]@{ Kind = "runtime_file"; SourceRel = "handoff-todo.ps1"; TargetRel = "scripts/handoff-todo.ps1" }
    [pscustomobject]@{ Kind = "runtime_file"; SourceRel = "start-verifier.ps1"; TargetRel = "scripts/start-verifier.ps1" }
    [pscustomobject]@{ Kind = "runtime_file"; SourceRel = "integrate-worktree.ps1"; TargetRel = "scripts/integrate-worktree.ps1" }
    [pscustomobject]@{ Kind = "runtime_file"; SourceRel = "write-verifier-log.ps1"; TargetRel = "scripts/write-verifier-log.ps1" }
    [pscustomobject]@{ Kind = "runtime_file"; SourceRel = "run-hook.ps1"; TargetRel = "scripts/run-hook.ps1" }
    [pscustomobject]@{ Kind = "runtime_file"; SourceRel = "watch-board.ps1"; TargetRel = "scripts/watch-board.ps1" }
    [pscustomobject]@{ Kind = "runtime_executable"; SourceRel = "watch-board.sh"; TargetRel = "scripts/watch-board.sh" }
    [pscustomobject]@{ Kind = "template_text"; SourceRel = "rules/verifier/README.md"; TargetRel = "rules/verifier/README.md" }
    [pscustomobject]@{ Kind = "template_text"; SourceRel = "rules/verifier/checklist-template.md"; TargetRel = "rules/verifier/checklist-template.md" }
    [pscustomobject]@{ Kind = "template_text"; SourceRel = "rules/verifier/verification-template.md"; TargetRel = "rules/verifier/verification-template.md" }
    [pscustomobject]@{ Kind = "runtime_executable"; SourceRel = "write-verifier-log.sh"; TargetRel = "scripts/write-verifier-log.sh" }
  )
}

function Get-ManagedBoardDirectoryEntries {
  return @(
    "agents"
    "agents/adapters"
    "automations"
    "automations/state"
    "automations/state/threads"
    "automations/templates"
    "conversations"
    "reference"
    "rules"
    "rules/verifier"
    "rules/wiki"
    "scripts"
    "runners"
    "runners/state"
    "runners/logs"
    "metrics"
    "wiki"
    "wiki/decisions"
    "wiki/features"
    "wiki/architecture"
    "wiki/learnings"
    "logs"
    "logs/hooks"
    "tickets"
    "tickets/backlog"
    "tickets/plan"
    "tickets/todo"
    "tickets/inprogress"
    "tickets/ready-to-merge"
    "tickets/merge-blocked"
    "tickets/verifier"
    "tickets/done"
    "tickets/reject"
  )
}

function Ensure-BoardDirectories {
  param([string]$BoardRoot)

  foreach ($relativeDir in (Get-ManagedBoardDirectoryEntries)) {
    New-Item -ItemType Directory -Force -Path (Join-Path $BoardRoot $relativeDir) | Out-Null
  }
}

function Get-StarterBoardStateAssetEntries {
  return @(
    [pscustomobject]@{ Kind = "template_text"; SourceRel = "automations/heartbeat-set.toml"; TargetRel = "automations/heartbeat-set.toml" }
  )
}

function Get-ManagedHostSkillAssetEntries {
  return @(
    [pscustomobject]@{ Kind = "claude_skill_text"; SourceRel = "autoflow/SKILL.md"; TargetRel = ".claude/skills/autoflow/SKILL.md" }
    [pscustomobject]@{ Kind = "claude_skill_text"; SourceRel = "af/SKILL.md"; TargetRel = ".claude/skills/af/SKILL.md" }
    [pscustomobject]@{ Kind = "codex_skill_text"; SourceRel = "autoflow/SKILL.md"; TargetRel = ".codex/skills/autoflow/SKILL.md" }
    [pscustomobject]@{ Kind = "codex_skill_text"; SourceRel = "autoflow/agents/openai.yaml"; TargetRel = ".codex/skills/autoflow/agents/openai.yaml" }
    [pscustomobject]@{ Kind = "codex_skill_text"; SourceRel = "af/SKILL.md"; TargetRel = ".codex/skills/af/SKILL.md" }
    [pscustomobject]@{ Kind = "codex_skill_text"; SourceRel = "af/agents/openai.yaml"; TargetRel = ".codex/skills/af/agents/openai.yaml" }
  )
}

function New-AssetTempFile {
  param(
    [string]$AssetKind,
    [string]$SourceRel,
    [string]$BoardDirName
  )

  $tempFile = [System.IO.Path]::GetTempFileName()
  switch ($AssetKind) {
    "template_text" {
      $sourcePath = Join-Path $script:TemplateBoardRoot $SourceRel
      Write-Utf8File -Path $tempFile -Content (Render-TextContent -SourceFile $sourcePath -BoardDirName $BoardDirName)
    }
    "source_text" {
      $sourcePath = Join-Path $script:AutoflowRepoRoot $SourceRel
      Write-Utf8File -Path $tempFile -Content (Render-TextContent -SourceFile $sourcePath -BoardDirName $BoardDirName)
    }
    "claude_skill_text" {
      $sourcePath = Join-Path $script:ClaudeSkillsRoot $SourceRel
      Write-Utf8File -Path $tempFile -Content (Render-TextContent -SourceFile $sourcePath -BoardDirName $BoardDirName)
    }
    "codex_skill_text" {
      $sourcePath = Join-Path $script:CodexSkillsRoot $SourceRel
      Write-Utf8File -Path $tempFile -Content (Render-TextContent -SourceFile $sourcePath -BoardDirName $BoardDirName)
    }
    "source_file" {
      Copy-Item -LiteralPath (Join-Path $script:AutoflowRepoRoot $SourceRel) -Destination $tempFile -Force
    }
    "source_executable" {
      Copy-Item -LiteralPath (Join-Path $script:AutoflowRepoRoot $SourceRel) -Destination $tempFile -Force
    }
    "runtime_file" {
      Copy-Item -LiteralPath (Join-Path $script:RuntimeScriptsRoot $SourceRel) -Destination $tempFile -Force
    }
    "runtime_executable" {
      Copy-Item -LiteralPath (Join-Path $script:RuntimeScriptsRoot $SourceRel) -Destination $tempFile -Force
    }
    default {
      Remove-Item -LiteralPath $tempFile -Force -ErrorAction SilentlyContinue
      throw "Unknown asset kind: $AssetKind"
    }
  }

  return $tempFile
}

function Test-FileContentsEqual {
  param(
    [string]$LeftPath,
    [string]$RightPath
  )

  if (-not (Test-Path -LiteralPath $LeftPath -PathType Leaf) -or -not (Test-Path -LiteralPath $RightPath -PathType Leaf)) {
    return $false
  }

  $leftHash = Get-FileHash -LiteralPath $LeftPath -Algorithm SHA256
  $rightHash = Get-FileHash -LiteralPath $RightPath -Algorithm SHA256
  return $leftHash.Hash -eq $rightHash.Hash
}

function Set-ExecutableIfSupported {
  param([string]$Path)

  $chmod = Get-Command -Name chmod -ErrorAction SilentlyContinue
  if (-not $chmod) {
    return
  }

  try {
    & $chmod.Source "+x" $Path | Out-Null
  }
  catch {
  }
}

function Sync-TempFile {
  param(
    [string]$TempFile,
    [string]$TargetFile,
    [string]$BackupRoot = "",
    [string]$BackupRelative = "",
    [bool]$Executable = $false
  )

  $script:SyncBackupCreated = $false
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $TargetFile) | Out-Null

  $targetExists = Test-Path -LiteralPath $TargetFile -PathType Leaf
  if ($targetExists -and (Test-FileContentsEqual -LeftPath $TempFile -RightPath $TargetFile)) {
    if ($Executable) {
      Set-ExecutableIfSupported -Path $TargetFile
    }

    $script:SyncActionResult = "unchanged"
    return
  }

  if ($targetExists -and $BackupRoot -and $BackupRelative) {
    $backupPath = Join-Path $BackupRoot $BackupRelative
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $backupPath) | Out-Null
    Copy-Item -LiteralPath $TargetFile -Destination $backupPath -Force
    $script:SyncBackupCreated = $true
  }

  Copy-Item -LiteralPath $TempFile -Destination $TargetFile -Force
  if ($Executable) {
    Set-ExecutableIfSupported -Path $TargetFile
  }

  if ($targetExists) {
    $script:SyncActionResult = "updated"
  }
  else {
    $script:SyncActionResult = "created"
  }
}

function Sync-BoardAsset {
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
    Sync-TempFile -TempFile $tempFile -TargetFile (Join-Path $BoardRoot $TargetRel) -BackupRoot $BackupRoot -BackupRelative $TargetRel -Executable:(($AssetKind -eq "source_executable") -or ($AssetKind -eq "runtime_executable"))
  }
  finally {
    Remove-Item -LiteralPath $tempFile -Force -ErrorAction SilentlyContinue
  }
}

function Sync-HostSkillAsset {
  param(
    [string]$TargetProjectRoot,
    [string]$BoardDirName,
    [string]$AssetKind,
    [string]$SourceRel,
    [string]$TargetRel,
    [string]$BackupRoot = ""
  )

  $tempFile = New-AssetTempFile -AssetKind $AssetKind -SourceRel $SourceRel -BoardDirName $BoardDirName
  try {
    Sync-TempFile -TempFile $tempFile -TargetFile (Join-Path $TargetProjectRoot $TargetRel) -BackupRoot $BackupRoot -BackupRelative $TargetRel
  }
  finally {
    Remove-Item -LiteralPath $tempFile -Force -ErrorAction SilentlyContinue
  }
}

function Sync-HostSkillAssetIfMissing {
  param(
    [string]$TargetProjectRoot,
    [string]$BoardDirName,
    [string]$AssetKind,
    [string]$SourceRel,
    [string]$TargetRel
  )

  $tempFile = New-AssetTempFile -AssetKind $AssetKind -SourceRel $SourceRel -BoardDirName $BoardDirName
  try {
    $targetFile = Join-Path $TargetProjectRoot $TargetRel
    if ((Test-Path -LiteralPath $targetFile -PathType Leaf) -and -not (Test-FileContentsEqual -LeftPath $tempFile -RightPath $targetFile)) {
      $script:SyncBackupCreated = $false
      $script:SyncActionResult = "preserved"
      return
    }

    Sync-TempFile -TempFile $tempFile -TargetFile $targetFile -BackupRelative $TargetRel
  }
  finally {
    Remove-Item -LiteralPath $tempFile -Force -ErrorAction SilentlyContinue
  }
}

function Sync-LiteralFile {
  param(
    [string]$TargetFile,
    [string]$LiteralContent,
    [string]$BackupRoot = "",
    [string]$BackupRelative = ""
  )

  $tempFile = [System.IO.Path]::GetTempFileName()
  try {
    Write-Utf8File -Path $tempFile -Content ($LiteralContent + [Environment]::NewLine)
    Sync-TempFile -TempFile $tempFile -TargetFile $TargetFile -BackupRoot $BackupRoot -BackupRelative $BackupRelative
  }
  finally {
    Remove-Item -LiteralPath $tempFile -Force -ErrorAction SilentlyContinue
  }
}

function Write-ProjectRootMarker {
  param(
    [string]$BoardRoot,
    [string]$BackupRoot = ""
  )

  Sync-LiteralFile -TargetFile (Join-Path $BoardRoot ".project-root") -LiteralContent ".." -BackupRoot $BackupRoot -BackupRelative ".project-root"
}

function Write-BoardVersionMarker {
  param(
    [string]$BoardRoot,
    [string]$BackupRoot = ""
  )

  Sync-LiteralFile -TargetFile (Join-Path $BoardRoot ".autoflow-version") -LiteralContent (Get-PackageVersionValue) -BackupRoot $BackupRoot -BackupRelative ".autoflow-version"
}

function Sync-HostAgentsFile {
  param(
    [string]$TargetFile,
    [string]$BoardDirName,
    [string]$BackupRoot = ""
  )

  $tempFile = [System.IO.Path]::GetTempFileName()
  try {
    $content = Render-TextContent -SourceFile $script:HostAgentsTemplatePath -BoardDirName $BoardDirName
    Write-Utf8File -Path $tempFile -Content $content
    Sync-TempFile -TempFile $tempFile -TargetFile $TargetFile -BackupRoot $BackupRoot -BackupRelative "AGENTS.md"
  }
  finally {
    Remove-Item -LiteralPath $tempFile -Force -ErrorAction SilentlyContinue
  }
}

function Sync-HostClaudeFile {
  param(
    [string]$TargetFile,
    [string]$BoardDirName,
    [string]$BackupRoot = ""
  )

  if (-not (Test-Path -LiteralPath $script:HostClaudeTemplatePath -PathType Leaf)) {
    return
  }

  $tempFile = [System.IO.Path]::GetTempFileName()
  try {
    $content = Render-TextContent -SourceFile $script:HostClaudeTemplatePath -BoardDirName $BoardDirName
    Write-Utf8File -Path $tempFile -Content $content
    Sync-TempFile -TempFile $tempFile -TargetFile $TargetFile -BackupRoot $BackupRoot -BackupRelative "CLAUDE.md"
  }
  finally {
    Remove-Item -LiteralPath $tempFile -Force -ErrorAction SilentlyContinue
  }
}
