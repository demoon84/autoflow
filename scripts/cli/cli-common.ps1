Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$script:CliCommonRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$script:AutoflowRepoRoot = (Resolve-Path (Join-Path $script:CliCommonRoot "..\..")).Path
$script:AutoflowVersionFile = Join-Path $script:AutoflowRepoRoot "VERSION"

function Format-BoolString {
  param([bool]$Value)

  if ($Value) {
    return "true"
  }

  return "false"
}

function Get-Utf8EncodingNoBom {
  return New-Object System.Text.UTF8Encoding($false)
}

function Write-Utf8File {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path,

    [Parameter(Mandatory = $true)]
    [AllowEmptyString()]
    [string]$Content
  )

  $parent = Split-Path -Parent $Path
  if ($parent) {
    New-Item -ItemType Directory -Force -Path $parent | Out-Null
  }

  [System.IO.File]::WriteAllText($Path, $Content, (Get-Utf8EncodingNoBom))
}

function Get-FileContentRawSafe {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    return ""
  }

  return [System.IO.File]::ReadAllText($Path)
}

function Get-PackageVersionValue {
  if (Test-Path -LiteralPath $script:AutoflowVersionFile -PathType Leaf) {
    return ([System.IO.File]::ReadAllText($script:AutoflowVersionFile)).Trim()
  }

  return "0.0.0-dev"
}

function Resolve-ProjectRootOrThrow {
  param([string]$ProjectRoot = ".")

  if (-not (Test-Path -LiteralPath $ProjectRoot -PathType Container)) {
    throw "Project root not found: $ProjectRoot"
  }

  return (Resolve-Path -LiteralPath $ProjectRoot).Path
}

function Get-BoardRootPath {
  param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectRoot,

    [string]$BoardDirName = "autoflow"
  )

  return (Join-Path $ProjectRoot $BoardDirName)
}

function Test-SpecFilePlaceholder {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    return $false
  }

  $content = Get-FileContentRawSafe $Path
  if ($content.Contains("<!-- AUTOFLOW_STARTER_SPEC_PLACEHOLDER -->")) {
    return $true
  }

  return $content.Contains("Replace with your project name")
}

function Test-PlanFilePlaceholder {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    return $false
  }

  $content = Get-FileContentRawSafe $Path
  if ($content.Contains("<!-- AUTOFLOW_STARTER_PLAN_PLACEHOLDER -->")) {
    return $true
  }

  if ($content.Contains("첫 구현 티켓 후보를 관찰 가능한 문장으로 적기")) {
    return $true
  }

  return $content.Contains("- Title: Initial project bootstrap")
}

function Test-BoardHasAnySpecRoot {
  param([string]$BoardRoot)

  return (Test-Path -LiteralPath (Join-Path $BoardRoot "tickets/backlog") -PathType Container) -or
    (Test-Path -LiteralPath (Join-Path $BoardRoot "rules/spec") -PathType Container)
}

function Get-SpecRootPath {
  param([string]$BoardRoot)

  $backlogRoot = Join-Path $BoardRoot "tickets/backlog"
  if (Test-Path -LiteralPath $backlogRoot -PathType Container) {
    return $backlogRoot
  }

  $legacyRoot = Join-Path $BoardRoot "rules/spec"
  if (Test-Path -LiteralPath $legacyRoot -PathType Container) {
    return $legacyRoot
  }

  return $backlogRoot
}

function Get-PlanRootPath {
  param([string]$BoardRoot)

  $planRoot = Join-Path $BoardRoot "tickets/plan"
  if (Test-Path -LiteralPath $planRoot -PathType Container) {
    return $planRoot
  }

  $legacyRoot = Join-Path $BoardRoot "rules/plan"
  if (Test-Path -LiteralPath $legacyRoot -PathType Container) {
    return $legacyRoot
  }

  return $planRoot
}

function Test-BoardIsInitialized {
  param([string]$BoardRoot)

  return (Test-Path -LiteralPath (Join-Path $BoardRoot "AGENTS.md") -PathType Leaf) -and
    (Test-Path -LiteralPath (Join-Path $BoardRoot "tickets") -PathType Container) -and
    (Test-BoardHasAnySpecRoot $BoardRoot)
}

function Get-BoardVersionValue {
  param([string]$BoardRoot)

  $markerPath = Join-Path $BoardRoot ".autoflow-version"
  if (-not (Test-Path -LiteralPath $markerPath -PathType Leaf)) {
    return $null
  }

  return ([System.IO.File]::ReadAllText($markerPath)).Trim()
}

function Get-ProjectRootMarkerValue {
  param([string]$BoardRoot)

  $markerPath = Join-Path $BoardRoot ".project-root"
  if (-not (Test-Path -LiteralPath $markerPath -PathType Leaf)) {
    return $null
  }

  $value = ([System.IO.File]::ReadAllText($markerPath)).Trim()
  if (-not $value) {
    return ".."
  }

  return $value
}

