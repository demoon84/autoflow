[CmdletBinding()]
param(
  [Parameter(Position = 0)]
  [string]$ProjectRoot = ".",

  [Parameter(Position = 1)]
  [string]$BoardDirName = "autoflow"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "cli-common.ps1")

$resolvedProjectRoot = Resolve-ProjectRootOrThrow $ProjectRoot
$boardRoot = Get-BoardRootPath -ProjectRoot $resolvedProjectRoot -BoardDirName $BoardDirName

$initialized = $false
$hostAgentsPresent = Test-Path -LiteralPath (Join-Path $resolvedProjectRoot "AGENTS.md") -PathType Leaf
$boardAgentsPresent = Test-Path -LiteralPath (Join-Path $boardRoot "AGENTS.md") -PathType Leaf
$boardReadmePresent = Test-Path -LiteralPath (Join-Path $boardRoot "README.md") -PathType Leaf
$markerPresent = Test-Path -LiteralPath (Join-Path $boardRoot ".project-root") -PathType Leaf
$markerValue = ""
$markerResolved = ""
$specCount = 0
$planCount = 0
$planDraftCount = 0
$planReadyCount = 0
$planTicketedCount = 0
$planDoneCount = 0
$ticketTodoCount = 0
$ticketInprogressCount = 0
$ticketDoneCount = 0
$ticketPlanningCount = 0
$ticketClaimedCount = 0
$ticketExecutingCount = 0
$ticketReadyForVerificationCount = 0
$ticketVerifyingCount = 0
$ticketBlockedCount = 0
$verifyRunCount = 0
$runnerScaffoldPresent = $false
$wikiScaffoldPresent = $false
$metricsScaffoldPresent = $false
$conversationScaffoldPresent = $false
$adapterScaffoldPresent = $false
$summaryStatus = "missing_board"
$packageVersion = Get-PackageVersionValue
$boardVersion = ""
$versionStatus = "missing_board"

if ($markerPresent) {
  $markerValue = Get-ProjectRootMarkerValue $boardRoot
  try {
    $markerResolved = Resolve-ProjectRootFromBoard $boardRoot
  }
  catch {
    $markerResolved = ""
  }
}

if (Test-Path -LiteralPath $boardRoot -PathType Container) {
  if (Test-BoardIsInitialized $boardRoot) {
    $initialized = $true
    $summaryStatus = "initialized"
  }
  else {
    $summaryStatus = "partial_board"
  }

  $specRoot = Get-SpecRootPath $boardRoot
  $planRoot = Get-PlanRootPath $boardRoot
  $specCount = Get-CountActiveSpecs $specRoot
  $planCount = Get-CountNumberedPlanFiles $planRoot
  $planDraftCount = Get-CountPlanStatus -PlanRoot $planRoot -WantedStatus "draft"
  $planReadyCount = Get-CountPlanStatus -PlanRoot $planRoot -WantedStatus "ready"
  $planTicketedCount = Get-CountPlanStatus -PlanRoot $planRoot -WantedStatus "ticketed"
  $planDoneCount = (Get-CountPlanStatus -PlanRoot $planRoot -WantedStatus "done") + (Get-CountPlanStatus -PlanRoot (Join-Path $boardRoot "tickets/done") -WantedStatus "done" -Recurse)
  $ticketTodoCount = Get-CountMatchingFiles -SearchRoot (Join-Path $boardRoot "tickets/todo") -Filter "tickets_*.md"
  $ticketInprogressCount = Get-CountMatchingFiles -SearchRoot (Join-Path $boardRoot "tickets/inprogress") -Filter "tickets_*.md"
  $ticketDoneCount = Get-CountMatchingFiles -SearchRoot (Join-Path $boardRoot "tickets/done") -Filter "tickets_*.md" -Recurse
  $ticketPlanningCount = Get-CountTicketStage -TicketRoot (Join-Path $boardRoot "tickets/inprogress") -WantedStage "planning"
  $ticketClaimedCount = Get-CountTicketStage -TicketRoot (Join-Path $boardRoot "tickets/inprogress") -WantedStage "claimed"
  $ticketExecutingCount = Get-CountTicketStage -TicketRoot (Join-Path $boardRoot "tickets/inprogress") -WantedStage "executing"
  $ticketReadyForVerificationCount = Get-CountTicketStage -TicketRoot (Join-Path $boardRoot "tickets/inprogress") -WantedStage "ready_for_verification"
  $ticketVerifyingCount = Get-CountTicketStage -TicketRoot (Join-Path $boardRoot "tickets/inprogress") -WantedStage "verifying"
  $ticketBlockedCount = Get-CountTicketStage -TicketRoot (Join-Path $boardRoot "tickets/inprogress") -WantedStage "blocked"
  $verifyRunCount = 0
  $verifyRunCount += Get-CountMatchingFiles -SearchRoot (Join-Path $boardRoot "tickets/inprogress") -Filter "verify_*.md" -Recurse
  $verifyRunCount += Get-CountMatchingFiles -SearchRoot (Join-Path $boardRoot "tickets/reject") -Filter "verify_*.md" -Recurse
  $verifyRunCount += Get-CountMatchingFiles -SearchRoot (Join-Path $boardRoot "tickets/done") -Filter "verify_*.md" -Recurse
  $verifyRunCount += Get-CountMatchingFiles -SearchRoot (Join-Path $boardRoot "tickets/runs") -Filter "verify_*.md" -Recurse
  $runnerScaffoldPresent =
    (Test-Path -LiteralPath (Join-Path $boardRoot "runners") -PathType Container) -and
    (Test-Path -LiteralPath (Join-Path $boardRoot "runners/state") -PathType Container) -and
    (Test-Path -LiteralPath (Join-Path $boardRoot "runners/logs") -PathType Container) -and
    (Test-Path -LiteralPath (Join-Path $boardRoot "runners/config.toml") -PathType Leaf)
  $wikiScaffoldPresent =
    (Test-Path -LiteralPath (Join-Path $boardRoot "wiki") -PathType Container) -and
    (Test-Path -LiteralPath (Join-Path $boardRoot "wiki/index.md") -PathType Leaf) -and
    (Test-Path -LiteralPath (Join-Path $boardRoot "wiki/log.md") -PathType Leaf) -and
    (Test-Path -LiteralPath (Join-Path $boardRoot "wiki/project-overview.md") -PathType Leaf) -and
    (Test-Path -LiteralPath (Join-Path $boardRoot "rules/wiki") -PathType Container)
  $metricsScaffoldPresent =
    (Test-Path -LiteralPath (Join-Path $boardRoot "metrics") -PathType Container) -and
    (Test-Path -LiteralPath (Join-Path $boardRoot "metrics/README.md") -PathType Leaf) -and
    (Test-Path -LiteralPath (Join-Path $boardRoot "metrics/.gitignore") -PathType Leaf)
  $conversationScaffoldPresent =
    (Test-Path -LiteralPath (Join-Path $boardRoot "conversations") -PathType Container) -and
    (Test-Path -LiteralPath (Join-Path $boardRoot "conversations/README.md") -PathType Leaf)
  $adapterScaffoldPresent =
    (Test-Path -LiteralPath (Join-Path $boardRoot "agents/adapters") -PathType Container) -and
    (Test-Path -LiteralPath (Join-Path $boardRoot "agents/adapters/README.md") -PathType Leaf) -and
    (Test-Path -LiteralPath (Join-Path $boardRoot "agents/adapters/shell.md") -PathType Leaf) -and
    (Test-Path -LiteralPath (Join-Path $boardRoot "agents/adapters/codex-cli.md") -PathType Leaf) -and
    (Test-Path -LiteralPath (Join-Path $boardRoot "agents/adapters/claude-cli.md") -PathType Leaf) -and
    (Test-Path -LiteralPath (Join-Path $boardRoot "agents/adapters/opencode.md") -PathType Leaf) -and
    (Test-Path -LiteralPath (Join-Path $boardRoot "agents/adapters/gemini-cli.md") -PathType Leaf)
  $boardVersion = Get-BoardVersionValue $boardRoot
  if (-not $boardVersion) {
    $boardVersion = ""
  }
  $versionStatus = Get-BoardVersionStatus $boardRoot
}

