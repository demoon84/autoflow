[CmdletBinding()]
param(
  [switch]$Background,

  [switch]$Stop,

  [switch]$Status,

  [Parameter(Position = 0)]
  [string]$ProjectRoot = ".",

  [Parameter(Position = 1)]
  [string]$BoardDirName = "",

  [Parameter(Position = 2)]
  [string]$ConfigPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "cli-common.ps1")

if (-not $BoardDirName) {
  $BoardDirName = Get-DefaultBoardDirName
}

if (@(@($Background.IsPresent, $Stop.IsPresent, $Status.IsPresent) | Where-Object { $_ }).Count -gt 1) {
  throw "Use only one of -Background, -Stop, or -Status."
}

function Get-CurrentPowerShellExe {
  $processPath = Get-Process -Id $PID -ErrorAction SilentlyContinue |
    Select-Object -First 1 -ExpandProperty Path -ErrorAction SilentlyContinue
  if ($processPath) {
    return $processPath
  }

  $pwsh = Get-Command -Name pwsh -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($pwsh) {
    return $pwsh.Source
  }

  $powershell = Get-Command -Name powershell.exe -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($powershell) {
    return $powershell.Source
  }

  return "powershell.exe"
}

function Get-WatchProcess {
  param([string]$PidValue)

  if ([string]::IsNullOrWhiteSpace($PidValue)) {
    return $null
  }

  $parsedPid = 0
  if (-not [int]::TryParse($PidValue, [ref]$parsedPid)) {
    return $null
  }

  if ($parsedPid -le 0) {
    return $null
  }

  return Get-Process -Id $parsedPid -ErrorAction SilentlyContinue
}

if (-not (Test-Path -LiteralPath $ProjectRoot -PathType Container)) {
  throw "Project root not found: $ProjectRoot"
}

$resolvedProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
$resolvedBoardRoot = Join-Path $resolvedProjectRoot $BoardDirName

if (-not (Test-Path -LiteralPath $resolvedBoardRoot -PathType Container)) {
  throw "Board root not found: $resolvedBoardRoot"
}

$watchScript = Join-Path $resolvedBoardRoot "scripts/watch-board.ps1"
if (-not (Test-Path -LiteralPath $watchScript -PathType Leaf)) {
  throw "Board watcher script is missing: $watchScript"
}

$hooksLogDir = Join-Path $resolvedBoardRoot "logs/hooks"
New-Item -ItemType Directory -Force -Path $hooksLogDir | Out-Null
$pidFile = Join-Path $hooksLogDir "watch-board.pid"

if ($Status.IsPresent) {
  Write-Output "board_root=$resolvedBoardRoot"
  Write-Output "pid_file=$pidFile"
  if (-not (Test-Path -LiteralPath $pidFile -PathType Leaf)) {
    Write-Output "status=not_running"
    exit 0
  }

  $watchPid = (Get-Content -Raw -LiteralPath $pidFile).Trim()
  Write-Output "pid=$watchPid"
  if (Get-WatchProcess -PidValue $watchPid) {
    Write-Output "status=running"
    Write-Output ("stdout={0}" -f (Join-Path $hooksLogDir "watch-board.stdout.log"))
    Write-Output ("stderr={0}" -f (Join-Path $hooksLogDir "watch-board.stderr.log"))
  }
  else {
    Write-Output "status=stale_pid"
  }
  exit 0
}

if ($Stop.IsPresent) {
  if (-not (Test-Path -LiteralPath $pidFile -PathType Leaf)) {
    Write-Output "status=not_running"
    Write-Output "pid_file=$pidFile"
    exit 0
  }

  $watchPid = (Get-Content -Raw -LiteralPath $pidFile).Trim()
  $watchProcess = Get-WatchProcess -PidValue $watchPid
  if ($watchProcess) {
    Stop-Process -Id $watchProcess.Id -Force
    Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
    Write-Output "status=stopped"
    Write-Output "pid=$watchPid"
    Write-Output "pid_file=$pidFile"
    exit 0
  }

  Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
  Write-Output "status=stale_pid_removed"
  Write-Output "pid=$watchPid"
  Write-Output "pid_file=$pidFile"
  exit 0
}

$invokeArgs = @{
  BoardRoot = $resolvedBoardRoot
}

if ($ConfigPath) {
  if (-not (Test-Path -LiteralPath $ConfigPath -PathType Leaf)) {
    throw "Hook config not found: $ConfigPath"
  }

  $invokeArgs["ConfigPath"] = (Resolve-Path -LiteralPath $ConfigPath).Path
}

if ($Background.IsPresent) {
  if (Test-Path -LiteralPath $pidFile -PathType Leaf) {
    $existingPid = (Get-Content -Raw -LiteralPath $pidFile).Trim()
    if (Get-WatchProcess -PidValue $existingPid) {
      Write-Output "status=already_running"
      Write-Output "pid=$existingPid"
      Write-Output "pid_file=$pidFile"
      exit 0
    }
  }

  $powershellExe = Get-CurrentPowerShellExe
  $stdoutFile = Join-Path $hooksLogDir "watch-board.stdout.log"
  $stderrFile = Join-Path $hooksLogDir "watch-board.stderr.log"
  $argList = @(
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy", "Bypass",
    "-WindowStyle", "Hidden",
    "-File", $watchScript,
    "-BoardRoot", $resolvedBoardRoot
  )

  if ($ConfigPath) {
    $argList += @("-ConfigPath", $invokeArgs["ConfigPath"])
  }

  $process = Start-Process -FilePath $powershellExe -ArgumentList $argList -WindowStyle Hidden -PassThru -RedirectStandardOutput $stdoutFile -RedirectStandardError $stderrFile
  Set-Content -LiteralPath $pidFile -Value ([string]$process.Id) -NoNewline
  Write-Output "status=started"
  Write-Output "pid=$($process.Id)"
  Write-Output "pid_file=$pidFile"
  Write-Output "stdout=$stdoutFile"
  Write-Output "stderr=$stderrFile"
  exit 0
}

& $watchScript @invokeArgs