function Resolve-ProjectRootFromBoard {
  param([string]$BoardRoot)

  $configured = Get-ProjectRootMarkerValue $BoardRoot
  if ($null -eq $configured) {
    throw "board project-root marker is missing: $(Join-Path $BoardRoot '.project-root')"
  }

  if ([System.IO.Path]::IsPathRooted($configured)) {
    $resolved = $configured
  }
  else {
    $resolved = Join-Path $BoardRoot $configured
  }

  if (-not (Test-Path -LiteralPath $resolved -PathType Container)) {
    throw "project-root marker could not be resolved from $(Join-Path $BoardRoot '.project-root')"
  }

  return (Resolve-Path -LiteralPath $resolved).Path
}

function Get-CountMatchingFiles {
  param(
    [string]$SearchRoot,
    [string]$Filter,
    [switch]$Recurse
  )

  if (-not (Test-Path -LiteralPath $SearchRoot -PathType Container)) {
    return 0
  }

  if ($Recurse) {
    $items = Get-ChildItem -LiteralPath $SearchRoot -File -Filter $Filter -Recurse
  }
  else {
    $items = Get-ChildItem -LiteralPath $SearchRoot -File -Filter $Filter
  }

  return @($items).Count
}

function Get-NumberedPlanFiles {
  param(
    [string]$PlanRoot,
    [switch]$Recurse
  )

  if (-not (Test-Path -LiteralPath $PlanRoot -PathType Container)) {
    return @()
  }

  if ($Recurse) {
    $items = Get-ChildItem -LiteralPath $PlanRoot -File -Filter "plan_*.md" -Recurse
  }
  else {
    $items = Get-ChildItem -LiteralPath $PlanRoot -File -Filter "plan_*.md"
  }

  $items = $items | Where-Object { $_.Name -match '^plan_[0-9][0-9][0-9]\.md$' } | Sort-Object FullName

  return @($items)
}

function Get-CountNumberedPlanFiles {
  param([string]$PlanRoot)

  $count = 0
  foreach ($file in (Get-NumberedPlanFiles -PlanRoot $PlanRoot)) {
    if (-not (Test-PlanFilePlaceholder $file.FullName)) {
      $count += 1
    }
  }

  return $count
}

function Get-CountActiveSpecs {
  param([string]$SpecRoot)

  if (-not (Test-Path -LiteralPath $SpecRoot -PathType Container)) {
    return 0
  }

  $count = 0
  $items = Get-ChildItem -LiteralPath $SpecRoot -File |
    Where-Object {
      $_.Name -notlike "README.md" -and
      $_.Name -notlike "*template*.md"
    } |
    Sort-Object FullName

  foreach ($file in $items) {
    if (-not (Test-SpecFilePlaceholder $file.FullName)) {
      $count += 1
    }
  }

  return $count
}

function Get-SectionLines {
  param(
    [string]$FilePath,
    [string]$Heading
  )

  if (-not (Test-Path -LiteralPath $FilePath -PathType Leaf)) {
    return @()
  }

  $lines = Get-Content -LiteralPath $FilePath
  $targetHeading = "## $Heading"
  $inSection = $false
  $result = New-Object System.Collections.Generic.List[string]

  foreach ($line in $lines) {
    if ($line -eq $targetHeading) {
      $inSection = $true
      continue
    }

    if ($inSection -and $line.StartsWith("## ")) {
      break
    }

    if ($inSection) {
      [void]$result.Add($line)
    }
  }

  return $result.ToArray()
}

function Get-MarkdownFieldValueInSection {
  param(
    [string]$FilePath,
    [string]$Heading,
    [string]$Field
  )

  $prefix = "- $Field:"
  foreach ($line in (Get-SectionLines -FilePath $FilePath -Heading $Heading)) {
    if ($line.StartsWith($prefix)) {
      return $line.Substring($prefix.Length).Trim()
    }
  }

  return ""
}

function Test-MarkdownFieldPresentInSection {
  param(
    [string]$FilePath,
    [string]$Heading,
    [string]$Field
  )

  return [string]::IsNullOrEmpty((Get-MarkdownFieldValueInSection -FilePath $FilePath -Heading $Heading -Field $Field)) -eq $false
}

function Get-CountPlanStatus {
  param(
    [string]$PlanRoot,
    [string]$WantedStatus,
    [switch]$Recurse
  )

  $count = 0
  foreach ($file in (Get-NumberedPlanFiles -PlanRoot $PlanRoot -Recurse:$Recurse)) {
    if (Test-PlanFilePlaceholder $file.FullName) {
      continue
    }

    if ((Get-MarkdownFieldValueInSection -FilePath $file.FullName -Heading "Plan" -Field "Status") -eq $WantedStatus) {
      $count += 1
    }
  }

  return $count
}

