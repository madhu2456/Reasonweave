# Model Routing

ReasonWeave does not claim permanent mathematical optimality; it enforces measurable routing quality through validation, evidence gates, evals, and safe blocking.

`model-routing.yaml` is the machine-checkable source of truth. It is written as JSON-compatible YAML so PowerShell validation can parse it without extra dependencies. This document explains the policy for humans.

## Core Rules

- The `router` is the only logical agent that may use platform `agent_type: default`.
- All read-only specialists use `explorer`.
- All editing, command-running, verification, ops, or release execution specialists use `worker`.
- In API mode, no delegated strand may inherit the current Codex session model.
- Every strand must declare `logical_agent`, `platform_agent_type`, `intended_model`, `intended_reasoning`, `access_tier`, and escalation route.
- API-verified routed work must be executed by a delegated agent with trusted runtime metadata or a signed ReasonWeave runner receipt.
- The runner rejects a request unless the logical agent, platform type, access tier, model, and reasoning exactly form an allowed default, escalation, or declared top-tier route.
- Codex subscription routing is advisory: work may proceed using normal proof gates, but it must not claim verified model/reasoning execution.
- An API-verified packet is accepted only when `confidence: high`, `grounding_risk: low`, `access_violations: none`, `model_match: true`, `reasoning_match: true`, and `receipt_valid: true`.

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

The router may classify, dispatch, or block. It must not perform the routed planner, auditor, reviewer, implementer, docs, ops, or release work itself.

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
TERMINAL_ROUTE_FOR_EACH_LOGICAL_AGENT: gpt-5.5 / xhigh
MAX_ESCALATIONS_PER_STRAND: 2
```

Every logical agent may use its declared universal terminal `gpt-5.5/xhigh` route when role escalation is insufficient or a sensitive route requires top-tier execution. If terminal execution or the final resolver cannot produce `confidence: high` and `grounding_risk: low`, ReasonWeave blocks and reports the missing evidence, ambiguity, failed proof gate, or unsafe downgrade.

## Execution Surfaces

Use the appropriate visible route:

```text
API: Route: logical_agent=<agent>; intended_model=<model>; intended_reasoning=<effort>; execution_model=<model|none>; resolved_model=<model|none>; execution_reasoning=<effort|none>; execution_status=<runtime_verified|receipt_verified|spawn_request_only|blocked_unverified|failed>; model_match=<true|false>; reasoning_match=<true|false|unknown>; verification_source=<platform_metadata|runner_receipt|spawn_request|none>; access=<tier>
Codex subscription: ReasonWeave: logical_agent=<agent>; intended_model=<model>; intended_reasoning=<effort>; access=<tier>; mode=codex_subscription
```

Subscription user-facing prose omits unverified runtime-status fields. It must not state verified model execution, signed reviewer pass, API-verified review, approval, or issue-free review without API/platform proof. Structured MCP records remain explicit and fail closed.

## Runtime Verification

Use `references/runtime-metadata.md` for exact receipt and matching rules. The short rule is:

```text
PASS: execution_status in [runtime_verified, receipt_verified]
AND model_match=true
AND reasoning_match=true
AND receipt_valid=true
```

`spawn_request_only` is diagnostic and never enough for strict API routed execution. Agent self-report is not trusted as API runtime proof.

Subscription-observed Codex config is also diagnostic only. It may report the locally configured `model`, `model_reasoning_effort`, and safe auth mode, but it is not provider/runtime metadata and must use `execution_status: blocked_unverified`, `verification_source: none`, and `failure_state: subscription_metadata_untrusted`.

## Model Alias Policy

Only explicit aliases in `model-routing.yaml` are valid. Broad model families like `gpt-5` do not match. A wildcard version suffix must never match another named allowlisted family: `gpt-5.4-mini` is not an execution alias for `gpt-5.4`. Reasoning must match exactly: `low`, `medium`, `high`, or `xhigh`.

## Sensitive Work

Security, privacy, billing, admin, destructive, production, and migration overlays cannot be silently downgraded. If `gpt-5.5` is unavailable for these routes, block instead of using a weaker fallback.

Fallback models are allowed only when the router updates the intended model before dispatch and the new execution is verified by trusted runtime metadata or a signed runner receipt.

## Native Domain Routes

- `memory-read`, `memory-write`, and `memory-cleanup` cover durable context and privacy-safe cleanup.
- `growth` covers evidence-backed market, keyword, SERP, competitor, channel, measurement, and ASO strategy.
- `web-audit` produces evidence-backed findings; `web-verify` performs browser/build/runtime checks; `web-build` implements approved improvements.

## Completion Reporting

In API mode, final answers must report every selected logical agent's runtime status. For each selected agent include logical agent, intended model, intended reasoning, execution status, verification source, decision, and block reason.

In Codex subscription mode, report the selected route when useful but omit unverified execution status fields. Do not imply an API-verified reviewer/critic pass or approval.
