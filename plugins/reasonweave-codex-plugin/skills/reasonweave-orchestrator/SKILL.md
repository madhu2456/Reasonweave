---
name: reasonweave-orchestrator
description: Use when a task needs complex planning, orchestration, multi-agent coordination, parallel Codex work, delegated research or implementation, subagent workflows, review loops, compressed handoffs, saving tokens, dense or terse response modes, or structured verification before completion.
---

# ReasonWeave Orchestrator

ReasonWeave coordinates complex Codex work through patterns, strands, passes, proof gates, and compressed packets. Use it as the primary orchestration skill when work is too broad for a single straight-line edit, when parallel agents can help, or when token-efficient handoffs matter.

## Trigger Coverage

Use this skill for prompts that mention saving tokens, dense mode, delegating to subagents, multiple Codex agents, reviewing tersely, compressing a handoff into a packet, parallel strands, planning and verifying, or orchestrating an implementation.

## Core Workflow

1. Create a Router Packet: classify task type, effort, risk, confidence, grounding risk, selected agents, model/reasoning, tool access, and escalation.
2. Validate routing: only `router` may use platform `default`; all other strands must use `explorer` or `worker`.
3. Build a Pass Plan: identify independent work, sequencing, owned files, access tier, proof gates, and escalation conditions.
4. Dispatch only independent strands with clear ownership and allowed tools.
5. Collect Packets with route, quality, evidence, access, and decision fields.
6. Integrate results in the main thread.
7. Pass required Proof Gates, including route validation and grounding validation.
8. Produce final answer with evidence, decisions, residual risk, and next step.

## Modes

- `clear`: normal readable prose.
- `brief`: concise professional prose.
- `dense`: high-compression prose, no filler.
- `packet`: strict structured handoff format.
- `ledger`: evidence-first audit or review format.
- `safe-clear`: forced clarity for high-risk operations.

Always switch to `safe-clear` for destructive commands, security warnings, migrations, billing, legal work, production deploys, credential handling, data deletion, and ambiguous multi-step instructions.

## References

Load only what the task needs:

- `references/model-routing.md`: model, reasoning, routing, confidence, grounding, fallback, and escalation policy.
- `references/model-routing.yaml`: machine-checkable routing source of truth.
- `references/tool-access.md`: least-privilege access tiers and per-agent tool constraints.
- `references/reasonweave-nomenclature.md`: naming system and future namespace.
- `references/strand-routing.md`: task classification and delegation routing.
- `references/strand-contracts.md`: exact packet formats for each strand type.
- `references/pass-execution.md`: parallel execution rules.
- `references/proof-gates.md`: verification checkpoints.
- `references/workspace-safety.md`: dirty tree, worktree, and merge safety.
- `references/packet-compression.md`: safe compression pipeline.
- `references/dense-mode.md`: terse response modes and compatibility behavior.
- `references/ledger-artifacts.md`: durable handoff and report formats.
- `references/knot-recovery.md`: stuck, conflict, and retry rules.
- `references/future-plugin-and-mcp.md`: future GitHub repo, plugin, and MCP architecture.

## Operating Rules

- ReasonWeave does not claim permanent mathematical optimality; it enforces measurable routing quality through validation, evidence gates, evals, and safe blocking.
- Router is the only logical agent mapped to platform `default`.
- Router has route-only access and must not edit files, run tests, deploy, or perform the routed work.
- Main thread owns the critical path.
- Delegate only independent side work.
- Build strands need disjoint file ownership.
- Review strands must not review their own build work.
- Do not compress away exact commands, errors, URLs, paths, code identifiers, or line numbers.
- Never claim completion before passing the relevant Proof Gates.
- Never accept delegated packets unless `confidence: high`, `grounding_risk: low`, and `access_violations: none`.