function Get-CountTicketStage {
  param(
    [string]$TicketRoot,
    [string]$WantedStage
  )

  if (-not (Test-Path -LiteralPath $TicketRoot -PathType Container)) {
    return 0
  }

  $count = 0
  $tickets = Get-ChildItem -LiteralPath $TicketRoot -File -Filter "tickets_*.md" | Sort-Object FullName
  foreach ($ticket in $tickets) {
    if ((Get-MarkdownFieldValueInSection -FilePath $ticket.FullName -Heading "Ticket" -Field "Stage") -eq $WantedStage) {
      $count += 1
    }
  }

  return $count
}

function Get-BoardVersionStatus {
  param([string]$BoardRoot)

  if (-not (Test-Path -LiteralPath $BoardRoot -PathType Container)) {
    return "missing_board"
  }

  $packageVersion = Get-PackageVersionValue
  $boardVersion = Get-BoardVersionValue $BoardRoot
  if (-not $boardVersion) {
    return "missing_board_version"
  }

  if ($boardVersion -eq $packageVersion) {
    return "up_to_date"
  }

  return "different"
}

function Write-KeyValueLine {
  param(
    [string]$Name,
    [AllowEmptyString()]
    [string]$Value
  )

  Write-Output ("{0}={1}" -f $Name, $Value)
}

function Write-StatusSummary {
  param(
    [string]$ProjectRoot,
    [string]$BoardRoot,
    [string]$BoardDirName,
    [string]$SummaryStatus,
    [bool]$Initialized,
    [bool]$HostAgentsPresent,
    [bool]$BoardAgentsPresent,
    [bool]$BoardReadmePresent,
    [bool]$MarkerPresent,
    [string]$MarkerValue,
    [string]$MarkerResolved,
    [int]$SpecCount,
    [int]$PlanCount,
    [int]$PlanDraftCount,
    [int]$PlanReadyCount,
    [int]$PlanTicketedCount,
    [int]$PlanDoneCount,
    [int]$TicketTodoCount,
    [int]$TicketInprogressCount,
    [int]$TicketDoneCount,
    [int]$TicketClaimedCount,
    [int]$TicketExecutingCount,
    [int]$TicketReadyForVerificationCount,
    [int]$TicketVerifyingCount,
    [int]$TicketBlockedCount,
    [int]$VerifyRunCount,
    [string]$PackageVersion,
    [string]$BoardVersion,
    [string]$VersionStatus
  )

  Write-KeyValueLine "project_root" $ProjectRoot
  Write-KeyValueLine "board_root" $BoardRoot
  Write-KeyValueLine "board_dir_name" $BoardDirName
  Write-KeyValueLine "status" $SummaryStatus
  Write-KeyValueLine "package_version" $PackageVersion
  Write-KeyValueLine "board_version" $BoardVersion
  Write-KeyValueLine "version_status" $VersionStatus
  Write-KeyValueLine "initialized" (Format-BoolString $Initialized)
  Write-KeyValueLine "host_agents_present" (Format-BoolString $HostAgentsPresent)
  Write-KeyValueLine "board_agents_present" (Format-BoolString $BoardAgentsPresent)
  Write-KeyValueLine "board_readme_present" (Format-BoolString $BoardReadmePresent)
  Write-KeyValueLine "project_root_marker_present" (Format-BoolString $MarkerPresent)
  Write-KeyValueLine "project_root_marker_value" $MarkerValue
  Write-KeyValueLine "project_root_marker_resolved" $MarkerResolved
  Write-KeyValueLine "spec_count" ([string]$SpecCount)
  Write-KeyValueLine "plan_count" ([string]$PlanCount)
  Write-KeyValueLine "plan_draft_count" ([string]$PlanDraftCount)
  Write-KeyValueLine "plan_ready_count" ([string]$PlanReadyCount)
  Write-KeyValueLine "plan_ticketed_count" ([string]$PlanTicketedCount)
  Write-KeyValueLine "plan_done_count" ([string]$PlanDoneCount)
  Write-KeyValueLine "ticket_todo_count" ([string]$TicketTodoCount)
  Write-KeyValueLine "ticket_inprogress_count" ([string]$TicketInprogressCount)
  Write-KeyValueLine "ticket_done_count" ([string]$TicketDoneCount)
  Write-KeyValueLine "ticket_claimed_count" ([string]$TicketClaimedCount)
  Write-KeyValueLine "ticket_executing_count" ([string]$TicketExecutingCount)
  Write-KeyValueLine "ticket_ready_for_verification_count" ([string]$TicketReadyForVerificationCount)
  Write-KeyValueLine "ticket_verifying_count" ([string]$TicketVerifyingCount)
  Write-KeyValueLine "ticket_blocked_count" ([string]$TicketBlockedCount)
  Write-KeyValueLine "verify_run_count" ([string]$VerifyRunCount)
}
