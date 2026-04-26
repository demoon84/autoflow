[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-BoardRoot {
  $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
  $scriptDirName = Split-Path -Leaf $scriptDir
  if ($scriptDirName -eq "runtime") {
    return (Resolve-Path (Join-Path $scriptDir "..\..")).Path
  }

  return (Resolve-Path (Join-Path $scriptDir "..")).Path
}

function Get-FileContentRawSafe {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    return ""
  }

  return [System.IO.File]::ReadAllText($Path)
}

function Normalize-PointerToken {
  param([string]$Value)

  if (-not $Value) {
    return ""
  }

  $token = $Value.ToLowerInvariant() -replace '[^a-z0-9._-]+', '-'
  $token = $token.Trim('-')
  $token = $token -replace '-{2,}', '-'
  return $token
}

function Get-CurrentThreadKey {
  $fromAutoflow = Normalize-PointerToken $env:AUTOFLOW_THREAD_KEY
  if ($fromAutoflow) {
    return $fromAutoflow
  }

  return (Normalize-PointerToken $env:CODEX_THREAD_ID)
}

function Get-StateRoot {
  param([string]$BoardRoot)

  return (Join-Path $BoardRoot "automations/state")
}

function Get-ThreadContextPath {
  param([string]$BoardRoot, [string]$ThreadKey)

  if (-not $ThreadKey) {
    return ""
  }

  return (Join-Path (Join-Path (Get-StateRoot $BoardRoot) "threads") "$ThreadKey.context")
}

function Get-CurrentContextPath {
  param([string]$BoardRoot)

  return (Join-Path (Get-StateRoot $BoardRoot) "current.context")
}

function Get-ContextValue {
  param([string]$Path, [string]$Key)

  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    return ""
  }

  foreach ($line in (Get-Content -LiteralPath $Path)) {
    if ($line -match ('^{0}=(.*)$' -f [regex]::Escape($Key))) {
      return $matches[1]
    }
  }

  return ""
}

function Resolve-ContextPath {
  param([string]$BoardRoot)

  $threadPath = Get-ThreadContextPath -BoardRoot $BoardRoot -ThreadKey (Get-CurrentThreadKey)
  if ($threadPath -and (Test-Path -LiteralPath $threadPath -PathType Leaf)) {
    return $threadPath
  }

  $currentPath = Get-CurrentContextPath -BoardRoot $BoardRoot
  if (Test-Path -LiteralPath $currentPath -PathType Leaf) {
    return $currentPath
  }

  return ""
}

function Write-ContextSnapshot {
  param(
    [string]$BoardRoot,
    [string]$SourceContextPath,
    [string]$Role,
    [string]$WorkerId,
    [string]$ExecutionPool,
    [string]$VerifierPool
  )

  if (-not $Role) {
    return
  }

  $stateRoot = Get-StateRoot $BoardRoot
  $threadRoot = Join-Path $stateRoot "threads"
  New-Item -ItemType Directory -Force -Path $stateRoot | Out-Null
  New-Item -ItemType Directory -Force -Path $threadRoot | Out-Null

  $threadKey = Get-CurrentThreadKey
  if (-not $threadKey -and $SourceContextPath) {
    $threadKey = Get-ContextValue -Path $SourceContextPath -Key "thread_key"
  }

  $projectRoot = ""
  if ($SourceContextPath) {
    $projectRoot = Get-ContextValue -Path $SourceContextPath -Key "project_root"
  }
  if (-not $projectRoot) {
    $projectRoot = (Split-Path -Parent $BoardRoot)
  }

  $timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
  $lines = @(
    "role=$Role",
    "worker_id=$WorkerId",
    "thread_key=$threadKey",
    "board_root=$BoardRoot",
    "project_root=$projectRoot",
    "execution_pool=$ExecutionPool",
    "verifier_pool=$VerifierPool",
    "active_ticket_id=",
    "active_ticket_path=",
    "active_stage=",
    "updated_at=$timestamp",
    "active_updated_at="
  )

  $currentPath = Get-CurrentContextPath -BoardRoot $BoardRoot
  Set-Content -LiteralPath $currentPath -Value $lines -Encoding UTF8

  if ($threadKey) {
    $threadPath = Get-ThreadContextPath -BoardRoot $BoardRoot -ThreadKey $threadKey
    Set-Content -LiteralPath $threadPath -Value $lines -Encoding UTF8
  }
}

