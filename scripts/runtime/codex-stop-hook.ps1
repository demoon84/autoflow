[CmdletBinding()]
param(
  [string]$BoardDirName = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
try {
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  $OutputEncoding = $utf8NoBom
  [Console]::OutputEncoding = $utf8NoBom
}
catch {
  # Encoding setup is best-effort; the Stop hook itself must stay fail-open.
}

function Write-HookDiagnostic {
  param([string]$Message)

  try {
    $logRoot = Join-Path $env:USERPROFILE ".codex\log"
    if (-not (Test-Path -LiteralPath $logRoot)) {
      New-Item -ItemType Directory -Path $logRoot -Force | Out-Null
    }

    $timestamp = (Get-Date).ToString("o")
    Add-Content -LiteralPath (Join-Path $logRoot "autoflow-stop-hook.log") -Value "[$timestamp] $Message"
  }
  catch {
    # Diagnostics are best-effort; the Stop hook itself must stay fail-open.
  }
}

function Resolve-ExistingPath {
  param([string]$PathValue)

  if ([string]::IsNullOrWhiteSpace($PathValue)) {
    return $null
  }

  try {
    if (Test-Path -LiteralPath $PathValue) {
      return (Resolve-Path -LiteralPath $PathValue).Path
    }
  }
  catch {
    Write-HookDiagnostic "failed to resolve path '$PathValue': $($_.Exception.Message)"
  }

  return $null
}

function Resolve-ProjectRoot {
  $explicitProjectRoot = Resolve-ExistingPath $env:AUTOFLOW_PROJECT_ROOT
  if ($explicitProjectRoot) {
    return $explicitProjectRoot
  }

  $codexProjectRoot = Resolve-ExistingPath $env:CODEX_PROJECT_DIR
  if ($codexProjectRoot) {
    return $codexProjectRoot
  }

  return (Get-Location).Path
}

function Test-BoardRoot {
  param([string]$Candidate)

  if ([string]::IsNullOrWhiteSpace($Candidate)) {
    return $false
  }

  return (Test-Path -LiteralPath (Join-Path $Candidate "scripts\check-stop.ps1") -PathType Leaf)
}

function Find-BoardRoot {
  $explicitBoardRoot = Resolve-ExistingPath $env:AUTOFLOW_BOARD_ROOT
  if ($explicitBoardRoot -and (Test-BoardRoot $explicitBoardRoot)) {
    return $explicitBoardRoot
  }

  $effectiveBoardDirName = $script:BoardDirName
  if ([string]::IsNullOrWhiteSpace($effectiveBoardDirName)) {
    $effectiveBoardDirName = $env:AUTOFLOW_BOARD_DIR_NAME
  }
  if ([string]::IsNullOrWhiteSpace($effectiveBoardDirName)) {
    $effectiveBoardDirName = ".autoflow"
  }

  $current = Resolve-ProjectRoot
  while ($current) {
    if (Test-BoardRoot $current) {
      return $current
    }

    $childBoard = Join-Path $current $effectiveBoardDirName
    if (Test-BoardRoot $childBoard) {
      return (Resolve-Path -LiteralPath $childBoard).Path
    }

    $parent = Split-Path -Parent $current
    if ([string]::IsNullOrWhiteSpace($parent) -or $parent -eq $current) {
      break
    }
    $current = $parent
  }

  return $null
}

function Resolve-ProjectRootFromBoard {
  param([string]$BoardRoot)

  $marker = Join-Path $BoardRoot ".project-root"
  if (Test-Path -LiteralPath $marker -PathType Leaf) {
    $markerValue = (Get-Content -LiteralPath $marker -Raw).Trim()
    if ([string]::IsNullOrWhiteSpace($markerValue)) {
      $markerValue = ".."
    }

    if ([System.IO.Path]::IsPathRooted($markerValue)) {
      return [System.IO.Path]::GetFullPath($markerValue)
    }

    return [System.IO.Path]::GetFullPath((Join-Path $BoardRoot $markerValue))
  }

  return (Split-Path -Parent $BoardRoot)
}

function Invoke-BoardStopHook {
  param([string]$BoardRoot)

  $hookScript = Join-Path $BoardRoot "scripts\check-stop.ps1"
  $powershellExe = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"
  if (-not (Test-Path -LiteralPath $powershellExe -PathType Leaf)) {
    $powershellExe = "powershell.exe"
  }

  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $powershellExe
  [void]$psi.ArgumentList.Add("-NoLogo")
  [void]$psi.ArgumentList.Add("-NoProfile")
  [void]$psi.ArgumentList.Add("-ExecutionPolicy")
  [void]$psi.ArgumentList.Add("Bypass")
  [void]$psi.ArgumentList.Add("-File")
  [void]$psi.ArgumentList.Add($hookScript)
  $psi.UseShellExecute = $false
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $psi.Environment["AUTOFLOW_BOARD_ROOT"] = $BoardRoot
  if ([string]::IsNullOrWhiteSpace($psi.Environment["AUTOFLOW_PROJECT_ROOT"])) {
    $psi.Environment["AUTOFLOW_PROJECT_ROOT"] = Resolve-ProjectRootFromBoard $BoardRoot
  }

  $process = New-Object System.Diagnostics.Process
  $process.StartInfo = $psi
  [void]$process.Start()
  $stdout = $process.StandardOutput.ReadToEnd()
  $stderr = $process.StandardError.ReadToEnd()
  $process.WaitForExit()

  if ($stdout) {
    [Console]::Out.Write($stdout)
  }

  if ($process.ExitCode -ne 0 -or -not [string]::IsNullOrWhiteSpace($stderr)) {
    Write-HookDiagnostic "board stop hook exit=$($process.ExitCode) board='$BoardRoot' stderr='$($stderr.Trim())'"
  }
}

try {
  if ($env:AUTOFLOW_STOP_BYPASS -match '^(1|true|TRUE|yes|YES|on|ON)$') {
    exit 0
  }

  $boardRoot = Find-BoardRoot
  if (-not $boardRoot) {
    exit 0
  }

  Invoke-BoardStopHook -BoardRoot $boardRoot
  exit 0
}
catch {
  Write-HookDiagnostic "dispatcher failed open: $($_.Exception.Message)"
  exit 0
}
