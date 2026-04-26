[CmdletBinding()]
param(
  [Parameter(Position = 0)]
  [string]$ProjectRoot = ".",

  [Parameter(Position = 1)]
  [string]$BoardDirName = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "cli-common.ps1")

if (-not $BoardDirName) {
  $BoardDirName = Get-DefaultBoardDirName
}

function Get-TomlStringValue {
  param([string]$Path, [string]$Key)

  foreach ($line in (Get-Content -LiteralPath $Path)) {
    if ($line -match ('^{0} = "(.*)"$' -f [regex]::Escape($Key))) {
      return $matches[1]
    }
  }

  return ""
}

function Get-TomlIntegerValue {
  param([string]$Path, [string]$Key)

  foreach ($line in (Get-Content -LiteralPath $Path)) {
    if ($line -match ('^{0} = ([0-9]+)$' -f [regex]::Escape($Key))) {
      return $matches[1]
    }
  }

  return ""
}

function Get-TomlArrayValues {
  param([string]$Path, [string]$Key)

  foreach ($line in (Get-Content -LiteralPath $Path)) {
    if ($line -match ('^{0} = \[(.*)\]$' -f [regex]::Escape($Key))) {
      $body = $matches[1].Trim()
      if (-not $body) {
        return @()
      }

      $values = @()
      foreach ($piece in ($body -split ',')) {
        $trimmed = $piece.Trim()
        if ($trimmed.StartsWith('"') -and $trimmed.EndsWith('"')) {
          $trimmed = $trimmed.Substring(1, $trimmed.Length - 2)
        }
        if ($trimmed) {
          $values += $trimmed
        }
      }

      return $values
    }
  }

  return @()
}

function Get-TomlSectionValue {
  param([string]$Path, [string]$Section, [string]$Key)

  $inSection = $false
  foreach ($line in (Get-Content -LiteralPath $Path)) {
    if ($line -eq "[$Section]") {
      $inSection = $true
      continue
    }

    if ($inSection -and $line.StartsWith("[")) {
      $inSection = $false
    }

    if ($inSection -and $line -match ('^{0}\s*=\s*"(.*)"$' -f [regex]::Escape($Key))) {
      return $matches[1]
    }
  }

  return ""
}

function Resolve-BoardRelativePath {
  param([string]$BoardRoot, [string]$RelativePath)

  if ([System.IO.Path]::IsPathRooted($RelativePath)) {
    return $RelativePath
  }

  return (Join-Path $BoardRoot $RelativePath)
}

function Get-SlugValue {
  param([string]$Value)

  $slug = $Value.ToLowerInvariant() -replace '[^a-z0-9]', '-'
  $slug = $slug -replace '-{2,}', '-'
  $slug = $slug.Trim('-')
  if (-not $slug) {
    return "autoflow-heartbeat-set"
  }

  return $slug
}

function Render-TemplateFile {
  param(
    [string]$TemplatePath,
    [string]$OutputPath,
    [hashtable]$Replacements
  )

  $content = Get-FileContentRawSafe $TemplatePath
  foreach ($key in $Replacements.Keys) {
    $content = $content.Replace("{{${key}}}", [string]$Replacements[$key])
  }

  Write-Utf8File -Path $OutputPath -Content $content
}

function Resolve-WorkerThreadId {
  param(
    [string]$SetFile,
    [string]$WorkerId,
    [string]$DefaultThreadId
  )

  $found = Get-TomlSectionValue -Path $SetFile -Section "thread_ids" -Key $WorkerId
  if ($found -and $found -notmatch 'REPLACE_WITH|{{') {
    return $found
  }

  return $DefaultThreadId
}

$resolvedProjectRoot = Resolve-ProjectRootOrThrow $ProjectRoot
$boardRoot = Get-BoardRootPath -ProjectRoot $resolvedProjectRoot -BoardDirName $BoardDirName
$setFile = Join-Path $boardRoot "automations/heartbeat-set.toml"

if (-not (Test-Path -LiteralPath $setFile -PathType Leaf)) {
  throw "Heartbeat set file not found: $setFile"
}

$setName = Get-TomlStringValue -Path $setFile -Key "set_name"
$targetThreadId = Get-TomlStringValue -Path $setFile -Key "target_thread_id"
$executionPool = Get-TomlStringValue -Path $setFile -Key "execution_pool"
$verifierPool = Get-TomlStringValue -Path $setFile -Key "verifier_pool"
$maxExecutionLoad = Get-TomlIntegerValue -Path $setFile -Key "max_execution_load_per_worker"
$ownerWorkers = @(Get-TomlArrayValues -Path $setFile -Key "owner_workers")
$plannerWorkers = @(Get-TomlArrayValues -Path $setFile -Key "planner_workers")
$todoWorkers = @(Get-TomlArrayValues -Path $setFile -Key "todo_workers")
$verifierWorkers = @(Get-TomlArrayValues -Path $setFile -Key "verifier_workers")