Write-StatusSummary `
  -ProjectRoot $resolvedProjectRoot `
  -BoardRoot $boardRoot `
  -BoardDirName $BoardDirName `
  -SummaryStatus $summaryStatus `
  -Initialized $initialized `
  -HostAgentsPresent $hostAgentsPresent `
  -BoardAgentsPresent $boardAgentsPresent `
  -BoardReadmePresent $boardReadmePresent `
  -MarkerPresent $markerPresent `
  -MarkerValue $markerValue `
  -MarkerResolved $markerResolved `
  -SpecCount $specCount `
  -PlanCount $planCount `
  -PlanDraftCount $planDraftCount `
  -PlanReadyCount $planReadyCount `
  -PlanTicketedCount $planTicketedCount `
  -PlanDoneCount $planDoneCount `
  -TicketTodoCount $ticketTodoCount `
  -TicketInprogressCount $ticketInprogressCount `
  -TicketDoneCount $ticketDoneCount `
  -TicketClaimedCount $ticketClaimedCount `
  -TicketExecutingCount $ticketExecutingCount `
  -TicketReadyForVerificationCount $ticketReadyForVerificationCount `
  -TicketVerifyingCount $ticketVerifyingCount `
  -TicketBlockedCount $ticketBlockedCount `
  -VerifyRunCount $verifyRunCount `
  -PackageVersion $packageVersion `
  -BoardVersion $boardVersion `
  -VersionStatus $versionStatus

Write-KeyValueLine "runner_scaffold_present" ([string]$runnerScaffoldPresent).ToLowerInvariant()
Write-KeyValueLine "wiki_scaffold_present" ([string]$wikiScaffoldPresent).ToLowerInvariant()
Write-KeyValueLine "metrics_scaffold_present" ([string]$metricsScaffoldPresent).ToLowerInvariant()
Write-KeyValueLine "conversation_scaffold_present" ([string]$conversationScaffoldPresent).ToLowerInvariant()
Write-KeyValueLine "adapter_scaffold_present" ([string]$adapterScaffoldPresent).ToLowerInvariant()
Write-KeyValueLine "ticket_planning_count" ([string]$ticketPlanningCount)
Write-KeyValueLine "ticket_owner_active_count" ([string]$ticketInprogressCount)
