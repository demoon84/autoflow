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

if (-not $setName) { throw "set_name is required in $setFile" }
if (-not $targetThreadId -or $targetThreadId -match 'REPLACE_WITH|{{') { throw "target_thread_id must be set to a real Codex thread id in $setFile" }
if (-not $executionPool) { throw "execution_pool is required in $setFile" }
if (-not $verifierPool) { throw "verifier_pool is required in $setFile" }
if (-not $maxExecutionLoad) { $maxExecutionLoad = "1" }

$planTemplate = Resolve-BoardRelativePath -BoardRoot $boardRoot -RelativePath (Get-TomlStringValue -Path $setFile -Key "plan_template")
$todoTemplate = Resolve-BoardRelativePath -BoardRoot $boardRoot -RelativePath (Get-TomlStringValue -Path $setFile -Key "todo_template")
$verifierTemplate = Resolve-BoardRelativePath -BoardRoot $boardRoot -RelativePath (Get-TomlStringValue -Path $setFile -Key "verifier_template")

foreach ($requiredTemplate in @($planTemplate, $todoTemplate, $verifierTemplate)) {
  if (-not (Test-Path -LiteralPath $requiredTemplate -PathType Leaf)) {
    throw "Heartbeat template not found: $requiredTemplate"
  }
}

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
    [string]$ArrayKey,
    [string]$TemplatePath
  )

  foreach ($workerId in (Get-TomlArrayValues -Path $setFile -Key $ArrayKey)) {
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

Render-RoleWorkers -Role "plan" -ArrayKey "planner_workers" -TemplatePath $planTemplate
Render-RoleWorkers -Role "todo" -ArrayKey "todo_workers" -TemplatePath $todoTemplate
Render-RoleWorkers -Role "verifier" -ArrayKey "verifier_workers" -TemplatePath $verifierTemplate

$renderedCount = $manifestLines.Count
if ($renderedCount -eq 0) {
  throw "No workers were rendered from $setFile"
}

$manifestFile = Join-Path $outputRoot "manifest.txt"
$manifestContent = @(
  "set_name=$setName"
  "target_thread_id=$targetThreadId"
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
