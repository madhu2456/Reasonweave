# Model Routing

ReasonWeave does not claim permanent mathematical optimality; it enforces measurable routing quality through validation, evidence gates, evals, and safe blocking.

`model-routing.yaml` is the machine-checkable source of truth. It is written as JSON-compatible YAML so PowerShell validation can parse it without extra dependencies. This document explains the policy for humans.

## Core Rules

- The `router` is the only logical agent that may use platform `agent_type: default`.
- All read-only specialists use `explorer`.
- All editing, command-running, verification, ops, or release execution specialists use `worker`.
- No delegated strand may inherit the current Codex session model.
- Every strand must declare `logical_agent`, `platform_agent_type`, `model`, `reasoning_effort`, `access_tier`, and escalation route.
- A packet is accepted only when `confidence: high`, `grounding_risk: low`, and `access_violations: none`.

## Router

The router classifies the prompt, risk, effort tier, selected agents, model/reasoning route, tool access, and escalation plan. It must not edit files, run tests, deploy, or perform the task itself.

Default route:

```text
logical_agent: router
platform_agent_type: default
model: gpt-5.5
reasoning_effort: medium
access_tier: A1
```

Escalate the router to `gpt-5.5/high` for L/XL scope, risk overlays, or ambiguous routing. Escalate to `gpt-5.5/xhigh` for destructive, production, security approval, conflicting packets, or failed-pass recovery.

## Planner

Planning is accuracy-critical. The planner is read-only and must use:

```text
logical_agent: planner
platform_agent_type: explorer
model: gpt-5.5
reasoning_effort: high
escalated_reasoning: xhigh
access_tier: A2
```

## Escalation

Use role escalation when confidence is not high because reasoning is hard. Use an evidence pass when grounding risk is not low or evidence is missing. Use the final resolver only after role escalation or evidence pass fails.

```text
FINAL_RESOLVER: critic / explorer / gpt-5.5 / xhigh
MAX_ESCALATIONS_PER_STRAND: 2
```

If the final resolver cannot produce `confidence: high` and `grounding_risk: low`, ReasonWeave blocks and reports the missing evidence, ambiguity, failed proof gate, or unsafe downgrade.

## Sensitive Work

Security, privacy, billing, admin, destructive, production, and migration overlays cannot be silently downgraded. If `gpt-5.5` is unavailable for these routes, block instead of using a weaker fallback.
