$ErrorActionPreference = "Stop"

$pluginRoot = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")
$serverPath = Join-Path $pluginRoot "mcp\reasonweave-runner\server.mjs"
$testPattern = Join-Path $pluginRoot "mcp\reasonweave-runner\test\*.test.mjs"

if (-not (Test-Path -LiteralPath $serverPath)) {
    throw "Missing MCP server: $serverPath"
}

node --test $testPattern
node (Join-Path $pluginRoot "mcp\reasonweave-runner\scripts\self-test.mjs")
