param(
    [string]$RouteCasesPath,
    [string]$RuntimeCasesPath,
    [string]$WorkflowCasesPath,
    [string]$OutputCasesPath
)

$ErrorActionPreference = "Stop"

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$pluginRoot = Resolve-Path -LiteralPath (Join-Path $scriptRoot "..")
$repoRoot = Resolve-Path -LiteralPath (Join-Path $pluginRoot "..\..")
$routingPath = Join-Path $repoRoot "skills\reasonweave-orchestrator\references\model-routing.yaml"
$pluginRoutingPath = Join-Path $pluginRoot "skills\reasonweave-orchestrator\references\model-routing.yaml"
if ([string]::IsNullOrWhiteSpace($RouteCasesPath)) {
    $routeCasesPath = Join-Path $pluginRoot "docs\evals\route-cases.jsonl"
}
else {
    $routeCasesPath = $RouteCasesPath
}
if ([string]::IsNullOrWhiteSpace($RuntimeCasesPath)) {
    $runtimeCasesPath = Join-Path $pluginRoot "docs\evals\runtime-verification-cases.jsonl"
}
else {
    $runtimeCasesPath = $RuntimeCasesPath
}
if ([string]::IsNullOrWhiteSpace($WorkflowCasesPath)) {
    $workflowCasesPath = Join-Path $pluginRoot "docs\evals\mock-workflow-cases.jsonl"
}
else {
    $workflowCasesPath = $WorkflowCasesPath
}
if ([string]::IsNullOrWhiteSpace($OutputCasesPath)) {
    $outputCasesPath = Join-Path $pluginRoot "docs\evals\output-policy-cases.jsonl"
}
else {
    $outputCasesPath = $OutputCasesPath
}
$syncScript = Join-Path $repoRoot "scripts\sync-plugin.ps1"
$archiveScript = Join-Path $repoRoot "scripts\archive-merged-global-skills.ps1"

function Assert($condition, $message) {
    if (-not $condition) {
        throw $message
    }
}

function Read-JsonFile($path) {
    Assert (Test-Path -LiteralPath $path) "Missing file: $path"
    (Get-Content -LiteralPath $path -Raw) | ConvertFrom-Json
}

function Get-Agent($routing, $name) {
    $agent = @($routing.logical_agents | Where-Object { $_.name -eq $name })
    Assert ($agent.Count -eq 1) "Expected one logical agent named '$name', found $($agent.Count)."
    $agent[0]
}

function Test-AllowedModelAlias($routing, $intendedModel, $resolvedModel) {
    if ([string]::IsNullOrWhiteSpace($intendedModel) -or [string]::IsNullOrWhiteSpace($resolvedModel)) {
        return $false
    }
    if ($resolvedModel -eq "none" -or $resolvedModel -eq "current-host-runtime") {
        return $false
    }
    $matchedFamilies = @($routing.models | Where-Object {
        $resolvedModel -eq $_ -or $resolvedModel.StartsWith("$_-")
    } | Sort-Object Length -Descending)
    if ($matchedFamilies.Count -gt 0 -and $matchedFamilies[0] -ne $intendedModel) {
        return $false
    }
    $aliases = @($routing.model_aliases.$intendedModel)
    foreach ($alias in $aliases) {
        if ($alias.EndsWith("-*")) {
            $prefix = $alias.Substring(0, $alias.Length - 1)
            if ($resolvedModel.StartsWith($prefix)) {
                return $true
            }
        }
        elseif ($resolvedModel -eq $alias) {
            return $true
        }
    }
    return $false
}

