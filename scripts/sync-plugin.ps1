param(
    [switch]$CheckOnly
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")
$source = Join-Path $repoRoot "skills\reasonweave-orchestrator"
$pluginRoot = Join-Path $repoRoot "plugins\reasonweave-codex-plugin"
$pluginSkillsRoot = Join-Path $pluginRoot "skills"
$target = Join-Path $pluginRoot "skills\reasonweave-orchestrator"

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

function Assert-InSync {
    $sourceFiles = @(Get-RelativeFileSet $source)
    $targetFiles = @(Get-RelativeFileSet $target)

    $sourceJoined = $sourceFiles -join "`n"
    $targetJoined = $targetFiles -join "`n"
    if ($sourceJoined -ne $targetJoined) {
        throw "Plugin skill file list drifted from canonical source. Run .\scripts\sync-plugin.ps1."
    }

    foreach ($relative in $sourceFiles) {
        $sourceFile = Join-Path $source $relative
        $targetFile = Join-Path $target $relative
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
$allowedPrefix = [System.IO.Path]::GetFullPath($resolvedTargetParent.Path)

if (-not $targetFull.StartsWith($allowedPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to remove target outside plugin skills folder: $targetFull"
}

if (Test-Path -LiteralPath $target) {
    Remove-Item -LiteralPath $target -Recurse -Force
}

Copy-Item -LiteralPath $source -Destination $target -Recurse
Assert-InSync
Write-Host "Synced canonical skill to plugin: $target"
