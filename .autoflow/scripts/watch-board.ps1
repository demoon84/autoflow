[CmdletBinding()]
param(
  [string]$BoardRoot,
  [string]$ConfigPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function New-AutoflowTempFile {
  $tempRoot = [System.IO.Path]::GetTempPath()
  $path = Join-Path $tempRoot ("autoflow-" + [System.Guid]::NewGuid().ToString("N") + ".tmp")
  New-Item -ItemType File -Path $path -Force | Out-Null
  return $path
}

function Resolve-BoardRoot {
  param([string]$InputPath)

  if ($InputPath) {
    return (Resolve-Path -LiteralPath $InputPath).Path
  }

  return (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}

function Read-ConfigValue {
  param(
    [hashtable]$RouteConfig,
    [string]$Name,
    $DefaultValue
  )

  if ($RouteConfig.ContainsKey($Name) -and $null -ne $RouteConfig[$Name]) {
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

function Write-HookLog {
  param(
    [string]$ResolvedBoardRoot,
    [string]$RouteName,
    [datetime]$EventTime,
    [string]$TriggerPath,
    [string]$ChangeType,
    [int]$ExitCode,
    [string]$Body
  )

  $hooksLogDir = Join-Path $ResolvedBoardRoot "logs/hooks"
  New-Item -ItemType Directory -Force -Path $hooksLogDir | Out-Null

  $timestamp = $EventTime.ToUniversalTime().ToString("yyyyMMddTHHmmssZ")
  $logFile = Join-Path $hooksLogDir "hook_${RouteName}_${timestamp}.md"

  @(
    "# Hook Run"
    ""
    "## Meta"
    ""
    "- Route: $RouteName"
    ('- Trigger Path: `{0}`' -f $TriggerPath)
    "- Change Type: $ChangeType"
    "- Logged At: $($EventTime.ToString("o"))"
    "- Exit Code: $ExitCode"
    ""
    "## Output"
    ""
    '```text'
    $Body
    '```'
  ) -join [Environment]::NewLine | Set-Content -LiteralPath $logFile -NoNewline

  return $logFile
}

function Invoke-Route {
  param(
    [string]$ResolvedBoardRoot,
    [string]$ResolvedConfigPath,
    [string]$RouteName,
    [pscustomobject]$RouteState
  )

  $runHookScript = Join-Path $ResolvedBoardRoot "scripts/run-hook.ps1"
  $powershellExe = (Get-Process -Id $PID).Path
  $stdoutFile = New-AutoflowTempFile
  $stderrFile = New-AutoflowTempFile

  try {
    $argList = @(
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy", "Bypass",
      "-File", $runHookScript,
      "-Role", $RouteName,
      "-BoardRoot", $ResolvedBoardRoot,
      "-ConfigPath", $ResolvedConfigPath
    )

    if ($RouteState.LastPath) {
      $argList += @("-TriggerPath", $RouteState.LastPath)
    }

    if ($RouteState.LastChangeType) {
      $argList += @("-ChangeType", $RouteState.LastChangeType)
    }

    $process = Start-Process -FilePath $powershellExe -ArgumentList $argList -Wait -PassThru -WindowStyle Hidden -RedirectStandardOutput $stdoutFile -RedirectStandardError $stderrFile
    $stdout = if (Test-Path -LiteralPath $stdoutFile) { Get-Content -Raw $stdoutFile } else { "" }
    $stderr = if (Test-Path -LiteralPath $stderrFile) { Get-Content -Raw $stderrFile } else { "" }
    $combined = (@($stdout, $stderr) -join [Environment]::NewLine).Trim()
    $logFile = Write-HookLog -ResolvedBoardRoot $ResolvedBoardRoot -RouteName $RouteName -EventTime (Get-Date) -TriggerPath $RouteState.LastPath -ChangeType $RouteState.LastChangeType -ExitCode $process.ExitCode -Body $combined

    Write-Host "[hook:$RouteName] exit=$($process.ExitCode) trigger=$($RouteState.LastPath) log=$logFile"
    return $process.ExitCode
  }
  finally {
    Remove-Item -LiteralPath $stdoutFile, $stderrFile -Force -ErrorAction SilentlyContinue
  }
}

$resolvedBoardRoot = Resolve-BoardRoot $BoardRoot
if (-not $ConfigPath) {
  $ConfigPath = Join-Path $resolvedBoardRoot "automations/file-watch.psd1"
}
$resolvedConfigPath = (Resolve-Path -LiteralPath $ConfigPath).Path
$config = Load-ConfigData -Path $resolvedConfigPath

$debounceMs = [int](Read-ConfigValue -RouteConfig $config -Name "DebounceMs" -DefaultValue 1500)
$stableWriteDelayMs = [int](Read-ConfigValue -RouteConfig $config -Name "StableWriteDelayMs" -DefaultValue 750)
$routeConfigs = $config["Routes"]

$watchMap = @(
  @{ Route = "ticket"; Path = (Join-Path $resolvedBoardRoot "tickets/backlog"); Filter = "project_*.md"; IncludeSubdirectories = $false },
  @{ Route = "ticket"; Path = (Join-Path $resolvedBoardRoot "tickets/todo"); Filter = "tickets_*.md"; IncludeSubdirectories = $false },
  @{ Route = "ticket"; Path = (Join-Path $resolvedBoardRoot "tickets/verifier"); Filter = "tickets_*.md"; IncludeSubdirectories = $false },
  @{ Route = "plan"; Path = (Join-Path $resolvedBoardRoot "tickets/backlog"); Filter = "project_*.md"; IncludeSubdirectories = $false },
  @{ Route = "plan"; Path = (Join-Path $resolvedBoardRoot "tickets/reject"); Filter = "reject_*.md"; IncludeSubdirectories = $false },
  @{ Route = "plan"; Path = (Join-Path $resolvedBoardRoot "tickets/done"); Filter = "tickets_*.md"; IncludeSubdirectories = $true },
  @{ Route = "todo"; Path = (Join-Path $resolvedBoardRoot "tickets/todo"); Filter = "tickets_*.md"; IncludeSubdirectories = $false },
  @{ Route = "verifier"; Path = (Join-Path $resolvedBoardRoot "tickets/verifier"); Filter = "tickets_*.md"; IncludeSubdirectories = $false }
)

$routeStates = @{}
foreach ($routeName in @("ticket", "plan", "todo", "verifier")) {
  $routeStates[$routeName] = [pscustomobject]@{
    Pending = $false
    LastEventAt = [datetime]::MinValue
    LastPath = ""
    LastChangeType = ""
  }
}

$watchers = @()
$subscriptions = @()

try {
  foreach ($entry in $watchMap) {
    $routeName = $entry.Route
    if (-not $routeConfigs.ContainsKey($routeName)) {
      continue
    }

    $routeConfig = $routeConfigs[$routeName]
    if (-not [bool](Read-ConfigValue -RouteConfig $routeConfig -Name "Enabled" -DefaultValue $true)) {
      continue
    }

    if (-not (Test-Path -LiteralPath $entry.Path)) {
      continue
    }

    $watcher = New-Object System.IO.FileSystemWatcher
    $watcher.Path = $entry.Path
    $watcher.Filter = $entry.Filter
    $watcher.IncludeSubdirectories = [bool]$entry.IncludeSubdirectories
    $watcher.NotifyFilter = [System.IO.NotifyFilters]'FileName, LastWrite, CreationTime'
    $watcher.EnableRaisingEvents = $true
    $watchers += $watcher

    foreach ($eventName in @("Created", "Changed", "Renamed")) {
      $sourceId = "autoflow.watch.$PID.$routeName.$eventName.$([guid]::NewGuid().ToString('N'))"
      $subscriptions += Register-ObjectEvent -InputObject $watcher -EventName $eventName -SourceIdentifier $sourceId -MessageData @{ Route = $routeName }
    }
  }

  Write-Host "Autoflow file-watch hook is running."
  Write-Host "Board Root: $resolvedBoardRoot"
  Write-Host "Config: $resolvedConfigPath"
  Write-Host "Watched routes: ticket, plan, todo, verifier"
  Write-Host "Press Ctrl+C to stop."

  while ($true) {
    foreach ($evt in @(Get-Event)) {
      try {
        $routeName = [string]$evt.MessageData.Route
        if (-not $routeStates.ContainsKey($routeName)) {
          continue
        }

        $eventArgs = $evt.SourceEventArgs
        $changedPath = if ($eventArgs.PSObject.Properties.Name -contains "FullPath") { $eventArgs.FullPath } else { "" }
        $changeType = if ($eventArgs.PSObject.Properties.Name -contains "ChangeType") { [string]$eventArgs.ChangeType } else { $evt.SourceIdentifier }

        $state = $routeStates[$routeName]
        $state.Pending = $true
        $state.LastEventAt = Get-Date
        $state.LastPath = $changedPath
        $state.LastChangeType = $changeType
      }
      finally {
        Remove-Event -EventIdentifier $evt.EventIdentifier -ErrorAction SilentlyContinue
      }
    }

    $now = Get-Date
    foreach ($routeName in @("ticket", "plan", "todo", "verifier")) {
      $state = $routeStates[$routeName]
      if (-not $state.Pending) {
        continue
      }

      $elapsed = ($now - $state.LastEventAt).TotalMilliseconds
      if ($elapsed -lt $debounceMs) {
        continue
      }

      Start-Sleep -Milliseconds $stableWriteDelayMs
      $state.Pending = $false
      [void](Invoke-Route -ResolvedBoardRoot $resolvedBoardRoot -ResolvedConfigPath $resolvedConfigPath -RouteName $routeName -RouteState $state)
      break
    }

    Start-Sleep -Milliseconds 250
  }
}
finally {
  foreach ($subscription in $subscriptions) {
    Unregister-Event -SourceIdentifier $subscription.Name -ErrorAction SilentlyContinue
  }

  foreach ($watcher in $watchers) {
    $watcher.EnableRaisingEvents = $false
    $watcher.Dispose()
  }
}
