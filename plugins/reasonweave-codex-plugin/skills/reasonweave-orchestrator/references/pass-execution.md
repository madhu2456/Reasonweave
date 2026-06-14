# Pass Execution

A pass is one coordinated batch of independent strands.

## Rules

- Every delegated workflow starts with a Router Packet.
- Non-trivial `plan` workflows use two planner phases before handoff: `planner_pass` at `gpt-5.5/high`, then `execution_detail_pass` at `gpt-5.5/xhigh`.
- Run at most 4 parallel strands in one pass.
- No two build strands may own the same file in the same pass.
- Every pass ends with main-thread integration review.
- For plan execution, run tasks sequentially unless file ownership and dependencies are disjoint.
- For each implementation task, require task output, focused verification, and self-review before review routing.
- Use two review lenses when risk warrants it: spec/requirement compliance first, then code quality and maintainability.
- A failed pass gets one debug pass before replanning.
- Do not wait idly if another non-overlapping task can proceed.
- Do not duplicate work across strands.
- Stop and replan if packets conflict on facts, ownership, or expected behavior.
- Stop and replan if an agent needs a tool outside its access tier.
- Stop with `needs_clarification` if the planner xhigh execution detail pass still has unresolved product or architecture decisions.
- In API mode, do not accept a packet unless confidence is high, grounding risk is low, access violations are none, and the Runtime Verification Gate passes.
- In API mode, the planner xhigh execution detail pass must provide a verified parent/child receipt chain to the accepted high planner pass.
- In Codex subscription mode, proceed advisory with the normal proof gates and never represent intended routing as runtime verification.
- Track every selected strand through API completion reporting; in subscription prose show intended routes only when useful.
- Do not omit API reviewer, docs-reviewer, or critic status when an API route requires one.
- Do not continue to the next task while a blocking spec, quality, test, access, or runtime verification issue remains unresolved.

## Pass Template

```text
PASS N
Goal:
Router:
- primary_task_type:
- risk_flags:
- route_confidence:
- route_grounding_risk:
Strands:
- logical_agent - phase - platform_agent_type - intended_model/intended_reasoning - execution_status - verification_source - access_tier - owner/files - output packet
Dependencies:
Proof Gates:
Runtime verification:
- execution_model/resolved_model/execution_reasoning - model_match - reasoning_match - receipt_valid - block_reason
Escalation:
- trigger - logical_agent - model/reasoning
Integration notes:
Completion reporting:
- selected_agent_status:
- review_status:
- residual_risk:
```
