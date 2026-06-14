# Strand Contracts

Use packets so subagent outputs stay compact and easy to integrate.

## Shared Required Block

Every API-verified delegated packet must include this block before strand-specific content:

```text
ROUTE:
- logical_agent:
- platform_agent_type:
- intended_model:
- intended_reasoning:
- execution_model:
- resolved_model:
- execution_reasoning:
- execution_status: runtime_verified | receipt_verified | spawn_request_only | blocked_unverified | failed
- model_match: true | false
- reasoning_match: true | false | unknown
- verification_source: platform_metadata | runner_receipt | spawn_request | none
- delegated_agent_id:
- runtime_receipt_id:
- receipt_valid: true | false
- fallback_reason:
- dispatch_authorized: yes | no
- block_reason:

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

Accept API-verified packets only when `confidence: high`, `grounding_risk: low`, and `access_violations: none`.

Also require `execution_status: runtime_verified | receipt_verified`, `model_match: true`, `reasoning_match: true`, `receipt_valid: true`, and `dispatch_authorized: yes` for API-verified work. `spawn_request_only`, agent self-report, missing metadata, or unknown reasoning must block API verification claims.

In Codex subscription mode use an advisory route header instead of the runtime block:

```text
ReasonWeave: logical_agent=<agent>; intended_model=<model>; intended_reasoning=<effort>; access=<tier>; mode=codex_subscription
```

Subscription work may proceed through ordinary evidence, access, testing, and review checks, but must not claim API-verified execution or signed reviewer status.

## Completion Status Packet

Final answers for API-routed work must account for every selected logical agent:

```text
COMPLETION STATUS
SELECTED_AGENT_STATUS:
- logical_agent | intended_model | intended_reasoning | execution_status | verification_source | decision | block_reason
REVIEW_STATUS:
- required: yes | no
- logical_agent: reviewer | docs-reviewer | critic | none
- review_verified: true | false
- execution_status:
- block_reason:
RESIDUAL_RISK:
- unverified review, blocked runtime verification, skipped gate, or none
```

If API review is required but blocked, use `review_verified: false` and `execution_status: blocked_unverified`. Subscription prose omits those unverified runtime labels and must not imply API-verified review.

## Runtime Receipt Packet

```text
RUNTIME RECEIPT
receipt_version: 1
run_id:
nonce:
delegated_agent_id:
parent_run_id:
logical_agent:
primary_task_type:
risk_flags:
platform_agent_type:
access:
intended_model:
resolved_model:
execution_model:
intended_reasoning:
execution_reasoning:
verification_source: platform_metadata | runner_receipt
model_match: true | false
reasoning_match: true | false
dispatch_authorized: true | false
issued_at:
expires_at:
# expires_at must be after issued_at and no more than 10 minutes later.
key_id:
receipt_hash:
receipt_signature:
```

Hash and signature rules live in `runtime-metadata.md`. Reject stale, replayed, tampered, unsigned, unknown-key, and parent/child-mismatched receipts.

## Router Packet

```text
ROUTER PACKET
PRIMARY_TASK_TYPE:
RISK_FLAGS:
EFFORT_TIER:
ROUTE_CONFIDENCE: high | medium | low
ROUTE_GROUNDING_RISK: low | medium | high
SELECTED_AGENTS:
- logical_agent | phase | platform_agent_type | intended_model | intended_reasoning | fallback_model | owned_scope | packet_type
RUNTIME_VERIFICATION:
- logical_agent | delegated_agent_id | execution_status | execution_model | resolved_model | execution_reasoning | model_match | reasoning_match | verification_source | receipt_valid | block_reason
COMPLETION_REPORTING:
- logical_agent | execution_status | verification_source | decision | block_reason
ACCESS_PLAN:
- logical_agent | access_tier | allowed_tools | forbidden_tools | write_scope | command_scope | approval_required
ESCALATION:
- trigger | logical_agent | platform_agent_type | model | reasoning_effort
NO_DELEGATION_REASON:
```

## Planner Packet

```text
PLANNER PACKET
PHASE: planner_pass
ROUTE:
- logical_agent: planner
- platform_agent_type: explorer
- intended_model: gpt-5.5
- intended_reasoning: high
- access_tier: A2
GOAL:
NON_GOALS:
DECISIONS:
- product_or_architecture_decision
OPEN_QUESTIONS:
- question_or_none
IMPLEMENTATION_SHAPE:
- files_or_modules_likely_to_change
RISKS:
- risk - mitigation
NEXT_PHASE:
- execution_detail_pass_required: yes | no
- skip_reason: trivial_answer | tiny_one_file_note | clarification_only | none
DECISION:
- ready_for_execution_detail | needs_clarification
```

## Execution Detail Packet

```text
EXECUTION DETAIL PACKET
PHASE: execution_detail_pass
ROUTE:
- logical_agent: planner
- platform_agent_type: explorer
- intended_model: gpt-5.5
- intended_reasoning: xhigh
- access_tier: A2
PARENT:
- planner_pass_run_id:
- api_parent_child_receipt_verified: true | false | not_applicable_subscription
TARGETS:
- path_or_module - intended_change
ORDERED_STEPS:
- step - owner_agent - dependencies
INTERFACES:
- api_schema_output_or_contract_change
EDGE_CASES:
- case - expected_behavior
FAILURE_BEHAVIOR:
- failure_mode - block_or_recover_action
VERIFICATION:
- command_or_check - expected_result
REVIEW:
- reviewer_or_verifier - focus
ASSUMPTIONS:
- assumption
NON_GOALS:
- non_goal
DECISION:
- implementation_ready | needs_clarification
```

The execution detail packet is required for non-trivial plans. If `DECISION: needs_clarification`, list the exact missing product or architecture decisions and do not hand the plan to an implementer.

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
