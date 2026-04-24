[CmdletBinding()]
param(
  [switch]$Background,

  [switch]$Stop,

  [Parameter(Position = 0)]
  [string]$ProjectRoot = ".",

  [Parameter(Position = 1)]
  [string]$BoardDirName = "autoflow",

  [Parameter(Position = 2)]
  [string]$ConfigPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

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

if ($Stop.IsPresent) {
  if (-not (Test-Path -LiteralPath $pidFile -PathType Leaf)) {
    Write-Output "status=not_running"
    Write-Output "pid_file=$pidFile"
    exit 0
  }

  $watchPid = (Get-Content -Raw -LiteralPath $pidFile).Trim()
  if ($watchPid -and (Get-Process -Id ([int]$watchPid) -ErrorAction SilentlyContinue)) {
    Stop-Process -Id ([int]$watchPid) -Force
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
    if ($existingPid -and (Get-Process -Id ([int]$existingPid) -ErrorAction SilentlyContinue)) {
      Write-Output "status=already_running"
      Write-Output "pid=$existingPid"
      Write-Output "pid_file=$pidFile"
      exit 0
    }
  }

  $powershellExe = (Get-Process -Id $PID).Path
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
