$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$source = Join-Path $repoRoot "skills\reasonweave-orchestrator"
$target = "C:\Users\madhu\.agents\skills\reasonweave-orchestrator"
$targetParent = Split-Path -Parent $target
$agentsSource = Join-Path $repoRoot "AGENTS.md"
$agentsTarget = "C:\Users\madhu\.codex\AGENTS.md"
$agentsTargetParent = Split-Path -Parent $agentsTarget
$suffix = [Guid]::NewGuid().ToString("N")
$stage = Join-Path $targetParent ".reasonweave-orchestrator.install-$suffix"
$backup = Join-Path $targetParent ".reasonweave-orchestrator.backup-$suffix"

if (-not (Test-Path -LiteralPath (Join-Path $source "SKILL.md"))) {
  throw "Source skill not found: $source"
}

if (-not (Test-Path -LiteralPath $agentsSource)) {
  throw "Canonical AGENTS.md not found: $agentsSource"
}

function Get-RelativeFiles($root) {
  Get-ChildItem -LiteralPath $root -Recurse -File |
    ForEach-Object { $_.FullName.Substring($root.Length).TrimStart("\", "/") } |
    Sort-Object
}

New-Item -ItemType Directory -Force -Path $targetParent | Out-Null
New-Item -ItemType Directory -Force -Path $agentsTargetParent | Out-Null
$sourceFiles = @(Get-RelativeFiles $source)

try {
  Copy-Item -LiteralPath $source -Destination $stage -Recurse -Force
  $stageFiles = @(Get-RelativeFiles $stage)
  if (($sourceFiles -join "`n") -ne ($stageFiles -join "`n")) {
    throw "Staged ReasonWeave file set does not match canonical source."
  }

  foreach ($relative in $sourceFiles) {
    $sourceHash = (Get-FileHash -LiteralPath (Join-Path $source $relative) -Algorithm SHA256).Hash
    $stageHash = (Get-FileHash -LiteralPath (Join-Path $stage $relative) -Algorithm SHA256).Hash
    if ($sourceHash -ne $stageHash) {
      throw "Staged ReasonWeave hash mismatch: $relative"
    }
  }

  if (Test-Path -LiteralPath $target) {
    Move-Item -LiteralPath $target -Destination $backup
  }
  try {
    Move-Item -LiteralPath $stage -Destination $target
  }
  catch {
    if (Test-Path -LiteralPath $backup) {
      Move-Item -LiteralPath $backup -Destination $target
    }
    throw
  }
  if (Test-Path -LiteralPath $backup) {
    Remove-Item -LiteralPath $backup -Recurse -Force
  }
}
finally {
  if (Test-Path -LiteralPath $stage) {
    Remove-Item -LiteralPath $stage -Recurse -Force
  }
}

Copy-Item -LiteralPath $agentsSource -Destination $agentsTarget -Force
if ((Get-FileHash -LiteralPath $agentsSource -Algorithm SHA256).Hash -ne (Get-FileHash -LiteralPath $agentsTarget -Algorithm SHA256).Hash) {
  throw "Global AGENTS.md hash mismatch after sync."
}

Write-Host "Installed ReasonWeave skill to $target"
Write-Host "Staged and verified ReasonWeave before replacement with rollback protection ($($sourceFiles.Count) files)."
Write-Host "Synced canonical AGENTS.md to $agentsTarget"
Write-Host "Restart Codex to refresh skill metadata."
