$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$initScript = Join-Path $repoRoot "plugins\reasonweave-codex-plugin\mcp\reasonweave-runner\scripts\init-keys.mjs"

if (-not (Test-Path -LiteralPath $initScript)) {
    throw "Missing ReasonWeave key initializer: $initScript"
}

node $initScript