if (-not $setName) { throw "set_name is required in $setFile" }
if (-not $targetThreadId -or $targetThreadId -match 'REPLACE_WITH|{{') { throw "target_thread_id must be set to a real Codex thread id in $setFile" }
if ($todoWorkers.Count -gt 0 -and -not $executionPool) { throw "execution_pool is required in $setFile when todo_workers is not empty" }
if ($todoWorkers.Count -gt 0 -and -not $verifierPool) { throw "verifier_pool is required in $setFile when todo_workers is not empty" }
if (-not $maxExecutionLoad) { $maxExecutionLoad = "1" }

function Resolve-TemplateForWorkers {
  param(
    [string]$TemplateKey,
    [object[]]$Workers
  )

  if ($Workers.Count -eq 0) {
    return ""
  }

  $templateRel = Get-TomlStringValue -Path $setFile -Key $TemplateKey
  if (-not $templateRel) {
    throw "$TemplateKey is required in $setFile when the matching worker array is not empty"
  }

  $templatePath = Resolve-BoardRelativePath -BoardRoot $boardRoot -RelativePath $templateRel
  if (-not (Test-Path -LiteralPath $templatePath -PathType Leaf)) {
    throw "Heartbeat template not found: $templatePath"
  }

  return $templatePath
}

$ownerTemplate = Resolve-TemplateForWorkers -TemplateKey "owner_template" -Workers $ownerWorkers
$planTemplate = Resolve-TemplateForWorkers -TemplateKey "plan_template" -Workers $plannerWorkers
$todoTemplate = Resolve-TemplateForWorkers -TemplateKey "todo_template" -Workers $todoWorkers
$verifierTemplate = Resolve-TemplateForWorkers -TemplateKey "verifier_template" -Workers $verifierWorkers

$setSlug = Get-SlugValue $setName
$outputRoot = Join-Path $boardRoot "automations/rendered/$setSlug"
if (Test-Path -LiteralPath $outputRoot) {
  Remove-Item -LiteralPath $outputRoot -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $outputRoot | Out-Null

$manifestLines = New-Object System.Collections.Generic.List[string]

function Render-RoleWorkers {
  param(
    [string]$Role,
    [object[]]$Workers,
    [string]$TemplatePath
  )

  foreach ($workerId in $Workers) {
    $automationId = "$setSlug-$workerId"
    $automationName = "$setName / $workerId"
    $outputFile = Join-Path $outputRoot "$workerId.toml"
    $workerThreadId = Resolve-WorkerThreadId -SetFile $setFile -WorkerId $workerId -DefaultThreadId $targetThreadId

    Render-TemplateFile -TemplatePath $TemplatePath -OutputPath $outputFile -Replacements @{
      THREAD_ID = $workerThreadId
      AUTOMATION_ID = $automationId
      AUTOMATION_NAME = $automationName
      WORKER_ID = $workerId
      EXECUTION_POOL = $executionPool
      VERIFIER_POOL = $verifierPool
      MAX_EXECUTION_LOAD = $maxExecutionLoad
    }

    [void]$manifestLines.Add(("{0}|{1}|{2}|{3}|{4}" -f $Role, $workerId, $automationId, $workerThreadId, $outputFile))
    Write-Output ("rendered={0} thread={1}" -f $outputFile, $workerThreadId)
  }
}

if ($ownerTemplate) { Render-RoleWorkers -Role "ticket" -Workers $ownerWorkers -TemplatePath $ownerTemplate }
if ($planTemplate) { Render-RoleWorkers -Role "plan" -Workers $plannerWorkers -TemplatePath $planTemplate }
if ($todoTemplate) { Render-RoleWorkers -Role "todo" -Workers $todoWorkers -TemplatePath $todoTemplate }
if ($verifierTemplate) { Render-RoleWorkers -Role "verifier" -Workers $verifierWorkers -TemplatePath $verifierTemplate }

$renderedCount = $manifestLines.Count
if ($renderedCount -eq 0) {
  throw "No workers were rendered from $setFile"
}

$manifestFile = Join-Path $outputRoot "manifest.txt"
$manifestContent = @(
  "set_name=$setName"
  "target_thread_id=$targetThreadId"
  "owner_workers=$($ownerWorkers -join ',')"
  "execution_pool=$executionPool"
  "verifier_pool=$verifierPool"
  "max_execution_load_per_worker=$maxExecutionLoad"
  ""
  $manifestLines
) -join [Environment]::NewLine
Write-Utf8File -Path $manifestFile -Content ($manifestContent + [Environment]::NewLine)

Write-KeyValueLine "status" "rendered"
Write-KeyValueLine "project_root" $resolvedProjectRoot
Write-KeyValueLine "board_root" $boardRoot
Write-KeyValueLine "set_file" $setFile
Write-KeyValueLine "output_root" $outputRoot
Write-KeyValueLine "rendered_count" ([string]$renderedCount)
Write-KeyValueLine "manifest" $manifestFile
