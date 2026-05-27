# Strand Contracts

Use packets so subagent outputs stay compact and easy to integrate.

## Shared Required Block

Every delegated packet must include this block before strand-specific content:

```text
ROUTE:
- logical_agent:
- platform_agent_type:
- model:
- reasoning_effort:
- preferred_model:
- actual_model:
- fallback_reason:
- dispatch_authorized: yes | no

QUALITY:
- confidence: high | medium | low
- confidence_reason:
- grounding_risk: low | medium | high
- grounding_risk_reason:
- uncertainty_type: none | missing_evidence | ambiguous_requirement | conflicting_evidence | failed_verification | model_uncertainty
- escalation_used: none | role_escalation | evidence_pass | top_tier_resolver

EVIDENCE:
- inspected_paths:
- commands_run:
- sources:
- assumptions:

ACCESS_USED:
- tools_used:
- files_read:
- files_written:
- commands_run:
- network_used:
- approvals_used:
- access_violations: none | details

DECISION:
- accept | rework | escalate | block
- next_safe_action:
```

Accept packets only when `confidence: high`, `grounding_risk: low`, and `access_violations: none`.

## Router Packet

```text
ROUTER PACKET
PRIMARY_TASK_TYPE:
RISK_FLAGS:
EFFORT_TIER:
ROUTE_CONFIDENCE: high | medium | low
ROUTE_GROUNDING_RISK: low | medium | high
SELECTED_AGENTS:
- logical_agent | platform_agent_type | model | reasoning_effort | fallback_model | owned_scope | packet_type
ACCESS_PLAN:
- logical_agent | access_tier | allowed_tools | forbidden_tools | write_scope | command_scope | approval_required
ESCALATION:
- trigger | logical_agent | platform_agent_type | model | reasoning_effort
NO_DELEGATION_REASON:
```

## Research Packet

```text
RESEARCH PACKET
FOUND:
- path:line - symbol - fact
UNKNOWN:
- question
RISK:
- concise risk
```

## Build Packet

```text
BUILD PACKET
CHANGED:
- path - change
TESTS:
- command - result
NOTES:
- constraint/risk
```

## Review Packet

```text
REVIEW PACKET
FINDINGS:
- severity - path:line - issue - fix
TOTALS:
- critical/high/medium/low
```

## Critic Packet

```text
CRITIC PACKET
RISKS:
- assumption - failure mode - mitigation
DECISION:
- accept/rework/block
```

## Debug Packet

```text
DEBUG PACKET
ROOT_CAUSE:
EVIDENCE:
FIX:
VERIFY:
```

## Packet Rules

- Prefer path, line, symbol, fact.
- Avoid long narrative unless clarity requires it.
- Preserve exact errors, commands, file paths, identifiers, and URLs.
- Mark unknowns explicitly instead of guessing.
