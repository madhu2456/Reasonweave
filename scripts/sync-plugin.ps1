param(
    [switch]$CheckOnly
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")
$source = Join-Path $repoRoot "skills\reasonweave-orchestrator"
$pluginRoot = Join-Path $repoRoot "plugins\reasonweave-codex-plugin"
$pluginSkillsRoot = Join-Path $pluginRoot "skills"
$target = Join-Path $pluginRoot "skills\reasonweave-orchestrator"
$suffix = [Guid]::NewGuid().ToString("N")
$stage = Join-Path $pluginSkillsRoot ".reasonweave-orchestrator.sync-$suffix"
$backup = Join-Path $pluginSkillsRoot ".reasonweave-orchestrator.backup-$suffix"

if (-not (Test-Path -LiteralPath $source)) {
    throw "Canonical skill source not found: $source"
}

if (-not (Test-Path -LiteralPath $pluginRoot)) {
    throw "Plugin root not found: $pluginRoot"
}

function Get-RelativeFileSet($root) {
    if (-not (Test-Path -LiteralPath $root)) {
        return @()
    }

    Get-ChildItem -LiteralPath $root -Recurse -File |
        ForEach-Object {
            $_.FullName.Substring($root.Length).TrimStart("\", "/")
        } |
        Sort-Object
}

function Assert-InSync([string]$candidate = $target) {
    $sourceFiles = @(Get-RelativeFileSet $source)
    $targetFiles = @(Get-RelativeFileSet $candidate)

    $sourceJoined = $sourceFiles -join "`n"
    $targetJoined = $targetFiles -join "`n"
    if ($sourceJoined -ne $targetJoined) {
        throw "Plugin skill file list drifted from canonical source. Run .\scripts\sync-plugin.ps1."
    }

    foreach ($relative in $sourceFiles) {
        $sourceFile = Join-Path $source $relative
        $targetFile = Join-Path $candidate $relative
        $sourceHash = (Get-FileHash -LiteralPath $sourceFile -Algorithm SHA256).Hash
        $targetHash = (Get-FileHash -LiteralPath $targetFile -Algorithm SHA256).Hash
        if ($sourceHash -ne $targetHash) {
            throw "Plugin skill drifted from canonical source: $relative"
        }
    }
}

if ($CheckOnly) {
    Assert-InSync
    Write-Host "Plugin skill is in sync with canonical source."
    exit 0
}

if (-not (Test-Path -LiteralPath $pluginSkillsRoot)) {
    New-Item -ItemType Directory -Path $pluginSkillsRoot | Out-Null
}

$resolvedTargetParent = Resolve-Path -LiteralPath $pluginSkillsRoot
$targetFull = [System.IO.Path]::GetFullPath($target)
$allowedPrefix = [System.IO.Path]::GetFullPath($resolvedTargetParent.Path).TrimEnd("\", "/")

if (-not $targetFull.StartsWith("$allowedPrefix\", [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to remove target outside plugin skills folder: $targetFull"
}

try {
    Copy-Item -LiteralPath $source -Destination $stage -Recurse
    Assert-InSync $stage
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

Assert-InSync
Write-Host "Staged, verified, and replaced plugin skill with rollback protection: $target"
