$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$source = Join-Path $repoRoot "skills\reasonweave-orchestrator"
$target = "C:\Users\madhu\.agents\skills\reasonweave-orchestrator"

if (-not (Test-Path -LiteralPath (Join-Path $source "SKILL.md"))) {
  throw "Source skill not found: $source"
}

if (Test-Path -LiteralPath $target) {
  Remove-Item -LiteralPath $target -Recurse -Force
}

New-Item -ItemType Directory -Force -Path (Split-Path -Parent $target) | Out-Null
Copy-Item -LiteralPath $source -Destination (Split-Path -Parent $target) -Recurse -Force

Write-Host "Installed ReasonWeave skill to $target"
Write-Host "Restart Codex to refresh skill metadata."