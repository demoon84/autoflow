Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-AutoflowRunnerBoardRoot {
  if (-not [string]::IsNullOrWhiteSpace($env:AUTOFLOW_BOARD_ROOT)) {
    return $env:AUTOFLOW_BOARD_ROOT
  }

  if (Get-Variable -Name BOARD_ROOT -Scope Global -ErrorAction SilentlyContinue) {
    return $Global:BOARD_ROOT
  }

  $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
  $scriptLeaf = Split-Path -Leaf $scriptDir
  if ($scriptLeaf -eq "scripts") {
    return (Resolve-Path (Join-Path $scriptDir "..")).Path
  }

  if ($scriptLeaf -eq "runtime") {
    $projectRoot = (Resolve-Path (Join-Path $scriptDir "..\..")).Path
    $boardRoot = Join-Path $projectRoot ".autoflow"
    if (Test-Path -LiteralPath (Join-Path $boardRoot "runners")) {
      return $boardRoot
    }
  }

  return (Resolve-Path (Join-Path $scriptDir "..")).Path
}

function Get-AutoflowRunnerConfigPath {
  Join-Path (Get-AutoflowRunnerBoardRoot) "runners/config.toml"
}

function Get-AutoflowRunnerStateDirectory {
  Join-Path (Get-AutoflowRunnerBoardRoot) "runners/state"
}

function Get-AutoflowRunnerLogDirectory {
  Join-Path (Get-AutoflowRunnerBoardRoot) "runners/logs"
}

function Test-AutoflowRunnerId {
  param([Parameter(Mandatory = $true)][string]$RunnerId)

  return ($RunnerId -match '^[A-Za-z0-9._-]+$' -and $RunnerId -notmatch '\.\.')
}

function Test-AutoflowRunnerKey {
  param([Parameter(Mandatory = $true)][string]$Key)

  return ($Key -match '^[A-Za-z0-9_.-]+$')
}

function Assert-AutoflowRunnerId {
  param([Parameter(Mandatory = $true)][string]$RunnerId)

  if (-not (Test-AutoflowRunnerId -RunnerId $RunnerId)) {
    throw "Invalid runner id: $RunnerId"
  }
}

function New-AutoflowRunnerDirectories {
  New-Item -ItemType Directory -Force -Path (Get-AutoflowRunnerStateDirectory) | Out-Null
  New-Item -ItemType Directory -Force -Path (Get-AutoflowRunnerLogDirectory) | Out-Null
}

function Get-AutoflowRunnerStatePath {
  param([Parameter(Mandatory = $true)][string]$RunnerId)

  Assert-AutoflowRunnerId -RunnerId $RunnerId
  Join-Path (Get-AutoflowRunnerStateDirectory) "$RunnerId.state"
}

function Get-AutoflowRunnerLogPath {
  param([Parameter(Mandatory = $true)][string]$RunnerId)

  Assert-AutoflowRunnerId -RunnerId $RunnerId
  Join-Path (Get-AutoflowRunnerLogDirectory) "$RunnerId.log"
}

