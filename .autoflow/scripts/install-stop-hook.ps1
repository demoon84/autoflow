[CmdletBinding()]
param(
  [Parameter(Position = 0)]
  [ValidateSet("install", "remove", "status")]
  [string]$Action = "install"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-BoardRoot {
  $scriptDir = if (-not [string]::IsNullOrWhiteSpace($PSScriptRoot)) {
    $PSScriptRoot
  }
  elseif ($MyInvocation.MyCommand.Path) {
    Split-Path -Parent $MyInvocation.MyCommand.Path
  }
  else {
    (Get-Location).Path
  }
  $scriptDirName = Split-Path -Leaf $scriptDir
  if ($scriptDirName -eq "runtime") {
    return (Resolve-Path (Join-Path $scriptDir "..\..")).Path
  }

  return (Resolve-Path (Join-Path $scriptDir "..")).Path
}

function Resolve-ProjectRoot {
  param([string]$BoardRoot)

  if ($env:AUTOFLOW_PROJECT_ROOT) {
    return (Resolve-Path -LiteralPath $env:AUTOFLOW_PROJECT_ROOT).Path
  }

  $markerPath = Join-Path $BoardRoot ".project-root"
  if (Test-Path -LiteralPath $markerPath -PathType Leaf) {
    $configured = (Get-Content -Raw -LiteralPath $markerPath).Trim()
    if (-not $configured) {
      $configured = ".."
    }

    if ([System.IO.Path]::IsPathRooted($configured)) {
      return (Resolve-Path -LiteralPath $configured).Path
    }

    return (Resolve-Path -LiteralPath (Join-Path $BoardRoot $configured)).Path
  }

  return (Resolve-Path -LiteralPath (Join-Path $BoardRoot "..")).Path
}

function Resolve-ManifestPath {
  param([string]$RawPath)

  if (-not $RawPath) {
    $RawPath = Join-Path $HOME ".codex/hooks.json"
  }

  if ($RawPath -eq "~") {
    return $HOME
  }

  if ($RawPath.StartsWith("~/")) {
    return (Join-Path $HOME $RawPath.Substring(2))
  }

  if ($RawPath.StartsWith('~\')) {
    return (Join-Path $HOME $RawPath.Substring(2))
  }

  if ([System.IO.Path]::IsPathRooted($RawPath)) {
    return $RawPath
  }

  return [System.IO.Path]::GetFullPath((Join-Path (Get-Location).Path $RawPath))
}

function Quote-CommandArg {
  param([string]$Value)

  return '"' + $Value.Replace('"', '\"') + '"'
}

function Get-DefaultStopHookCommand {
  param([string]$CheckStopScript)

  $powershellExe = Get-Process -Id $PID -ErrorAction SilentlyContinue |
    Select-Object -First 1 -ExpandProperty Path -ErrorAction SilentlyContinue
  if (-not $powershellExe) {
    $pwsh = Get-Command -Name pwsh -ErrorAction SilentlyContinue | Select-Object -First 1
    $powershellExe = if ($pwsh) { $pwsh.Source } else { "powershell.exe" }
  }
  return ('{0} -NoLogo -NoProfile -ExecutionPolicy Bypass -File {1}' -f (Quote-CommandArg $powershellExe), (Quote-CommandArg $CheckStopScript))
}

function Get-JsonPropertyValue {
  param($Object, [string]$Name)

  if ($null -eq $Object) {
    return $null
  }

  $property = $Object.PSObject.Properties[$Name]
  if ($null -eq $property) {
    return $null
  }

  return $property.Value
}

function Set-JsonPropertyValue {
  param($Object, [string]$Name, $Value)

  $property = $Object.PSObject.Properties[$Name]
  if ($null -ne $property) {
    $property.Value = $Value
    return
  }

  $Object | Add-Member -NotePropertyName $Name -NotePropertyValue $Value
}

function Remove-JsonProperty {
  param($Object, [string]$Name)

  $property = $Object.PSObject.Properties[$Name]
  if ($null -ne $property) {
    [void]$Object.PSObject.Properties.Remove($Name)
  }
}

function New-MutableList {
  param($Values)

  $list = New-Object System.Collections.ArrayList
  if ($Values -is [System.Collections.IEnumerable] -and $Values -isnot [string]) {
    foreach ($value in $Values) {
      [void]$list.Add($value)
    }
  }

  return $list
}

function Test-HookMatches {
  param($Hook, [string]$CommandText)

  if ($null -eq $Hook) {
    return $false
  }

  $hookType = Get-JsonPropertyValue $Hook "type"
  $hookCommand = Get-JsonPropertyValue $Hook "command"
  return $hookType -eq "command" -and $hookCommand -eq $CommandText
}

function Test-EntryMatches {
  param($Entry, [string]$CommandText)

  if ($null -eq $Entry) {
    return $false
  }

  $hooks = Get-JsonPropertyValue $Entry "hooks"
  if ($hooks -isnot [System.Collections.IEnumerable] -or $hooks -is [string]) {
    return $false
  }

  foreach ($hook in $hooks) {
    if (Test-HookMatches -Hook $hook -CommandText $CommandText) {
      return $true
    }
  }

  return $false
}

$boardRoot = Get-BoardRoot
$projectRoot = Resolve-ProjectRoot -BoardRoot $boardRoot
if ($env:AUTOFLOW_CODEX_HOOKS_PATH) {
  $manifestPath = Resolve-ManifestPath $env:AUTOFLOW_CODEX_HOOKS_PATH
}
elseif ($env:CODEX_HOOKS_PATH) {
  $manifestPath = Resolve-ManifestPath $env:CODEX_HOOKS_PATH
}
else {
  $manifestPath = Resolve-ManifestPath ""
}

$checkStopScript = Join-Path $boardRoot "scripts/check-stop.ps1"
$commandText = if ($env:AUTOFLOW_STOP_HOOK_COMMAND) { $env:AUTOFLOW_STOP_HOOK_COMMAND } else { Get-DefaultStopHookCommand -CheckStopScript $checkStopScript }
$timeoutValue = 30
if ($env:AUTOFLOW_STOP_HOOK_TIMEOUT) {
  $timeoutValue = [int]$env:AUTOFLOW_STOP_HOOK_TIMEOUT
}

$manifestExists = Test-Path -LiteralPath $manifestPath -PathType Leaf
if ($manifestExists) {
  $raw = (Get-Content -Raw -LiteralPath $manifestPath).Trim()
  $data = if ($raw) { $raw | ConvertFrom-Json } else { [pscustomobject]@{} }
}
else {
  $data = [pscustomobject]@{}
}

if ($data -is [System.Collections.IEnumerable] -and $data -isnot [string] -and $data -isnot [pscustomobject]) {
  throw "hook manifest root must be a JSON object: $manifestPath"
}

$hooksObject = Get-JsonPropertyValue $data "hooks"
if ($null -eq $hooksObject) {
  $hooksObject = [pscustomobject]@{}
  Set-JsonPropertyValue -Object $data -Name "hooks" -Value $hooksObject
}
elseif ($hooksObject -is [System.Collections.IEnumerable] -and $hooksObject -isnot [string] -and $hooksObject -isnot [pscustomobject]) {
  throw "hook manifest 'hooks' must be a JSON object: $manifestPath"
}

$stopEntriesValue = Get-JsonPropertyValue $hooksObject "Stop"
if ($null -eq $stopEntriesValue) {
  $stopEntries = New-MutableList
  Set-JsonPropertyValue -Object $hooksObject -Name "Stop" -Value $stopEntries
}
elseif ($stopEntriesValue -is [System.Collections.IEnumerable] -and $stopEntriesValue -isnot [string]) {
  $stopEntries = New-MutableList $stopEntriesValue
  Set-JsonPropertyValue -Object $hooksObject -Name "Stop" -Value $stopEntries
}
else {
  if ($Action -eq "status") {
    $stopEntries = New-MutableList
  }
  else {
    throw "hook manifest 'hooks.Stop' must be a JSON array: $manifestPath"
  }
}

$installedBefore = $false
foreach ($entry in $stopEntries) {
  if (Test-EntryMatches -Entry $entry -CommandText $commandText) {
    $installedBefore = $true
    break
  }
}

$changed = $false

switch ($Action) {
  "install" {
    if (-not $installedBefore) {
      [void]$stopEntries.Add([pscustomobject]@{
          hooks = @(
            [pscustomobject]@{
              type = "command"
              command = $commandText
              timeout = $timeoutValue
            }
          )
        })
      $changed = $true
    }
  }
  "remove" {
    $newStopEntries = New-MutableList
    foreach ($entry in $stopEntries) {
      $hooksList = Get-JsonPropertyValue $entry "hooks"
      if ($hooksList -isnot [System.Collections.IEnumerable] -or $hooksList -is [string]) {
        [void]$newStopEntries.Add($entry)
        continue
      }

      $filteredHooks = New-MutableList
      $originalCount = 0
      foreach ($hook in $hooksList) {
        $originalCount += 1
        if (-not (Test-HookMatches -Hook $hook -CommandText $commandText)) {
          [void]$filteredHooks.Add($hook)
        }
      }

      if ($filteredHooks.Count -ne $originalCount) {
        $changed = $true
      }

      if ($filteredHooks.Count -gt 0) {
        Set-JsonPropertyValue -Object $entry -Name "hooks" -Value @($filteredHooks)
        [void]$newStopEntries.Add($entry)
      }
    }

    Set-JsonPropertyValue -Object $hooksObject -Name "Stop" -Value @($newStopEntries)
    $stopEntries = $newStopEntries
  }
}

$installedAfter = $false
$currentStopEntries = Get-JsonPropertyValue $hooksObject "Stop"
if ($currentStopEntries -is [System.Collections.IEnumerable] -and $currentStopEntries -isnot [string]) {
  foreach ($entry in $currentStopEntries) {
    if (Test-EntryMatches -Entry $entry -CommandText $commandText) {
      $installedAfter = $true
      break
    }
  }
}

if (($Action -eq "install" -or $Action -eq "remove") -and $changed) {
  $stopPropertyValue = Get-JsonPropertyValue $hooksObject "Stop"
  if ($null -eq $stopPropertyValue -or @($stopPropertyValue).Count -eq 0) {
    Remove-JsonProperty -Object $hooksObject -Name "Stop"
  }

  if (-not $manifestExists) {
    if (-not (Get-JsonPropertyValue $data "name")) {
      Set-JsonPropertyValue -Object $data -Name "name" -Value "autoflow"
    }
    if (-not (Get-JsonPropertyValue $data "description")) {
      Set-JsonPropertyValue -Object $data -Name "description" -Value "Generated by Autoflow stop-hook installer."
    }
  }

  $manifestDir = Split-Path -Parent $manifestPath
  if ($manifestDir) {
    New-Item -ItemType Directory -Force -Path $manifestDir | Out-Null
  }

  $json = $data | ConvertTo-Json -Depth 10
  [System.IO.File]::WriteAllText($manifestPath, $json + [Environment]::NewLine, (New-Object System.Text.UTF8Encoding($false)))
}

Write-Output "manifest_path=$manifestPath"
Write-Output ("manifest_exists_before={0}" -f ($(if ($manifestExists) { "true" } else { "false" })))
Write-Output ("manifest_changed={0}" -f ($(if ($changed) { "true" } else { "false" })))
Write-Output ("installed_before={0}" -f ($(if ($installedBefore) { "true" } else { "false" })))
Write-Output ("installed_after={0}" -f ($(if ($installedAfter) { "true" } else { "false" })))
Write-Output ("status={0}" -f ($(if ($installedAfter) { "installed" } else { "missing" })))
Write-Output "action=$Action"
Write-Output "board_root=$boardRoot"
Write-Output "project_root=$projectRoot"
Write-Output "command=$commandText"
