param(
    [switch]$CheckOnly
)

$ErrorActionPreference = "Stop"

$skillsRoot = "C:\Users\madhu\.agents\skills"
$archiveBase = "C:\Users\madhu\.agents\skills-archive\merged-into-reasonweave"
$reasonweavePath = Join-Path $skillsRoot "reasonweave-orchestrator\SKILL.md"
$mergedSkillNames = @(
    "memory-management",
    "world-class-growth-intelligence",
    "world-class-web-audit",
    "world-class-web-builder"
)

if (-not (Test-Path -LiteralPath $reasonweavePath)) {
    throw "ReasonWeave global installation is missing; refusing to archive merged skills."
}

$skillsRootFull = [System.IO.Path]::GetFullPath($skillsRoot).TrimEnd("\", "/")
$archiveBaseFull = [System.IO.Path]::GetFullPath($archiveBase).TrimEnd("\", "/")
$activePaths = @()

foreach ($name in $mergedSkillNames) {
    $source = Join-Path $skillsRoot $name
    $sourceFull = [System.IO.Path]::GetFullPath($source)
    if (-not $sourceFull.StartsWith("$skillsRootFull\", [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing to operate outside the active skills root: $sourceFull"
    }
    if (Test-Path -LiteralPath $source) {
        $activePaths += $source
    }
}

if ($CheckOnly) {
    if ($activePaths.Count -gt 0) {
        throw "Merged standalone skills are still active: $($activePaths -join ', ')"
    }
    Write-Host "Merged standalone skills are not active under $skillsRoot."
    exit 0
}

if ($activePaths.Count -eq 0) {
    Write-Host "No merged standalone skills remain active; no archive move required."
    exit 0
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$destination = Join-Path $archiveBase $stamp
$destinationFull = [System.IO.Path]::GetFullPath($destination)
if (-not $destinationFull.StartsWith("$archiveBaseFull\", [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to create archive destination outside the archive root: $destinationFull"
}

New-Item -ItemType Directory -Force -Path $destination | Out-Null
foreach ($source in $activePaths) {
    Move-Item -LiteralPath $source -Destination $destination
}

Write-Host "Archived merged standalone skills to $destination"
