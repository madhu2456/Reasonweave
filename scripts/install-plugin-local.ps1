$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$source = Join-Path $repoRoot "plugins\reasonweave-codex-plugin"
$pluginName = "reasonweave-codex-plugin"
$personalPluginsRoot = Join-Path $HOME "plugins"
$target = Join-Path $personalPluginsRoot $pluginName
$marketplaceRoot = Join-Path $HOME ".agents\plugins"
$marketplacePath = Join-Path $marketplaceRoot "marketplace.json"
$suffix = [Guid]::NewGuid().ToString("N")
$stage = Join-Path $personalPluginsRoot ".$pluginName.install-$suffix"
$backup = Join-Path $personalPluginsRoot ".$pluginName.backup-$suffix"
$marketplaceTemp = Join-Path $marketplaceRoot "marketplace.$suffix.tmp"
$marketplaceBackup = Join-Path $marketplaceRoot "marketplace.$suffix.bak"

if (-not (Test-Path -LiteralPath (Join-Path $source ".codex-plugin\plugin.json"))) {
    throw "Source plugin not found: $source"
}

New-Item -ItemType Directory -Force -Path $personalPluginsRoot | Out-Null
New-Item -ItemType Directory -Force -Path $marketplaceRoot | Out-Null

$resolvedPluginsRoot = [System.IO.Path]::GetFullPath($personalPluginsRoot)
$targetFull = [System.IO.Path]::GetFullPath($target)
if (-not $targetFull.StartsWith("$resolvedPluginsRoot\", [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to replace plugin outside personal plugins root: $targetFull"
}

function Get-RelativeFiles($root) {
    Get-ChildItem -LiteralPath $root -Recurse -File |
        ForEach-Object { $_.FullName.Substring($root.Length).TrimStart("\", "/") } |
        Sort-Object
}

$sourceFiles = @(Get-RelativeFiles $source)

try {
    Copy-Item -LiteralPath $source -Destination $stage -Recurse
    $stageFiles = @(Get-RelativeFiles $stage)
    if (($sourceFiles -join "`n") -ne ($stageFiles -join "`n")) {
        throw "Staged plugin file set does not match source bundle."
    }
    foreach ($relative in $sourceFiles) {
        $sourceHash = (Get-FileHash -LiteralPath (Join-Path $source $relative) -Algorithm SHA256).Hash
        $stageHash = (Get-FileHash -LiteralPath (Join-Path $stage $relative) -Algorithm SHA256).Hash
        if ($sourceHash -ne $stageHash) {
            throw "Staged plugin hash mismatch before cachebuster update: $relative"
        }
    }

    $pluginJsonPath = Join-Path $stage ".codex-plugin\plugin.json"
    $pluginJson = Get-Content -LiteralPath $pluginJsonPath -Raw | ConvertFrom-Json
    $baseVersion = ($pluginJson.version -split "\+")[0]
    $cachebuster = (Get-Date).ToUniversalTime().ToString("yyyyMMddHHmmss")
    $pluginJson.version = "$baseVersion+codex.local-$cachebuster"
    $pluginJson | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $pluginJsonPath -Encoding UTF8

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

if (Test-Path -LiteralPath $marketplacePath) {
    $marketplace = Get-Content -LiteralPath $marketplacePath -Raw | ConvertFrom-Json
}
else {
    $marketplace = [ordered]@{
        name = "personal"
        interface = [ordered]@{ displayName = "Personal" }
        plugins = @()
    } | ConvertTo-Json -Depth 20 | ConvertFrom-Json
}
if (-not ($marketplace.PSObject.Properties.Name -contains "plugins")) {
    $marketplace | Add-Member -MemberType NoteProperty -Name "plugins" -Value @()
}

$plugins = @($marketplace.plugins | Where-Object { $_.name -ne $pluginName })
$entry = [ordered]@{
    name = $pluginName
    source = [ordered]@{
        source = "local"
        path = "./plugins/$pluginName"
    }
    policy = [ordered]@{
        installation = "AVAILABLE"
        authentication = "ON_INSTALL"
    }
    category = "Productivity"
} | ConvertTo-Json -Depth 20 | ConvertFrom-Json
$marketplace.plugins = @($plugins + $entry)

try {
    $marketplace | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $marketplaceTemp -Encoding UTF8
    if (Test-Path -LiteralPath $marketplacePath) {
        [System.IO.File]::Replace($marketplaceTemp, $marketplacePath, $marketplaceBackup)
        if (Test-Path -LiteralPath $marketplaceBackup) {
            Remove-Item -LiteralPath $marketplaceBackup -Force
        }
    }
    else {
        Move-Item -LiteralPath $marketplaceTemp -Destination $marketplacePath
    }
}
finally {
    if (Test-Path -LiteralPath $marketplaceTemp) {
        Remove-Item -LiteralPath $marketplaceTemp -Force
    }
    if (Test-Path -LiteralPath $marketplaceBackup) {
        Remove-Item -LiteralPath $marketplaceBackup -Force
    }
}

Write-Host "Installed plugin source to $target"
Write-Host "Staged and verified plugin source before replacement with rollback protection and local manifest cachebuster ($($sourceFiles.Count) files)."
Write-Host "Updated personal marketplace at $marketplacePath"
Write-Host "Restart Codex or start a new thread, then open the Personal plugin marketplace and enable $pluginName if needed."
