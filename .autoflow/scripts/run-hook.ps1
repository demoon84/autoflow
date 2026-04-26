[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("ticket", "ticket-owner", "owner", "plan", "todo", "verifier")]
  [string]$Role,

  [string]$BoardRoot,

  [string]$ConfigPath,

  [string]$TriggerPath = "",

  [string]$ChangeType = "",

  [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ($Role -in @("ticket-owner", "owner")) {
  $Role = "ticket"
}

function Resolve-BoardRoot {
  param([string]$InputPath)

  if ($InputPath) {
    return (Resolve-Path -LiteralPath $InputPath).Path
  }

  return (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}

function Convert-ToBashPath {
  param([string]$PathValue)

  if ($PathValue -match '^[A-Za-z]:[\\/](.*)$') {
    $drive = $PathValue.Substring(0, 1).ToLowerInvariant()
    $rest = ($PathValue.Substring(2) -replace '\\', '/').TrimStart('/')
    return "/mnt/$drive/$rest"
  }

  return ($PathValue -replace '\\', '/')
}

function Read-RouteConfig {
  param(
    [hashtable]$Config,
    [string]$RouteName
  )

  if (-not $Config.ContainsKey("Routes")) {
    throw "Routes section is missing in hook config."
  }

  $routes = $Config["Routes"]
  if (-not $routes.ContainsKey($RouteName)) {
    throw "Route '$RouteName' is missing in hook config."
  }

  return $routes[$RouteName]
}

function Get-Setting {
  param(
    [hashtable]$RouteConfig,
    [string]$Name,
    $DefaultValue
  )

  if ($RouteConfig.ContainsKey($Name) -and $null -ne $RouteConfig[$Name] -and "$($RouteConfig[$Name])" -ne "") {
    return $RouteConfig[$Name]
  }

  return $DefaultValue
}

function Load-ConfigData {
  param([string]$Path)

  $importCommand = Get-Command -Name Import-PowerShellDataFile -ErrorAction SilentlyContinue
  if ($importCommand) {
    return Import-PowerShellDataFile -Path $Path
  }

  $raw = Get-Content -Raw -LiteralPath $Path
  $data = & ([scriptblock]::Create($raw))
  if ($data -isnot [hashtable]) {
    throw "Hook config must evaluate to a hashtable: $Path"
  }

  return $data
}

function Build-ShellCommand {
  param(
    [string]$RouteName,
    [hashtable]$RouteConfig,
    [string]$ResolvedBoardRoot
  )

  $boardRootBash = Convert-ToBashPath $ResolvedBoardRoot
  $defaultWorkerId = if ($RouteName -eq "ticket") { "owner-hook" } else { "$RouteName-hook" }
  $workerId = Get-Setting $RouteConfig "WorkerId" $defaultWorkerId

  switch ($RouteName) {
    "ticket" {
      return "cd ""$boardRootBash"" && AUTOFLOW_BACKGROUND=1 AUTOFLOW_ROLE=ticket-owner AUTOFLOW_WORKER_ID=""$workerId"" ./scripts/start-ticket-owner.sh"
    }
    "plan" {
      return "cd ""$boardRootBash"" && AUTOFLOW_BACKGROUND=1 AUTOFLOW_ROLE=plan AUTOFLOW_WORKER_ID=""$workerId"" ./scripts/start-plan.sh"
    }
    "todo" {
      $executionPool = Get-Setting $RouteConfig "ExecutionPool" $workerId
      $verifierPool = Get-Setting $RouteConfig "VerifierPool" "verify-hook"
      $maxLoad = Get-Setting $RouteConfig "MaxExecutionLoadPerWorker" 1
      return "cd ""$boardRootBash"" && AUTOFLOW_BACKGROUND=1 AUTOFLOW_ROLE=todo AUTOFLOW_WORKER_ID=""$workerId"" AUTOFLOW_EXECUTION_POOL=""$executionPool"" AUTOFLOW_VERIFIER_POOL=""$verifierPool"" AUTOFLOW_MAX_EXECUTION_LOAD_PER_WORKER=$maxLoad ./scripts/start-todo.sh"
    }
    "verifier" {
      return "cd ""$boardRootBash"" && AUTOFLOW_BACKGROUND=1 AUTOFLOW_ROLE=verifier AUTOFLOW_WORKER_ID=""$workerId"" ./scripts/start-verifier.sh"
    }
    default {
      throw "Unsupported shell route: $RouteName"
    }
  }
}

function Get-BoardPromptRoot {
  param(
    [string]$ResolvedBoardRoot,
    [string]$ResolvedProjectRoot
  )

  $trimChars = [char[]]@([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar)
  $fullBoardRoot = [System.IO.Path]::GetFullPath($ResolvedBoardRoot).TrimEnd($trimChars)
  $fullProjectRoot = [System.IO.Path]::GetFullPath($ResolvedProjectRoot).TrimEnd($trimChars)

  if ($fullBoardRoot -eq $fullProjectRoot) {
    return "."
  }

  $projectPrefix = $fullProjectRoot + [System.IO.Path]::DirectorySeparatorChar
  if ($fullBoardRoot.StartsWith($projectPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
    return ($fullBoardRoot.Substring($projectPrefix.Length) -replace '\\', '/')
  }

  return ($fullBoardRoot -replace '\\', '/')
}

function Build-CodexPrompt {
  param(
    [string]$RouteName,
    [string]$ResolvedBoardRoot,
    [string]$ResolvedProjectRoot,
    [hashtable]$RouteConfig,
    [string]$HookTriggerPath,
    [string]$HookChangeType
  )

  $defaultWorkerId = if ($RouteName -eq "ticket") { "owner-hook" } else { "$RouteName-hook" }
  $workerId = Get-Setting $RouteConfig "WorkerId" $defaultWorkerId
  $triggerLine = if ($HookTriggerPath) { ('- Trigger Path: `{0}`' -f $HookTriggerPath) } else { "- Trigger Path: (none)" }
  $changeLine = if ($HookChangeType) { "- Change Type: $HookChangeType" } else { "- Change Type: (unknown)" }
  $boardPromptRoot = Get-BoardPromptRoot -ResolvedBoardRoot $ResolvedBoardRoot -ResolvedProjectRoot $ResolvedProjectRoot

  switch ($RouteName) {
    "ticket" {
      return @(
        "Autoflow Hook Mode: ticket-owner"
        ""
        ('This run was triggered by the file watcher for the board at `{0}` (project root: `{1}`).' -f $ResolvedBoardRoot, $ResolvedProjectRoot)
        "Do NOT create, pause, delete, or rely on heartbeat automations in this run. This is a one-shot hook turn."
        ""
        "Worker identity:"
        "- Role: ticket-owner"
        "- Worker Id: $workerId"
        "- Permission Mode: pre-authorized within the current project and board scope"
        ""
        "Hook context:"
        $triggerLine
        $changeLine
        ""
        "Do exactly one current hook turn:"
        "1. Read the repo instructions, $boardPromptRoot/agents/ticket-owner-agent.md, and the current board state."
        "2. Run $boardPromptRoot/scripts/start-ticket-owner.ps1 to resume an owned inprogress ticket, claim a ready ticket, adopt a legacy verifier ticket, or create one inprogress ticket from a populated backlog spec."
        "3. Keep the same owner responsible for mini-plan, implementation, verification command execution, evidence recording, and done/reject movement. Do not split the work across planner/todo/verifier roles."
        "4. Implement only within the ticket's Allowed Paths and record durable progress in Notes, Result, and Resume Context."
        "5. When ready, run $boardPromptRoot/scripts/verify-ticket-owner.ps1 <ticket-id> to write command/output/evidence, then $boardPromptRoot/scripts/finish-ticket-owner.ps1 <ticket-id> pass ""<summary>"" or fail ""<concrete reason>""."
        "6. Treat local verification commands, board file moves, worktree integration, and local git commit on pass as pre-authorized inside the current project/board. Never git push."
        "7. If there is no actionable work, leave the runner idle with a concise reason."
        "8. Exit after the current hook turn is complete."
      ) -join [Environment]::NewLine
    }
    "plan" {
      return @(
        "Autoflow Hook Mode: plan"
        ""
        ('This run was triggered by the file watcher for the board at `{0}` (project root: `{1}`).' -f $ResolvedBoardRoot, $ResolvedProjectRoot)
        "Do NOT create, pause, delete, or rely on heartbeat automations in this run. This is a one-shot hook turn."
        ""
        "Worker identity:"
        "- Role: plan"
        "- Worker Id: $workerId"
        ""
        "Hook context:"
        $triggerLine
        $changeLine
        ""
        "Do exactly one current hook turn:"
        "1. Read the repo instructions and Autoflow board files."
        "2. Inspect $boardPromptRoot/tickets/backlog/, $boardPromptRoot/tickets/plan/, $boardPromptRoot/tickets/reject/, and the current ticket state."
        "3. If a populated spec has no real plan or only a placeholder plan, create or update the matching plan draft."
        "4. If a plan is actionable, generate todo tickets as appropriate."
        "5. If reject_NNN.md files exist, fold each ## Reject Reason back into the matching plan as a new execution candidate; after the retry todo is created, archive the reject file under $boardPromptRoot/tickets/done/<project-key>/."
        "6. If this hook was triggered by a pass into $boardPromptRoot/tickets/done/<project-key>/, treat that as a signal to scan backlog again and continue with the next populated spec when one is waiting."
        "7. Do not stop at the first generated plan if another populated backlog spec still lacks a real plan or only has a placeholder plan. Drain the backlog for planning work as far as this current hook turn reasonably can."
        "8. Keep chat output short; durable context belongs in Obsidian links and board files, and the next hook turn should reload from $boardPromptRoot/ rather than chat history."
        "9. Do not claim todo work, do not implement code, do not verify, do not commit, and do not push."
        "10. Exit after the current hook turn is complete."
      ) -join [Environment]::NewLine
    }
    "todo" {
      return @(
        "Autoflow Hook Mode: todo"
        ""
        ('This run was triggered by the file watcher for the board at `{0}` (project root: `{1}`).' -f $ResolvedBoardRoot, $ResolvedProjectRoot)
        "Do NOT create, pause, delete, or rely on heartbeat automations in this run. This is a one-shot hook turn."
        ""
        "Worker identity:"
        "- Role: todo"
        "- Worker Id: $workerId"
        ""
        "Hook context:"
        $triggerLine
        $changeLine
        ""
        "Do exactly one current hook turn:"
        "1. Read the repo instructions and Autoflow board files."
        '2. Resume any existing inprogress ticket owned by `$workerId` if one exists; otherwise claim one todo ticket.'
        "3. Implement only within each ticket's Allowed Paths."
        "4. If you resume an existing inprogress ticket, refresh the active ticket context with powershell -ExecutionPolicy Bypass -File $boardPromptRoot/scripts/set-thread-context.ps1 todo <worker-id> <ticket-id> executing <ticket-path> on Windows, or $boardPromptRoot/scripts/set-thread-context.sh todo <worker-id> <ticket-id> executing <ticket-path> in Bash-only environments, before continuing."
        "5. Update Notes, Last Updated, Next Action, and Resume Context as you work."
        "5. Board stage is authoritative. If a ticket is in $boardPromptRoot/tickets/todo/ or $boardPromptRoot/tickets/inprogress/, treat it as todo implementation work even when the Title, Goal, or Done When sounds like checking or verification."
        "6. If Done When is satisfied, fill Result.Summary and run powershell -ExecutionPolicy Bypass -File $boardPromptRoot/scripts/handoff-todo.ps1 <ticket-id-or-path> on Windows, or $boardPromptRoot/scripts/handoff-todo.sh <ticket-id-or-path> in Bash-only environments. The handoff runtime moves the ticket to $boardPromptRoot/tickets/verifier/, marks Verification pending, and clears only the active ticket context so the todo role can continue with the next ticket."
        "7. Keep chat output short; durable context belongs in Resume Context, Notes, Result, and Obsidian links."
        "8. Do not verify, do not commit, and do not push."
        "9. Exit after the current hook turn is complete."
      ) -join [Environment]::NewLine
    }
    "verifier" {
      return @(
        "Autoflow Hook Mode: verifier"
        ""
        ('This run was triggered by the file watcher for the board at `{0}` (project root: `{1}`).' -f $ResolvedBoardRoot, $ResolvedProjectRoot)
        "Do NOT create, pause, delete, or rely on heartbeat automations in this run. This is a one-shot hook turn."
        ""
        "Worker identity:"
        "- Role: verifier"
        "- Worker Id: $workerId"
        "- Permission Mode: pre-authorized within the current project and board scope"
        ""
        "Hook context:"
        $triggerLine
        $changeLine
        ""
        "Do exactly one current hook turn:"
        "1. Read the repo instructions and Autoflow board files."
        "2. Pick one ticket from $boardPromptRoot/tickets/verifier/."
        "3. Verify it against the referenced spec and verifier rules."
        "4. Treat local verification commands, browser checks, ticket/log file moves, and local git commit inside the current project/board as pre-authorized. Do not ask the user for permission."
        "5. Browser policy: prefer non-browser checks; if rendering is required, do not use Playwright. Use the current agent browser tool instead: Codex uses the Codex browser tool, Claude uses the Claude browser tool. Close any opened browser tool tab before ending this turn unless the user explicitly asked to keep it open."
        "6. Write or update $boardPromptRoot/tickets/inprogress/verify_NNN.md, then let write-verifier-log archive it beside the final ticket when the verification finishes."
        "7. Write a verifier completion log under $boardPromptRoot/logs/."
        "8. Pass: move the ticket to the matching $boardPromptRoot/tickets/done/<project-key>/ folder and make a local git commit if the project uses git. Use commit message format [ticket title] concise change summary; take the bracket text from the ticket Title and keep the summary to one short line."
        "9. Fail: append ## Reject Reason and move the ticket to $boardPromptRoot/tickets/reject/reject_NNN.md."
        "10. The write-verifier-log runtime clears the active runtime context after pass/fail logging; prefer write-verifier-log.ps1 on Windows and use .sh only in Bash-only environments. Rely on Obsidian links and board files for the next verification target."
        "11. Never git push."
        "12. Exit after the current hook turn is complete."
      ) -join [Environment]::NewLine
    }
    default {
      throw "Unsupported codex route: $RouteName"
    }
  }
}

function Invoke-CapturedProcess {
  param(
    [string]$FilePath,
    [string[]]$ArgumentList,
    [hashtable]$EnvironmentOverrides
  )

  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $FilePath
  foreach ($arg in $ArgumentList) {
    [void]$psi.ArgumentList.Add($arg)
  }
  $psi.UseShellExecute = $false
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true

  foreach ($key in $EnvironmentOverrides.Keys) {
    $psi.Environment[$key] = [string]$EnvironmentOverrides[$key]
  }

  $process = New-Object System.Diagnostics.Process
  $process.StartInfo = $psi
  [void]$process.Start()

  $stdout = $process.StandardOutput.ReadToEnd()
  $stderr = $process.StandardError.ReadToEnd()
  $process.WaitForExit()

  return [pscustomobject]@{
    ExitCode = $process.ExitCode
    StdOut = $stdout
    StdErr = $stderr
  }
}

$resolvedBoardRoot = Resolve-BoardRoot $BoardRoot
$projectRootMarker = Join-Path $resolvedBoardRoot ".project-root"
$resolvedProjectRoot = Split-Path -Parent $resolvedBoardRoot

if (Test-Path -LiteralPath $projectRootMarker) {
  $markerValue = (Get-Content -Raw $projectRootMarker).Trim()
  if (-not $markerValue) {
    $markerValue = ".."
  }
  if ([System.IO.Path]::IsPathRooted($markerValue)) {
    $resolvedProjectRoot = $markerValue
  }
  else {
    $resolvedProjectRoot = [System.IO.Path]::GetFullPath((Join-Path $resolvedBoardRoot $markerValue))
  }
}

if (-not $ConfigPath) {
  $ConfigPath = Join-Path $resolvedBoardRoot "automations/file-watch.psd1"
}

$config = Load-ConfigData -Path $ConfigPath
$routeConfig = Read-RouteConfig -Config $config -RouteName $Role
$dispatch = Get-Setting $routeConfig "Dispatch" "codex"
$dryRunEnabled = [bool](Get-Setting $routeConfig "DryRun" $false) -or $DryRun.IsPresent
$customCommand = Get-Setting $routeConfig "Command" ""
$defaultWorkerId = if ($Role -eq "ticket") { "owner-hook" } else { "$Role-hook" }
$workerId = Get-Setting $routeConfig "WorkerId" $defaultWorkerId

$environmentOverrides = @{
  "AUTOFLOW_ROLE" = if ($Role -eq "ticket") { "ticket-owner" } else { $Role }
  "AUTOFLOW_WORKER_ID" = $workerId
  "AUTOFLOW_BOARD_ROOT" = $resolvedBoardRoot
  "AUTOFLOW_PROJECT_ROOT" = $resolvedProjectRoot
  "AUTOFLOW_BACKGROUND" = "1"
}

if ($Role -eq "todo") {
  $environmentOverrides["AUTOFLOW_EXECUTION_POOL"] = [string](Get-Setting $routeConfig "ExecutionPool" $workerId)
  $environmentOverrides["AUTOFLOW_VERIFIER_POOL"] = [string](Get-Setting $routeConfig "VerifierPool" "verify-hook")
  $environmentOverrides["AUTOFLOW_MAX_EXECUTION_LOAD_PER_WORKER"] = [string](Get-Setting $routeConfig "MaxExecutionLoadPerWorker" 1)
}

$commandSummary = ""
$promptSummary = ""

if ($customCommand) {
  $dispatch = "shell"
  $shellCommand = $customCommand
}
elseif ($dispatch -eq "shell") {
  $shellCommand = Build-ShellCommand -RouteName $Role -RouteConfig $routeConfig -ResolvedBoardRoot $resolvedBoardRoot
}
else {
  $shellCommand = ""
}

if ($dispatch -eq "shell") {
  $commandSummary = $shellCommand

  if ($dryRunEnabled) {
    Write-Output "status=dry_run"
    Write-Output "role=$Role"
    Write-Output "dispatch=shell"
    Write-Output "command=$commandSummary"
    exit 0
  }

  $result = Invoke-CapturedProcess -FilePath "bash" -ArgumentList @("-lc", $shellCommand) -EnvironmentOverrides $environmentOverrides
  Write-Output "status=$(if ($result.ExitCode -eq 0) { "ok" } else { "fail" })"
  Write-Output "role=$Role"
  Write-Output "dispatch=shell"
  Write-Output "command=$commandSummary"
  if ($TriggerPath) { Write-Output "trigger_path=$TriggerPath" }
  if ($ChangeType) { Write-Output "change_type=$ChangeType" }
  Write-Output "stdout<<EOF"
  Write-Output $result.StdOut
  Write-Output "EOF"
  Write-Output "stderr<<EOF"
  Write-Output $result.StdErr
  Write-Output "EOF"
  exit $result.ExitCode
}

$prompt = Build-CodexPrompt -RouteName $Role -ResolvedBoardRoot $resolvedBoardRoot -ResolvedProjectRoot $resolvedProjectRoot -RouteConfig $routeConfig -HookTriggerPath $TriggerPath -HookChangeType $ChangeType
$promptSummary = $prompt

$codexArgs = New-Object System.Collections.Generic.List[string]
$codexArgs.Add("exec")
$codexArgs.Add("--dangerously-bypass-approvals-and-sandbox")
$codexArgs.Add("--skip-git-repo-check")
$codexArgs.Add("-C")
$codexArgs.Add($resolvedProjectRoot)

$modelName = [string](Get-Setting $routeConfig "Model" "")
if ($modelName) {
  $codexArgs.Add("-m")
  $codexArgs.Add($modelName)
}

$codexArgs.Add($prompt)

if ($dryRunEnabled) {
  Write-Output "status=dry_run"
  Write-Output "role=$Role"
  Write-Output "dispatch=codex"
  Write-Output "project_root=$resolvedProjectRoot"
  Write-Output "prompt<<EOF"
  Write-Output $promptSummary
  Write-Output "EOF"
  exit 0
}

$codexResult = Invoke-CapturedProcess -FilePath "codex" -ArgumentList $codexArgs.ToArray() -EnvironmentOverrides $environmentOverrides
Write-Output "status=$(if ($codexResult.ExitCode -eq 0) { "ok" } else { "fail" })"
Write-Output "role=$Role"
Write-Output "dispatch=codex"
Write-Output "project_root=$resolvedProjectRoot"
if ($TriggerPath) { Write-Output "trigger_path=$TriggerPath" }
if ($ChangeType) { Write-Output "change_type=$ChangeType" }
Write-Output "prompt<<EOF"
Write-Output $promptSummary
Write-Output "EOF"
Write-Output "stdout<<EOF"
Write-Output $codexResult.StdOut
Write-Output "EOF"
Write-Output "stderr<<EOF"
Write-Output $codexResult.StdErr
Write-Output "EOF"
exit $codexResult.ExitCode