function Test-RuntimeGate($routing, $record) {
    $isAcceptedStatus = @($routing.policy.acceptance.execution_status) -contains $record.execution_status
    return $isAcceptedStatus `
        -and ($record.model_match -eq $true) `
        -and ($record.reasoning_match -eq $true) `
        -and ($record.receipt_valid -eq $true) `
        -and ($record.dispatch_authorized -eq $true) `
        -and @("platform_metadata", "runner_receipt") -contains $record.verification_source
}

function Test-AllowedRouteSelection($routing, $agent, $model, $reasoning) {
    if ($agent.default_model -eq $model -and $agent.default_reasoning -eq $reasoning) {
        return $true
    }
    if ($agent.escalated_model -eq $model -and $agent.escalated_reasoning -eq $reasoning) {
        return $true
    }
    if (($agent.PSObject.Properties.Name -contains "top_tier_reasoning") `
        -and $agent.escalated_model -eq $model `
        -and $agent.top_tier_reasoning -eq $reasoning) {
        return $true
    }
    if ($routing.policy.terminal_route.applies_to_all_logical_agents -eq $true `
        -and $routing.policy.terminal_route.model -eq $model `
        -and $routing.policy.terminal_route.reasoning_effort -eq $reasoning) {
        return $true
    }
    return $false
}

$routing = Read-JsonFile $routingPath

Assert ($routing.policy.statement -eq "ReasonWeave does not claim permanent mathematical optimality; it enforces measurable routing quality through validation, evidence gates, evals, and safe blocking.") "Policy statement is missing or changed."
Assert ($routing.policy.acceptance.confidence -eq "high") "Acceptance confidence must be high."
Assert ($routing.policy.acceptance.grounding_risk -eq "low") "Acceptance grounding_risk must be low."
Assert ($routing.policy.acceptance.access_violations -eq "none") "Acceptance access_violations must be none."
Assert (@($routing.policy.acceptance.execution_status) -contains "runtime_verified") "Acceptance must allow runtime_verified."
Assert (@($routing.policy.acceptance.execution_status) -contains "receipt_verified") "Acceptance must allow receipt_verified."
Assert (-not (@($routing.policy.acceptance.execution_status) -contains "spawn_request_only")) "Acceptance must not allow spawn_request_only."
Assert ($routing.policy.acceptance.model_match -eq $true) "Acceptance model_match must be true."
Assert ($routing.policy.acceptance.reasoning_match -eq $true) "Acceptance reasoning_match must be true."
Assert ($routing.policy.acceptance.receipt_valid -eq $true) "Acceptance receipt_valid must be true."
Assert ($routing.policy.acceptance.dispatch_authorized -eq $true) "Acceptance dispatch_authorized must be true."
Assert ($routing.policy.terminal_route.applies_to_all_logical_agents -eq $true) "Terminal route must apply to every logical agent."
Assert ($routing.policy.terminal_route.model -eq "gpt-5.5") "Terminal route model must be gpt-5.5."
Assert ($routing.policy.terminal_route.reasoning_effort -eq "xhigh") "Terminal route reasoning must be xhigh."

$requiredExecutionStatuses = @("runtime_verified", "receipt_verified", "spawn_request_only", "blocked_unverified", "failed")
foreach ($status in $requiredExecutionStatuses) {
    Assert (@($routing.execution_statuses) -contains $status) "Missing execution status: $status"
}

$requiredVerificationSources = @("platform_metadata", "runner_receipt", "spawn_request", "none")
foreach ($source in $requiredVerificationSources) {
    Assert (@($routing.verification_sources) -contains $source) "Missing verification source: $source"
}

$requiredFailureStates = @(
    "missing_api_key",
    "invalid_api_key",
    "bad_key_permissions",
    "network_failure",
    "rate_limited",
    "invalid_request",
    "unsupported_runtime",
    "provider_refusal",
    "provider_error",
    "model_unavailable",
    "tool_spawn_failure",
    "timeout",
    "missing_runtime_metadata",
    "incomplete_response",
    "model_mismatch",
    "reasoning_mismatch",
    "missing_signing_key",
    "receipt_verification_failure",
    "unauthorized_fallback_attempt",
    "parent_child_chain_mismatch",
    "subscription_metadata_untrusted",
    "codex_config_missing",
    "codex_config_invalid",
    "route_not_authorized",
    "ledger_write_failure",
    "ledger_integrity_failure",
    "ledger_read_failure"
)
foreach ($failureState in $requiredFailureStates) {
    Assert (@($routing.failure_states) -contains $failureState) "Missing failure state: $failureState"
}

$apiSurface = $routing.execution_surfaces.api
$subscriptionSurface = $routing.execution_surfaces.codex_subscription
Assert ($null -ne $apiSurface) "Missing API execution surface."
Assert ($null -ne $subscriptionSurface) "Missing Codex subscription execution surface."
Assert ($apiSurface.mode -eq "strict_verified") "API execution surface must be strict_verified."
Assert ($apiSurface.runtime_verification_required -eq $true) "API execution surface must require runtime verification."
Assert ($apiSurface.report_execution_status -eq $true) "API execution surface must report execution status."
Assert ($apiSurface.user_facing_route_format.Contains("execution_status=")) "API route format must expose execution status."
Assert ($subscriptionSurface.mode -eq "advisory") "Codex subscription execution surface must be advisory."
Assert ($subscriptionSurface.runtime_verification_required -eq $false) "Codex subscription surface must not require API runtime verification."
Assert ($subscriptionSurface.report_execution_status -eq $false) "Codex subscription prose must suppress runtime execution status."
Assert ($subscriptionSurface.user_facing_route_format.Contains("mode=codex_subscription")) "Codex subscription route format is missing mode marker."
Assert (-not $subscriptionSurface.user_facing_route_format.Contains("execution_status")) "Codex subscription route format must not expose execution status."
foreach ($field in @("execution_model", "resolved_model", "execution_reasoning", "execution_status", "model_match", "reasoning_match", "verification_source")) {
    Assert (@($subscriptionSurface.suppressed_user_facing_fields) -contains $field) "Codex subscription output must suppress $field."
}
Assert ($routing.runner_limits.tool_timeout_ms -eq 120000) "MCP runner timeout limit must be 120000ms."
Assert ($routing.runner_limits.max_output_tokens -eq 32768) "MCP runner token limit must be 32768."
Assert ($routing.runner_limits.max_output_text_chars -eq 100000) "MCP runner stored-output limit must be 100000 characters."
Assert ($routing.runner_limits.require_provider_response_id -eq $true) "MCP runner must require an actual provider response id."

$receipt = $routing.runtime_receipt
Assert ($receipt.receipt_version -eq "1") "Runtime receipt version must be 1."
Assert ($receipt.hash_algorithm -eq "sha256") "Runtime receipt hash algorithm must be sha256."
Assert ($receipt.hash_domain -eq "reasonweave-runtime-receipt:v1`n") "Runtime receipt hash domain is incorrect."
Assert ($receipt.signature_algorithm -eq "ed25519") "Runtime receipt signature algorithm must be ed25519."
Assert ($receipt.max_lifetime_ms -eq 600000) "Runtime receipt lifetime must be capped at 10 minutes."
Assert ($receipt.canonical_json.encoding -eq "utf-8") "Canonical JSON encoding must be utf-8."
Assert ($receipt.canonical_json.sort_keys -eq $true) "Canonical JSON must sort keys."
Assert ($receipt.canonical_json.whitespace -eq "none") "Canonical JSON must omit extra whitespace."
Assert ($receipt.canonical_json.timestamp_format -eq "normalized_iso8601") "Canonical JSON must normalize ISO timestamps."

$requiredReceiptFields = @(
    "receipt_version",
    "run_id",
    "nonce",
    "delegated_agent_id",
    "parent_run_id",
    "logical_agent",
    "primary_task_type",
    "risk_flags",
    "platform_agent_type",
    "access",
    "intended_model",
    "resolved_model",
    "execution_model",
    "intended_reasoning",
    "execution_reasoning",
    "verification_source",
    "model_match",
    "reasoning_match",
    "dispatch_authorized",
    "issued_at",
    "expires_at",
    "key_id",
    "receipt_hash",
    "receipt_signature"
)
foreach ($field in $requiredReceiptFields) {
    Assert (@($receipt.required_fields) -contains $field) "Runtime receipt missing required field: $field"
}
Assert (@($receipt.hash_excluded_fields) -contains "receipt_hash") "receipt_hash must be excluded from receipt_hash input."
Assert (@($receipt.hash_excluded_fields) -contains "receipt_signature") "receipt_signature must be excluded from receipt_hash input."
Assert (@($receipt.replay_key) -contains "run_id") "Replay key must include run_id."
Assert (@($receipt.replay_key) -contains "nonce") "Replay key must include nonce."
foreach ($rejectReason in @("expired", "replayed_run_id_nonce", "unknown_key_id", "missing_public_key", "invalid_hash", "invalid_signature", "invalid_receipt_lifetime", "receipt_lifetime_exceeded", "parent_child_chain_mismatch")) {
    Assert (@($receipt.reject_if) -contains $rejectReason) "Runtime receipt reject_if missing: $rejectReason"
}

$reporting = $routing.completion_reporting.api
$subscriptionReporting = $routing.completion_reporting.codex_subscription
Assert ($reporting.required_for_routed_work -eq $true) "Completion reporting must be required for routed work."
Assert ($reporting.report_every_selected_agent -eq $true) "Completion reporting must report every selected agent."
foreach ($field in @("logical_agent", "intended_model", "intended_reasoning", "execution_status", "verification_source", "decision", "block_reason")) {
    Assert (@($reporting.required_fields) -contains $field) "Completion reporting missing required field: $field"
}
foreach ($reviewAgent in @("reviewer", "docs-reviewer", "critic")) {
    Assert (@($reporting.review_status_agents) -contains $reviewAgent) "Completion reporting must track $reviewAgent."
}
foreach ($taskType in @("audit", "review", "implement", "refactor", "docs", "ui", "data", "memory-cleanup", "web-audit", "web-build")) {
    Assert (@($reporting.review_required_task_types) -contains $taskType) "Completion reporting must require review status for $taskType."
}
Assert ($reporting.blocked_review_status -eq "blocked_unverified") "Blocked review status must be blocked_unverified."
foreach ($forbiddenClaim in @("review passed", "approved", "no issues found")) {
    Assert (@($reporting.forbidden_claims_without_verified_review) -contains $forbiddenClaim) "Completion reporting missing forbidden claim: $forbiddenClaim"
}
Assert ($subscriptionReporting.report_intended_route -eq $true) "Subscription reporting must expose intended route."
Assert ($subscriptionReporting.report_execution_status -eq $false) "Subscription reporting must not expose unverified status."
Assert ($subscriptionReporting.may_proceed_advisory -eq $true) "Subscription routing must allow advisory work."
foreach ($forbiddenClaim in @("verified model execution", "signed reviewer pass", "API-verified review", "approved", "no issues found")) {
    Assert (@($subscriptionReporting.forbidden_claims_without_api_verification) -contains $forbiddenClaim) "Subscription reporting missing forbidden claim: $forbiddenClaim"
}

$defaultAgents = @($routing.logical_agents | Where-Object { $_.platform_agent_type -eq "default" })
Assert ($defaultAgents.Count -eq 1) "Exactly one logical agent may use platform default."
Assert ($defaultAgents[0].name -eq "router") "Router must be the only platform default logical agent."
Assert ($defaultAgents[0].access_tier -eq "A1") "Router must use A1 route-only access."

$planner = Get-Agent $routing "planner"
Assert ($planner.platform_agent_type -eq "explorer") "Planner must be explorer."
Assert ($planner.default_model -eq "gpt-5.5") "Planner default model must be gpt-5.5."
Assert ($planner.default_reasoning -eq "high") "Planner default reasoning must be high."
Assert ($planner.escalated_reasoning -eq "xhigh") "Planner escalated reasoning must be xhigh."

$memoryCleaner = Get-Agent $routing "memory-cleaner"
Assert ($memoryCleaner.platform_agent_type -eq "worker") "Memory cleaner must be worker."
Assert ($memoryCleaner.access_tier -eq "A6") "Memory cleaner must require A6 approval."
Assert (@($routing.access_tiers.A6.allowed_tools) -contains "approved-sensitive-cleanup") "A6 must permit approved sensitive cleanup."

$validAgentTypes = @($routing.platform_agent_types)
$validModels = @($routing.models)
$validReasoning = @($routing.reasoning_efforts)
$validAccessTiers = @($routing.access_tiers.PSObject.Properties.Name)
$modelRank = @{
    "gpt-5.2" = 1
    "gpt-5.4-mini" = 2
    "gpt-5.3-codex" = 3
    "gpt-5.4" = 4
    "gpt-5.5" = 5
}

foreach ($model in $validModels) {
    $aliases = @($routing.model_aliases.$model)
    Assert ($aliases.Count -eq 2) "Model $model must have exactly two allowed aliases."
    Assert ($aliases -contains $model) "Model $model alias list must include exact model."
    Assert ($aliases -contains "$model-*") "Model $model alias list must include versioned wildcard."
}
Assert (-not ($routing.model_aliases.PSObject.Properties.Name -contains "gpt-5")) "Broad gpt-5 alias must not be allowed."
Assert ($routing.model_alias_rule.Contains("gpt-5.4-mini")) "Model alias policy must explicitly reject named sibling family collisions."
Assert (-not (Test-AllowedModelAlias $routing "gpt-5.4" "gpt-5.4-mini")) "gpt-5.4-mini must not match an intended gpt-5.4 route."
Assert (Test-AllowedModelAlias $routing "gpt-5.4-mini" "gpt-5.4-mini-2026-05-27") "A versioned gpt-5.4-mini response must match gpt-5.4-mini."

foreach ($agent in $routing.logical_agents) {
    Assert ($validAgentTypes -contains $agent.platform_agent_type) "Invalid platform type for $($agent.name)."
    Assert ($validModels -contains $agent.default_model) "Invalid default model for $($agent.name)."
    Assert ($validModels -contains $agent.escalated_model) "Invalid escalated model for $($agent.name)."
    Assert ($validReasoning -contains $agent.default_reasoning) "Invalid default reasoning for $($agent.name)."
    Assert ($validReasoning -contains $agent.escalated_reasoning) "Invalid escalated reasoning for $($agent.name)."
    Assert ($validAccessTiers -contains $agent.access_tier) "Invalid access tier for $($agent.name)."
    Assert ($modelRank[$agent.escalated_model] -ge $modelRank[$agent.default_model]) "Escalated model for $($agent.name) must not downgrade from its default model."

    if ($agent.platform_agent_type -eq "explorer") {
        $tier = $routing.access_tiers.($agent.access_tier)
        Assert (($tier.forbidden_tools -contains "edit-files") -or ($tier.forbidden_tools -contains "unowned-edits")) "Explorer $($agent.name) must not have edit access."
    }
}

foreach ($taskType in $routing.task_types) {
    $routes = @($routing.task_routes.$taskType)
    if ($taskType -ne "answer") {
        Assert ($routes.Count -gt 0) "Task type '$taskType' must map to at least one logical agent."
    }
    foreach ($route in $routes) {
        [void](Get-Agent $routing $route)
    }
    if (@($reporting.review_required_task_types) -contains $taskType) {
        $hasReviewStatusAgent = @($routes | Where-Object { @($reporting.review_status_agents) -contains $_ }).Count -gt 0
        Assert $hasReviewStatusAgent "Task type '$taskType' must route through a review-status agent."
    }
}

foreach ($overlay in $routing.sensitive_overlays) {
    Assert ($routing.risk_overlays -contains $overlay) "Sensitive overlay '$overlay' must also be a risk overlay."
}

$workerTiers = @("A4", "A5", "A6")
foreach ($agent in $routing.logical_agents) {
    if ($agent.platform_agent_type -eq "worker") {
        Assert ($workerTiers -contains $agent.access_tier) "Worker $($agent.name) must use a worker-capable access tier."
    }
    if ($agent.name -ne "router") {
        Assert ($agent.platform_agent_type -ne "default") "Only router may use platform default."
    }
}

Assert (Test-Path -LiteralPath $syncScript) "Missing sync script: $syncScript"
Assert (Test-Path -LiteralPath $archiveScript) "Missing archive script: $archiveScript"
& $syncScript -CheckOnly

$requiredNativeReferences = @(
    "design-and-planning.md",
    "development-discipline.md",
    "review-and-release.md",
    "memory-and-context.md",
    "growth-intelligence\workflows.md",
    "web-audit\workflows.md",
    "web-builder\workflows.md"
)
foreach ($referenceFile in $requiredNativeReferences) {
    $referencePath = Join-Path $repoRoot "skills\reasonweave-orchestrator\references\$referenceFile"
    Assert (Test-Path -LiteralPath $referencePath) "Missing native ReasonWeave workflow reference: $referenceFile"
}

$activeSkillFiles = @(Get-ChildItem -LiteralPath (Join-Path $repoRoot "skills\reasonweave-orchestrator") -Recurse -File)
$staleStandalonePatterns = @('use\s+`?memory-management', 'use\s+`?world-class-growth-intelligence', 'use\s+`?world-class-web-audit', 'use\s+`?world-class-web-builder')
foreach ($activeFile in $activeSkillFiles) {
    foreach ($pattern in $staleStandalonePatterns) {
        $match = Select-String -LiteralPath $activeFile.FullName -Pattern $pattern
        Assert ($null -eq $match) "Active ReasonWeave source still invokes a standalone merged skill: $($activeFile.FullName)"
    }
}

$pluginManifestPath = Join-Path $pluginRoot ".codex-plugin\plugin.json"
$pluginManifest = Read-JsonFile $pluginManifestPath
Assert ($pluginManifest.mcpServers -eq "./.mcp.json") "Plugin manifest must point mcpServers to ./.mcp.json."

$mcpManifestPath = Join-Path $pluginRoot ".mcp.json"
$mcpManifest = Read-JsonFile $mcpManifestPath
$runner = $mcpManifest.mcpServers."reasonweave-runner"
Assert ($null -ne $runner) "MCP manifest must define reasonweave-runner."
Assert ($runner.command -eq "node") "reasonweave-runner command must be node."
Assert (@($runner.args).Count -gt 0) "reasonweave-runner must define args."
$runnerServerRelative = @($runner.args)[0]
Assert ($runnerServerRelative -eq "./mcp/reasonweave-runner/server.mjs") "reasonweave-runner must point at bundled server.mjs."
$runnerServerPath = Join-Path $pluginRoot ($runnerServerRelative -replace "^./", "")
Assert (Test-Path -LiteralPath $runnerServerPath) "Missing bundled MCP server: $runnerServerPath"
Assert (@($runner.env_vars) -contains "REASONWEAVE_CODEX_CONFIG_PATH") "reasonweave-runner must allow explicit Codex config observation path."
Assert (@($runner.env_vars) -contains "REASONWEAVE_CODEX_AUTH_PATH") "reasonweave-runner must allow explicit Codex auth observation path."

Assert (Test-Path -LiteralPath $pluginRoutingPath) "Missing plugin routing copy: $pluginRoutingPath"
Assert ((Get-FileHash -LiteralPath $routingPath -Algorithm SHA256).Hash -eq (Get-FileHash -LiteralPath $pluginRoutingPath -Algorithm SHA256).Hash) "Plugin routing copy drifted from canonical source."

Assert (Test-Path -LiteralPath $routeCasesPath) "Missing route cases: $routeCasesPath"
$caseCount = 0
$coveredTaskTypes = @{}
$coveredAgents = @{}
$coveredNativeWorkflowPrompts = @{}
$requiredNativeWorkflowPrompts = @(
    "Use TDD to fix this bug",
    "Execute this implementation plan",
    "Systematically debug this failure",
    "Request code review",
    "Handle this review feedback",
    "Finish this branch",
    "Set up an isolated workspace"
)
foreach ($line in Get-Content -LiteralPath $routeCasesPath) {
    if ([string]::IsNullOrWhiteSpace($line)) {
        continue
    }
    $case = $line | ConvertFrom-Json
    $caseCount++
    Assert $case.prompt "Route case missing prompt."
    if ($requiredNativeWorkflowPrompts -contains $case.prompt) {
        $coveredNativeWorkflowPrompts[$case.prompt] = $true
    }
    Assert $case.primary_task_type "Route case missing primary_task_type."
    Assert $case.expected_decision "Route case missing expected_decision."
    Assert ($routing.task_types -contains $case.primary_task_type) "Route case has unknown task type: $($case.primary_task_type)"
    $coveredTaskTypes[$case.primary_task_type] = $true
    foreach ($riskFlag in @($case.risk_flags)) {
        Assert ($routing.risk_overlays -contains $riskFlag) "Route case $($case.prompt) has unknown risk flag: $riskFlag"
    }

    $hasSensitiveRisk = @($case.risk_flags | Where-Object { $routing.sensitive_overlays -contains $_ }).Count -gt 0
    $selectedAgents = @($case.selected_agents)
    Assert ($selectedAgents.Count -gt 0) "Route case $($case.prompt) must include selected_agents."
    Assert ($selectedAgents[0].logical_agent -eq "router") "Route case $($case.prompt) must start with router."
    Assert ($selectedAgents[0].platform_agent_type -eq "default") "Route case $($case.prompt) must start with platform default router."
    foreach ($selected in $selectedAgents) {
        $agent = Get-Agent $routing $selected.logical_agent
        $coveredAgents[$selected.logical_agent] = $true
        Assert ($agent.platform_agent_type -eq $selected.platform_agent_type) "Route case $($case.prompt) has wrong platform type for $($selected.logical_agent)."
        Assert ($agent.access_tier -eq $selected.access_tier) "Route case $($case.prompt) has wrong access tier for $($selected.logical_agent)."
        Assert $selected.model "Route case $($case.prompt) missing model for $($selected.logical_agent)."
        Assert $selected.reasoning_effort "Route case $($case.prompt) missing reasoning_effort for $($selected.logical_agent)."

        Assert ($validModels -contains $selected.model) "Route case $($case.prompt) uses invalid model $($selected.model) for $($selected.logical_agent)."
        Assert ($validReasoning -contains $selected.reasoning_effort) "Route case $($case.prompt) uses invalid reasoning $($selected.reasoning_effort) for $($selected.logical_agent)."
        Assert (Test-AllowedRouteSelection $routing $agent $selected.model $selected.reasoning_effort) "Route case $($case.prompt) uses an unauthorized model/reasoning pair for $($selected.logical_agent)."

        if ($hasSensitiveRisk) {
            Assert ($selected.model -eq "gpt-5.5") "Sensitive route $($case.prompt) must use gpt-5.5 for $($selected.logical_agent)."
            Assert (@("high", "xhigh") -contains $selected.reasoning_effort) "Sensitive route $($case.prompt) must use high/xhigh reasoning for $($selected.logical_agent)."
        }
    }
    foreach ($requiredAgent in @($routing.task_routes.($case.primary_task_type))) {
        Assert (@($selectedAgents.logical_agent) -contains $requiredAgent) "Route case $($case.prompt) omits routed agent $requiredAgent."
    }
}
Assert ($caseCount -ge 40) "Expected at least 40 golden route cases."

foreach ($taskType in $routing.task_types) {
    Assert $coveredTaskTypes.ContainsKey($taskType) "Route cases do not cover task type '$taskType'."
}

foreach ($agent in $routing.logical_agents) {
    Assert $coveredAgents.ContainsKey($agent.name) "Route cases do not cover logical agent '$($agent.name)'."
}

foreach ($nativePrompt in $requiredNativeWorkflowPrompts) {
    Assert $coveredNativeWorkflowPrompts.ContainsKey($nativePrompt) "Route cases do not cover native workflow prompt '$nativePrompt'."
}

Assert (Test-Path -LiteralPath $runtimeCasesPath) "Missing runtime verification cases: $runtimeCasesPath"
$runtimeCaseCount = 0
foreach ($line in Get-Content -LiteralPath $runtimeCasesPath) {
    if ([string]::IsNullOrWhiteSpace($line)) {
        continue
    }
    $runtimeCase = $line | ConvertFrom-Json
    $runtimeCaseCount++
    Assert $runtimeCase.name "Runtime case missing name."
    Assert $runtimeCase.expected_decision "Runtime case missing expected_decision."
    Assert (@("accept", "block") -contains $runtimeCase.expected_decision) "Runtime case $($runtimeCase.name) has invalid expected_decision."
    Assert (@($routing.execution_statuses) -contains $runtimeCase.execution_status) "Runtime case $($runtimeCase.name) has unknown execution_status."
    Assert (@($routing.verification_sources) -contains $runtimeCase.verification_source) "Runtime case $($runtimeCase.name) has unknown verification_source."
    if ($runtimeCase.PSObject.Properties.Name -contains "failure_state") {
        Assert (@($routing.failure_states) -contains $runtimeCase.failure_state) "Runtime case $($runtimeCase.name) has unknown failure_state."
    }
    if ($runtimeCase.intended_model -ne "none" -and $runtimeCase.resolved_model -ne "none" -and $runtimeCase.resolved_model -ne "current-host-runtime") {
        Assert ($validModels -contains $runtimeCase.intended_model) "Runtime case $($runtimeCase.name) has unknown intended_model."
        $aliasMatch = Test-AllowedModelAlias $routing $runtimeCase.intended_model $runtimeCase.resolved_model
        Assert ($aliasMatch -eq $runtimeCase.model_match) "Runtime case $($runtimeCase.name) model_match does not match alias policy."
    }

    $passesGate = Test-RuntimeGate $routing $runtimeCase

    if ($runtimeCase.expected_decision -eq "accept") {
        Assert $passesGate "Runtime case $($runtimeCase.name) should pass Runtime Verification Gate."
    }
    else {
        Assert (-not $passesGate) "Runtime case $($runtimeCase.name) should block Runtime Verification Gate."
    }
}
Assert ($runtimeCaseCount -ge 12) "Expected at least 12 runtime verification cases."

Assert (Test-Path -LiteralPath $workflowCasesPath) "Missing mock workflow cases: $workflowCasesPath"
$workflowCaseCount = 0
foreach ($line in Get-Content -LiteralPath $workflowCasesPath) {
    if ([string]::IsNullOrWhiteSpace($line)) {
        continue
    }
    $workflow = $line | ConvertFrom-Json
    $workflowCaseCount++
    Assert $workflow.name "Workflow case missing name."
    Assert $workflow.prompt "Workflow case $($workflow.name) missing prompt."
    Assert ($routing.task_types -contains $workflow.primary_task_type) "Workflow case $($workflow.name) has unknown task type."
    Assert (@("accept", "block") -contains $workflow.expected_decision) "Workflow case $($workflow.name) has invalid expected_decision."
    foreach ($riskFlag in @($workflow.risk_flags)) {
        Assert ($routing.risk_overlays -contains $riskFlag) "Workflow case $($workflow.name) has unknown risk flag: $riskFlag"
    }
    $hasSensitiveRisk = @($workflow.risk_flags | Where-Object { $routing.sensitive_overlays -contains $_ }).Count -gt 0

    $selectedAgents = @($workflow.selected_agents)
    Assert ($selectedAgents.Count -gt 0) "Workflow case $($workflow.name) must include selected_agents."
    Assert ($selectedAgents[0].logical_agent -eq "router") "Workflow case $($workflow.name) must start with router."
    Assert ($selectedAgents[0].platform_agent_type -eq "default") "Workflow case $($workflow.name) must start with platform default router."

    $selectedByName = @{}
    foreach ($selected in $selectedAgents) {
        $agent = Get-Agent $routing $selected.logical_agent
        $selectedByName[$selected.logical_agent] = $selected
        Assert ($agent.platform_agent_type -eq $selected.platform_agent_type) "Workflow case $($workflow.name) wrong platform type for $($selected.logical_agent)."
        Assert ($agent.access_tier -eq $selected.access_tier) "Workflow case $($workflow.name) wrong access tier for $($selected.logical_agent)."
        Assert ($validModels -contains $selected.model) "Workflow case $($workflow.name) invalid model for $($selected.logical_agent)."
        Assert ($validReasoning -contains $selected.reasoning_effort) "Workflow case $($workflow.name) invalid reasoning for $($selected.logical_agent)."
        Assert (Test-AllowedRouteSelection $routing $agent $selected.model $selected.reasoning_effort) "Workflow case $($workflow.name) uses an unauthorized model/reasoning pair for $($selected.logical_agent)."
        if ($hasSensitiveRisk) {
            Assert ($selected.model -eq "gpt-5.5") "Sensitive workflow $($workflow.name) must use gpt-5.5 for $($selected.logical_agent)."
            Assert (@("high", "xhigh") -contains $selected.reasoning_effort) "Sensitive workflow $($workflow.name) must use high/xhigh reasoning for $($selected.logical_agent)."
        }
    }
    foreach ($requiredAgent in @($routing.task_routes.($workflow.primary_task_type))) {
        Assert $selectedByName.ContainsKey($requiredAgent) "Workflow case $($workflow.name) omits routed agent $requiredAgent."
    }
    foreach ($selectedName in @($selectedByName.Keys | Where-Object { $_ -ne "router" })) {
        Assert (@($routing.task_routes.($workflow.primary_task_type)) -contains $selectedName) "Workflow case $($workflow.name) selects agent $selectedName outside its task route."
    }

    $reviewRequired = @($reporting.review_required_task_types) -contains $workflow.primary_task_type
    $reviewStatusAgents = @($selectedAgents.logical_agent | Where-Object { @($reporting.review_status_agents) -contains $_ })
    if ($reviewRequired) {
        Assert ($reviewStatusAgents.Count -gt 0) "Workflow case $($workflow.name) must select a review-status agent."
        Assert ($workflow.review_status.required -eq $true) "Workflow case $($workflow.name) must mark review status required."
        Assert (@($reviewStatusAgents) -contains $workflow.review_status.logical_agent) "Workflow case $($workflow.name) review_status logical_agent must be selected."
    }
    else {
        Assert ($workflow.review_status.required -eq $false) "Workflow case $($workflow.name) must not require review status."
    }

    $runtimeBlocks = 0
    foreach ($runtimeResult in @($workflow.runtime_results)) {
        Assert $selectedByName.ContainsKey($runtimeResult.logical_agent) "Workflow case $($workflow.name) runtime result references unselected agent $($runtimeResult.logical_agent)."
        Assert (@($routing.execution_statuses) -contains $runtimeResult.execution_status) "Workflow case $($workflow.name) has unknown runtime execution_status."
        Assert (@($routing.verification_sources) -contains $runtimeResult.verification_source) "Workflow case $($workflow.name) has unknown verification_source."
        $selected = $selectedByName[$runtimeResult.logical_agent]
        Assert ($runtimeResult.intended_model -eq $selected.model) "Workflow case $($workflow.name) intended_model mismatch for $($runtimeResult.logical_agent)."
        Assert ($runtimeResult.intended_reasoning -eq $selected.reasoning_effort) "Workflow case $($workflow.name) intended_reasoning mismatch for $($runtimeResult.logical_agent)."
        if ($runtimeResult.resolved_model -ne "none" -and $runtimeResult.resolved_model -ne "current-host-runtime") {
            $aliasMatch = Test-AllowedModelAlias $routing $runtimeResult.intended_model $runtimeResult.resolved_model
            Assert ($aliasMatch -eq $runtimeResult.model_match) "Workflow case $($workflow.name) model_match does not follow alias policy for $($runtimeResult.logical_agent)."
        }

        $passesGate = Test-RuntimeGate $routing $runtimeResult
        if ($runtimeResult.expected_decision -eq "accept") {
            Assert $passesGate "Workflow case $($workflow.name) runtime result should pass for $($runtimeResult.logical_agent)."
        }
        else {
            Assert (-not $passesGate) "Workflow case $($workflow.name) runtime result should block for $($runtimeResult.logical_agent)."
            $runtimeBlocks++
        }
    }

    $completionByName = @{}
    foreach ($completion in @($workflow.completion_status)) {
        Assert $completion.logical_agent "Workflow case $($workflow.name) completion status missing logical_agent."
        Assert $selectedByName.ContainsKey($completion.logical_agent) "Workflow case $($workflow.name) completion status references unselected agent $($completion.logical_agent)."
        Assert (@($routing.execution_statuses) -contains $completion.execution_status) "Workflow case $($workflow.name) completion status has unknown execution_status."
        Assert (@($routing.verification_sources) -contains $completion.verification_source) "Workflow case $($workflow.name) completion status has unknown verification_source."
        Assert (@("accept", "block", "rework", "escalate") -contains $completion.decision) "Workflow case $($workflow.name) completion status has invalid decision."
        Assert $completion.block_reason "Workflow case $($workflow.name) completion status missing block_reason."
        $completionByName[$completion.logical_agent] = $completion
    }
    foreach ($selected in $selectedAgents) {
        Assert $completionByName.ContainsKey($selected.logical_agent) "Workflow case $($workflow.name) omits completion status for $($selected.logical_agent)."
    }

    if ($workflow.review_status.required -eq $true) {
        Assert $completionByName.ContainsKey($workflow.review_status.logical_agent) "Workflow case $($workflow.name) omits completion status for review agent."
        if ($workflow.review_status.review_verified -eq $true) {
            Assert (@($routing.policy.acceptance.execution_status) -contains $workflow.review_status.execution_status) "Workflow case $($workflow.name) verified review must use accepted execution_status."
        }
        else {
            Assert ($workflow.review_status.execution_status -eq $reporting.blocked_review_status) "Workflow case $($workflow.name) blocked review must use blocked_unverified."
            foreach ($forbiddenClaim in @($reporting.forbidden_claims_without_verified_review)) {
                Assert (-not ($workflow.summary_text.ToLowerInvariant().Contains($forbiddenClaim))) "Workflow case $($workflow.name) uses forbidden unverified review claim: $forbiddenClaim"
            }
        }
    }

    $completionBlocks = @($workflow.completion_status | Where-Object { $_.decision -eq "block" }).Count
    if ($workflow.expected_decision -eq "accept") {
        Assert ($runtimeBlocks -eq 0) "Workflow case $($workflow.name) should not have runtime blocks."
        Assert ($completionBlocks -eq 0) "Workflow case $($workflow.name) should not have completion blocks."
        if ($reviewRequired) {
            Assert ($workflow.review_status.review_verified -eq $true) "Workflow case $($workflow.name) should have verified review."
        }
    }
    else {
        Assert (($runtimeBlocks -gt 0) -or ($completionBlocks -gt 0) -or ($workflow.review_status.review_verified -eq $false)) "Workflow case $($workflow.name) should block for a concrete reason."
    }
}
Assert ($workflowCaseCount -ge 9) "Expected at least 9 mock workflow cases."

Assert (Test-Path -LiteralPath $outputCasesPath) "Missing output policy cases: $outputCasesPath"
$outputCaseCount = 0
foreach ($line in Get-Content -LiteralPath $outputCasesPath) {
    if ([string]::IsNullOrWhiteSpace($line)) {
        continue
    }
    $outputCase = $line | ConvertFrom-Json
    $outputCaseCount++
    Assert $outputCase.name "Output policy case missing name."
    Assert (@("api", "codex_subscription") -contains $outputCase.execution_surface) "Output case $($outputCase.name) has invalid execution_surface."
    Assert $outputCase.visible_text "Output case $($outputCase.name) missing visible_text."
    if ($outputCase.execution_surface -eq "codex_subscription") {
        foreach ($field in @($subscriptionSurface.suppressed_user_facing_fields)) {
            Assert (-not $outputCase.visible_text.Contains($field)) "Output case $($outputCase.name) exposes suppressed subscription field: $field"
        }
        foreach ($claim in @($subscriptionReporting.forbidden_claims_without_api_verification)) {
            Assert (-not $outputCase.visible_text.ToLowerInvariant().Contains($claim.ToLowerInvariant())) "Output case $($outputCase.name) makes unsupported subscription claim: $claim"
        }
    }
    foreach ($needle in @($outputCase.must_not_contain | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })) {
        Assert (-not $outputCase.visible_text.Contains($needle)) "Output case $($outputCase.name) exposes forbidden subscription text: $needle"
    }
    foreach ($needle in @($outputCase.must_contain | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })) {
        Assert ($outputCase.visible_text.Contains($needle)) "Output case $($outputCase.name) omits required API text: $needle"
    }
}
Assert ($outputCaseCount -ge 3) "Expected at least 3 output policy cases."

Write-Host "ReasonWeave routing validation passed ($caseCount route cases, $runtimeCaseCount runtime cases, $workflowCaseCount workflow cases, $outputCaseCount output cases)."