function ConvertFrom-AutoflowTomlValue {
  param([string]$Value)

  $trimmed = $Value.Trim()
  if ($trimmed.StartsWith('"') -and $trimmed.EndsWith('"') -and $trimmed.Length -ge 2) {
    return $trimmed.Substring(1, $trimmed.Length - 2).Replace('\"', '"').Replace('\\', '\')
  }
  return $trimmed
}

function Get-AutoflowRunnerDefinitions {
  param([string]$ConfigPath = (Get-AutoflowRunnerConfigPath))

  if (-not (Test-Path -LiteralPath $ConfigPath)) {
    return @()
  }

  $runners = New-Object System.Collections.Generic.List[object]
  $current = $null

  foreach ($line in Get-Content -LiteralPath $ConfigPath) {
    $trimmed = $line.Trim()
    if ($trimmed -eq "" -or $trimmed.StartsWith("#")) {
      continue
    }

    if ($trimmed -eq "[[runners]]") {
      if ($null -ne $current -and -not [string]::IsNullOrWhiteSpace([string]$current["id"])) {
        $runners.Add([pscustomobject]$current) | Out-Null
      }
      $current = [ordered]@{
        id = ""
        role = ""
        agent = ""
        model = ""
        reasoning = ""
        mode = ""
        interval_seconds = ""
        enabled = "true"
        command = ""
      }
      continue
    }

    if ($null -ne $current -and $trimmed.Contains("=")) {
      $index = $trimmed.IndexOf("=")
      $key = $trimmed.Substring(0, $index).Trim()
      $value = ConvertFrom-AutoflowTomlValue -Value $trimmed.Substring($index + 1)
      if ($current.Contains($key)) {
        $current[$key] = $value
      }
    }
  }

  if ($null -ne $current -and -not [string]::IsNullOrWhiteSpace([string]$current["id"])) {
    $runners.Add([pscustomobject]$current) | Out-Null
  }

  return $runners.ToArray()
}

function Get-AutoflowRunnerDefinition {
  param(
    [Parameter(Mandatory = $true)][string]$RunnerId,
    [string]$ConfigPath = (Get-AutoflowRunnerConfigPath)
  )

  Assert-AutoflowRunnerId -RunnerId $RunnerId
  foreach ($runner in Get-AutoflowRunnerDefinitions -ConfigPath $ConfigPath) {
    if ($runner.id -eq $RunnerId) {
      return $runner
    }
  }
  return $null
}

function Write-AutoflowRunnerState {
  param(
    [Parameter(Mandatory = $true)][string]$RunnerId,
    [Parameter(ValueFromRemainingArguments = $true)][string[]]$Pairs
  )

  Assert-AutoflowRunnerId -RunnerId $RunnerId
  New-AutoflowRunnerDirectories

  $statePath = Get-AutoflowRunnerStatePath -RunnerId $RunnerId
  $updatedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
  $lines = New-Object System.Collections.Generic.List[string]
  $lines.Add("id=$RunnerId") | Out-Null
  $lines.Add("updated_at=$updatedAt") | Out-Null

  foreach ($pair in $Pairs) {
    $index = $pair.IndexOf("=")
    if ($index -lt 1) {
      throw "Runner state pair must use key=value form: $pair"
    }
    $key = $pair.Substring(0, $index)
    if (-not (Test-AutoflowRunnerKey -Key $key)) {
      throw "Invalid runner state key: $key"
    }
    $lines.Add($pair) | Out-Null
  }

  Set-Content -LiteralPath $statePath -Value $lines -Encoding UTF8
}

function Get-AutoflowRunnerStateValue {
  param(
    [Parameter(Mandatory = $true)][string]$RunnerId,
    [Parameter(Mandatory = $true)][string]$Field
  )

  if (-not (Test-AutoflowRunnerKey -Key $Field)) {
    throw "Invalid runner state field: $Field"
  }

  $statePath = Get-AutoflowRunnerStatePath -RunnerId $RunnerId
  if (-not (Test-Path -LiteralPath $statePath)) {
    return $null
  }

  foreach ($line in Get-Content -LiteralPath $statePath) {
    if ($line.StartsWith("$Field=")) {
      return $line.Substring($Field.Length + 1)
    }
  }
  return $null
}

function Add-AutoflowRunnerLog {
  param(
    [Parameter(Mandatory = $true)][string]$RunnerId,
    [Parameter(Mandatory = $true)][string]$Event,
    [Parameter(ValueFromRemainingArguments = $true)][string[]]$Pairs
  )

  Assert-AutoflowRunnerId -RunnerId $RunnerId
  New-AutoflowRunnerDirectories

  $timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
  $parts = New-Object System.Collections.Generic.List[string]
  $parts.Add("timestamp=$timestamp") | Out-Null
  $parts.Add("event=$Event") | Out-Null
  $parts.Add("runner_id=$RunnerId") | Out-Null

  foreach ($pair in $Pairs) {
    $index = $pair.IndexOf("=")
    if ($index -lt 1) {
      throw "Runner log pair must use key=value form: $pair"
    }
    $key = $pair.Substring(0, $index)
    if (-not (Test-AutoflowRunnerKey -Key $key)) {
      throw "Invalid runner log key: $key"
    }
    $parts.Add($pair) | Out-Null
  }

  Add-Content -LiteralPath (Get-AutoflowRunnerLogPath -RunnerId $RunnerId) -Value ($parts -join " ")
}