function Clear-ActiveTicketContext {
  param(
    [string]$BoardRoot,
    [string]$ContextPath,
    [string]$Role,
    [string]$WorkerId,
    [string]$ExecutionPool,
    [string]$VerifierPool
  )

  if ($Role -notin @("ticket-owner", "ticket", "owner", "todo", "verifier")) {
    return
  }

  if (-not $WorkerId -and $ContextPath) {
    $WorkerId = Get-ContextValue -Path $ContextPath -Key "worker_id"
  }

  Write-ContextSnapshot `
    -BoardRoot $BoardRoot `
    -SourceContextPath $ContextPath `
    -Role $Role `
    -WorkerId $WorkerId `
    -ExecutionPool $ExecutionPool `
    -VerifierPool $VerifierPool
}

function Get-SectionLines {
  param([string]$FilePath, [string]$Heading)

  if (-not (Test-Path -LiteralPath $FilePath -PathType Leaf)) {
    return @()
  }

  $target = "## $Heading"
  $inSection = $false
  $result = New-Object System.Collections.Generic.List[string]
  foreach ($line in (Get-Content -LiteralPath $FilePath)) {
    if ($line -eq $target) {
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

function Get-MarkdownFieldValue {
  param([string]$FilePath, [string]$Heading, [string]$Field)

  $prefix = "- $Field:"
  foreach ($line in (Get-SectionLines -FilePath $FilePath -Heading $Heading)) {
    if ($line.StartsWith($prefix)) {
      return $line.Substring($prefix.Length).Trim()
    }
  }

  return ""
}

function Test-SpecFilePlaceholder {
  param([string]$Path)

  $content = Get-FileContentRawSafe $Path
  if (-not $content) {
    return $false
  }

  return $content.Contains("<!-- AUTOFLOW_STARTER_SPEC_PLACEHOLDER -->") -or $content.Contains("Replace with your project name")
}

function Test-PlanFilePlaceholder {
  param([string]$Path)

  $content = Get-FileContentRawSafe $Path
  if (-not $content) {
    return $false
  }

  return $content.Contains("<!-- AUTOFLOW_STARTER_PLAN_PLACEHOLDER -->") -or
    $content.Contains("첫 구현 티켓 후보를 관찰 가능한 문장으로 적기") -or
    $content.Contains("- Title: Initial project bootstrap")
}

function Test-FieldUnassigned {
  param([string]$Value)

  $normalized = ""
  if ($null -ne $Value) {
    $normalized = $Value.Trim().ToLowerInvariant()
  }

  return @("", "unassigned", "unclaimed", "none") -contains $normalized
}

function Get-ListMatchingFiles {
  param([string]$Directory, [string]$Filter)

  if (-not (Test-Path -LiteralPath $Directory -PathType Container)) {
    return @()
  }

  return @(Get-ChildItem -LiteralPath $Directory -File -Filter $Filter | Sort-Object FullName)
}

function Get-RejectTicketFiles {
  param([string]$BoardRoot)

  $rejectRoot = Join-Path $BoardRoot "tickets/reject"
  if (-not (Test-Path -LiteralPath $rejectRoot -PathType Container)) {
    return @()
  }

  return @(Get-ChildItem -LiteralPath $rejectRoot -File |
      Where-Object { $_.Name -match '^(reject|tickets)_[0-9][0-9][0-9]\.md$' } |
      Sort-Object FullName)
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

function Strip-MarkdownCodeTicks {
  param([string]$Value)

  if (-not $Value) {
    return ""
  }

  $raw = $Value.Trim()
  if ($raw -match '^\[[^]]+\]\(([^)]+)\)$') {
    return $matches[1]
  }

  if ($raw -match '^\[\[([^]|]+)(\|[^]]+)?\]\]$') {
    return $matches[1]
  }

  if ($raw.StartsWith('`') -and $raw.EndsWith('`') -and $raw.Length -ge 2) {
    return $raw.Substring(1, $raw.Length - 2)
  }

  return $raw
}

function Get-ExecutionCandidates {
  param([string]$FilePath)

  $inSection = $false
  $result = New-Object System.Collections.Generic.List[string]
  foreach ($line in (Get-Content -LiteralPath $FilePath)) {
    if ($line -eq "## Execution Candidates") {
      $inSection = $true
      continue
    }

    if ($inSection -and $line.StartsWith("## ")) {
      break
    }

    if ($inSection -and $line -match '^\s*- \[ \] (.+)$') {
      [void]$result.Add($matches[1])
    }
  }

  return $result.ToArray()
}

function Get-TicketStage {
  param([string]$FilePath)

  return (Get-MarkdownFieldValue -FilePath $FilePath -Heading "Ticket" -Field "Stage")
}

function Get-TicketField {
  param([string]$FilePath, [string]$Field)

  return (Get-MarkdownFieldValue -FilePath $FilePath -Heading "Ticket" -Field $Field)
}

function Test-ExecutionStageCandidate {
  param([string]$Stage)

  return @("", "claimed", "executing", "blocked") -contains $Stage
}

function Get-ExecutionLoadForOwner {
  param([string]$BoardRoot, [string]$Owner)

  $count = 0
  foreach ($ticket in (Get-ListMatchingFiles -Directory (Join-Path $BoardRoot "tickets/inprogress") -Filter "tickets_*.md")) {
    if ((Get-TicketField -FilePath $ticket.FullName -Field "Execution Owner") -ne $Owner) {
      continue
    }

    if (Test-ExecutionStageCandidate (Get-TicketStage $ticket.FullName)) {
      $count += 1
    }
  }

  return $count
}

function Test-ExecutionPoolHasCapacity {
  param([string]$BoardRoot, [string]$PoolCsv, [string]$LimitRaw)

  if (-not $PoolCsv) {
    return $true
  }

  $limit = 1
  if ($LimitRaw) {
    $limit = [int]$LimitRaw
  }

  foreach ($candidate in ($PoolCsv -split ',')) {
    $trimmed = $candidate.Trim()
    if (-not $trimmed) {
      continue
    }

    if ((Get-ExecutionLoadForOwner -BoardRoot $BoardRoot -Owner $trimmed) -lt $limit) {
      return $true
    }
  }

  return $false
}

function Emit-Block {
  param([string]$Reason)

  $escaped = $Reason.Replace('\', '\\').Replace('"', '\"')
  Write-Output "{"
  Write-Output '  "hookSpecificOutput": {'
  Write-Output '    "hookEventName": "Stop",'
  Write-Output '    "decision": "block",'
  Write-Output ('    "reason": "{0}"' -f $escaped)
  Write-Output "  }"
  Write-Output "}"
}

$boardRoot = Get-BoardRoot

switch ($env:AUTOFLOW_STOP_BYPASS) {
  "1" { exit 0 }
  "true" { exit 0 }
  "TRUE" { exit 0 }
  "yes" { exit 0 }
  "YES" { exit 0 }
  "on" { exit 0 }
  "ON" { exit 0 }
}

$hookRole = $env:AUTOFLOW_ROLE
$hookWorkerId = $env:AUTOFLOW_WORKER_ID
$hookExecutionPool = $env:AUTOFLOW_EXECUTION_POOL
$hookVerifierPool = $env:AUTOFLOW_VERIFIER_POOL
$contextPath = Resolve-ContextPath -BoardRoot $boardRoot

if ($contextPath) {
  if (-not $hookRole) { $hookRole = Get-ContextValue -Path $contextPath -Key "role" }
  if (-not $hookWorkerId) { $hookWorkerId = Get-ContextValue -Path $contextPath -Key "worker_id" }
  if (-not $hookExecutionPool) { $hookExecutionPool = Get-ContextValue -Path $contextPath -Key "execution_pool" }
  if (-not $hookVerifierPool) { $hookVerifierPool = Get-ContextValue -Path $contextPath -Key "verifier_pool" }
}

if (-not $hookRole) {
  exit 0
}

$reason = ""

switch ($hookRole) {
  { $_ -in @("ticket-owner", "ticket", "owner") } {
    if ($hookWorkerId) {
      foreach ($ticket in (Get-ListMatchingFiles -Directory (Join-Path $boardRoot "tickets/inprogress") -Filter "tickets_*.md")) {
        $stage = Get-TicketStage $ticket.FullName
        $owner = Get-TicketField -FilePath $ticket.FullName -Field "Owner"
        $claimedBy = Get-TicketField -FilePath $ticket.FullName -Field "Claimed By"
        $executionOwner = Get-TicketField -FilePath $ticket.FullName -Field "Execution Owner"
        $verifierOwner = Get-TicketField -FilePath $ticket.FullName -Field "Verifier Owner"

        $ownedByTicketOwner = ($owner -eq $hookWorkerId) -or
          ($claimedBy -eq $hookWorkerId) -or
          ($executionOwner -eq $hookWorkerId) -or
          ($verifierOwner -eq $hookWorkerId)

        if ($ownedByTicketOwner -and (@("done", "rejected") -notcontains $stage)) {
          $reason = "ticket-owner work remains: owner $hookWorkerId still has inprogress ticket $($ticket.Name)."
          break
        }
      }
    }

    if (-not $reason) {
      $todoTicket = Get-ListMatchingFiles -Directory (Join-Path $boardRoot "tickets/todo") -Filter "tickets_*.md" | Select-Object -First 1
      if ($todoTicket) {
        $reason = "ticket-owner work remains: claimable ticket $($todoTicket.Name) is waiting."
      }
    }

    if (-not $reason) {
      $verifierTicket = Get-ListMatchingFiles -Directory (Join-Path $boardRoot "tickets/verifier") -Filter "tickets_*.md" | Select-Object -First 1
      if ($verifierTicket) {
        $reason = "ticket-owner work remains: legacy verifier ticket $($verifierTicket.Name) should be finished by an owner."
      }
    }

    if (-not $reason) {
      $specRoot = Join-Path $boardRoot "tickets/backlog"
      if (Test-Path -LiteralPath $specRoot -PathType Container) {
        foreach ($specFile in (Get-ChildItem -LiteralPath $specRoot -File -Filter "project_*.md" | Sort-Object FullName)) {
          if (-not (Test-SpecFilePlaceholder $specFile.FullName)) {
            $reason = "ticket-owner work remains: populated backlog spec $($specFile.Name) is waiting."
            break
          }
        }
      }
    }
    break
  }
  "plan" {
    $rejectFile = Get-RejectTicketFiles -BoardRoot $boardRoot | Select-Object -First 1
    if ($rejectFile) {
      $reason = "planner work remains: reject ticket $($rejectFile.Name) still needs replanning."
      break
    }

    $specRoot = Join-Path $boardRoot "tickets/backlog"
    if (Test-Path -LiteralPath $specRoot -PathType Container) {
      foreach ($specFile in (Get-ChildItem -LiteralPath $specRoot -File -Filter "project_*.md" | Sort-Object FullName)) {
        if (Test-SpecFilePlaceholder $specFile.FullName) {
          continue
        }

        if ($specFile.BaseName -match '_(\d{3})$') {
          $planId = $matches[1]
        }
        else {
          continue
        }

        $planFile = Join-Path (Get-PlanRootPath -BoardRoot $boardRoot) ("plan_{0}.md" -f $planId)
        if (-not (Test-Path -LiteralPath $planFile -PathType Leaf) -or (Test-PlanFilePlaceholder $planFile)) {
          $reason = "planner work remains: populated backlog spec $($specFile.Name) still needs a real plan."
          break
        }
      }
    }

    if (-not $reason) {
      foreach ($planFile in (Get-ListMatchingFiles -Directory (Get-PlanRootPath -BoardRoot $boardRoot) -Filter "plan_*.md")) {
        if (Test-PlanFilePlaceholder $planFile.FullName) {
          continue
        }

        $status = Get-MarkdownFieldValue -FilePath $planFile.FullName -Heading "Plan" -Field "Status"
        if ($status -eq "ready") {
          $reason = "planner work remains: plan $($planFile.Name) is ready to generate todo tickets."
          break
        }

        if ($status -eq "draft") {
          $specRef = Strip-MarkdownCodeTicks (Get-MarkdownFieldValue -FilePath $planFile.FullName -Heading "Spec References" -Field "Project Spec")
          $candidates = Get-ExecutionCandidates -FilePath $planFile.FullName
          $specPath = if ($specRef) { Join-Path $boardRoot $specRef } else { "" }
          if ($specPath -and (Test-Path -LiteralPath $specPath -PathType Leaf) -and (-not (Test-SpecFilePlaceholder $specPath)) -and $candidates.Count -gt 0) {
            $reason = "planner work remains: draft plan $($planFile.Name) can be auto-flipped and ticketed."
            break
          }
        }
      }
    }
  }
  "todo" {
    if (-not $hookWorkerId) {
      break
    }

    foreach ($ticket in (Get-ListMatchingFiles -Directory (Join-Path $boardRoot "tickets/inprogress") -Filter "tickets_*.md")) {
      $stage = Get-TicketStage $ticket.FullName
      $executionOwner = Get-TicketField -FilePath $ticket.FullName -Field "Execution Owner"
      $owner = Get-TicketField -FilePath $ticket.FullName -Field "Owner"

      $ownedByWorker = ($executionOwner -eq $hookWorkerId) -or
        ($owner -eq $hookWorkerId) -or
        ((Test-FieldUnassigned $executionOwner) -and $owner -eq $hookWorkerId)

      if ($ownedByWorker -and (@("", "claimed", "executing") -contains $stage)) {
        $reason = "todo work remains: worker $hookWorkerId still has inprogress ticket $($ticket.Name)."
        break
      }
    }

    if (-not $reason -and (Test-ExecutionPoolHasCapacity -BoardRoot $boardRoot -PoolCsv $hookExecutionPool -LimitRaw $env:AUTOFLOW_MAX_EXECUTION_LOAD_PER_WORKER)) {
      $todoTicket = Get-ListMatchingFiles -Directory (Join-Path $boardRoot "tickets/todo") -Filter "tickets_*.md" | Select-Object -First 1
      if ($todoTicket) {
        $reason = "todo work remains: claimable todo ticket $($todoTicket.Name) is waiting."
      }
    }
  }
  "verifier" {
    if (-not $hookWorkerId) {
      break
    }

    foreach ($ticket in (Get-ListMatchingFiles -Directory (Join-Path $boardRoot "tickets/verifier") -Filter "tickets_*.md")) {
      $verifierOwner = Get-TicketField -FilePath $ticket.FullName -Field "Verifier Owner"
      $owner = Get-TicketField -FilePath $ticket.FullName -Field "Owner"

      $ownedByVerifier = ($verifierOwner -eq $hookWorkerId) -or
        ((Test-FieldUnassigned $verifierOwner) -and $owner -eq $hookWorkerId) -or
        (Test-FieldUnassigned $verifierOwner)

      if ($ownedByVerifier) {
        $reason = "verifier work remains: ticket $($ticket.Name) is awaiting verification."
        break
      }
    }
  }
  default {
    exit 0
  }
}

Clear-ActiveTicketContext `
  -BoardRoot $boardRoot `
  -ContextPath $contextPath `
  -Role $hookRole `
  -WorkerId $hookWorkerId `
  -ExecutionPool $hookExecutionPool `
  -VerifierPool $hookVerifierPool

if (-not $reason) {
  exit 0
}

Emit-Block -Reason $reason
exit 0
