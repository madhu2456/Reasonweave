# Design And Planning

Use this reference when a task asks for design, brainstorming, a plan, a spec, or any new feature whose requirements are not already decision-complete.

## Intent Discovery

- Inspect project context before asking questions.
- Ask only questions that change scope, constraints, success criteria, or architecture.
- Prefer one concise question at a time for high-impact ambiguity.
- If the request spans independent subsystems, decompose it before planning.
- Keep trivial tasks lightweight: a short design note can be enough, but name assumptions.

## Approach Selection

Present 2-3 viable approaches when architecture, UX, storage, security, cost, or maintainability tradeoffs matter. Include a recommendation and the reason it fits the codebase.

Do not invent new framework choices when the repo already has a clear pattern unless the current pattern cannot satisfy the requirement safely.

## Decision-Complete Plans

A plan is acceptable only when another worker can execute it without making product or architecture decisions. Include:

- goal and explicit non-goals,
- files or modules likely to change,
- interfaces, schemas, commands, or outputs,
- edge cases and failure behavior,
- verification commands and expected outcomes,
- rollout, migration, or approval steps when relevant.

## Two-Pass Planner Workflow

For non-trivial planning, run the same `planner` twice:

1. `planner_pass`: `gpt-5.5/high` creates the decision-complete product and architecture plan.
2. `execution_detail_pass`: `gpt-5.5/xhigh` immediately refines the plan into an implementation handoff.

The xhigh detail pass is required for implementation plans, risky plans, cross-file changes, API/plugin/MCP work, data/security/ops/release plans, and any plan intended for another agent. It may be skipped only for trivial answers, tiny one-file notes, or clarification-only planning responses.

The execution detail pass must include target files or modules, ordered implementation steps, interface or schema changes, edge cases, failure behavior, verification commands with expected outcomes, reviewer or verifier expectations, explicit assumptions, and non-goals.

If the xhigh pass cannot remove remaining product or architecture decisions, return `needs_clarification` with the missing decisions instead of calling the plan implementation-ready.

## Design Gate

Before implementation, confirm the design has no placeholders, contradictions, hidden destructive behavior, or unresolved high-impact ambiguity. If the user has requested planning-only work, stop at the plan.
