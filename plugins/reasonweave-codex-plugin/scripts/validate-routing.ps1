param(
    [string]$RouteCasesPath
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
$syncScript = Join-Path $repoRoot "scripts\sync-plugin.ps1"

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

$routing = Read-JsonFile $routingPath

Assert ($routing.policy.statement -eq "ReasonWeave does not claim permanent mathematical optimality; it enforces measurable routing quality through validation, evidence gates, evals, and safe blocking.") "Policy statement is missing or changed."
Assert ($routing.policy.acceptance.confidence -eq "high") "Acceptance confidence must be high."
Assert ($routing.policy.acceptance.grounding_risk -eq "low") "Acceptance grounding_risk must be low."
Assert ($routing.policy.acceptance.access_violations -eq "none") "Acceptance access_violations must be none."

$defaultAgents = @($routing.logical_agents | Where-Object { $_.platform_agent_type -eq "default" })
Assert ($defaultAgents.Count -eq 1) "Exactly one logical agent may use platform default."
Assert ($defaultAgents[0].name -eq "router") "Router must be the only platform default logical agent."
Assert ($defaultAgents[0].access_tier -eq "A1") "Router must use A1 route-only access."

$planner = Get-Agent $routing "planner"
Assert ($planner.platform_agent_type -eq "explorer") "Planner must be explorer."
Assert ($planner.default_model -eq "gpt-5.5") "Planner default model must be gpt-5.5."
Assert ($planner.default_reasoning -eq "high") "Planner default reasoning must be high."
Assert ($planner.escalated_reasoning -eq "xhigh") "Planner escalated reasoning must be xhigh."

$validAgentTypes = @($routing.platform_agent_types)
$validModels = @($routing.models)
$validReasoning = @($routing.reasoning_efforts)
$validAccessTiers = @($routing.access_tiers.PSObject.Properties.Name)

foreach ($agent in $routing.logical_agents) {
    Assert ($validAgentTypes -contains $agent.platform_agent_type) "Invalid platform type for $($agent.name)."
    Assert ($validModels -contains $agent.default_model) "Invalid default model for $($agent.name)."
    Assert ($validModels -contains $agent.escalated_model) "Invalid escalated model for $($agent.name)."
    Assert ($validReasoning -contains $agent.default_reasoning) "Invalid default reasoning for $($agent.name)."
    Assert ($validReasoning -contains $agent.escalated_reasoning) "Invalid escalated reasoning for $($agent.name)."
    Assert ($validAccessTiers -contains $agent.access_tier) "Invalid access tier for $($agent.name)."

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
& $syncScript -CheckOnly

Assert (Test-Path -LiteralPath $pluginRoutingPath) "Missing plugin routing copy: $pluginRoutingPath"
Assert ((Get-FileHash -LiteralPath $routingPath -Algorithm SHA256).Hash -eq (Get-FileHash -LiteralPath $pluginRoutingPath -Algorithm SHA256).Hash) "Plugin routing copy drifted from canonical source."

Assert (Test-Path -LiteralPath $routeCasesPath) "Missing route cases: $routeCasesPath"
$caseCount = 0
$coveredTaskTypes = @{}
$coveredAgents = @{}
foreach ($line in Get-Content -LiteralPath $routeCasesPath) {
    if ([string]::IsNullOrWhiteSpace($line)) {
        continue
    }
    $case = $line | ConvertFrom-Json
    $caseCount++
    Assert $case.prompt "Route case missing prompt."
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

        $allowedModels = @($agent.default_model, $agent.escalated_model) | Select-Object -Unique
        $allowedReasoning = @($agent.default_reasoning, $agent.escalated_reasoning)
        if ($agent.PSObject.Properties.Name -contains "top_tier_reasoning") {
            $allowedReasoning += $agent.top_tier_reasoning
        }
        $allowedReasoning = $allowedReasoning | Select-Object -Unique

        Assert ($allowedModels -contains $selected.model) "Route case $($case.prompt) uses invalid model $($selected.model) for $($selected.logical_agent)."
        Assert ($allowedReasoning -contains $selected.reasoning_effort) "Route case $($case.prompt) uses invalid reasoning $($selected.reasoning_effort) for $($selected.logical_agent)."

        if ($hasSensitiveRisk -and $selected.logical_agent -ne "researcher" -and $selected.logical_agent -ne "docs-writer") {
            Assert ($selected.model -eq "gpt-5.5") "Sensitive route $($case.prompt) must use gpt-5.5 for $($selected.logical_agent)."
            Assert (@("high", "xhigh") -contains $selected.reasoning_effort) "Sensitive route $($case.prompt) must use high/xhigh reasoning for $($selected.logical_agent)."
        }
    }
}
Assert ($caseCount -ge 20) "Expected at least 20 golden route cases."

foreach ($taskType in $routing.task_types) {
    Assert $coveredTaskTypes.ContainsKey($taskType) "Route cases do not cover task type '$taskType'."
}

foreach ($agent in $routing.logical_agents) {
    Assert $coveredAgents.ContainsKey($agent.name) "Route cases do not cover logical agent '$($agent.name)'."
}

Write-Host "ReasonWeave routing validation passed ($caseCount route cases)."
