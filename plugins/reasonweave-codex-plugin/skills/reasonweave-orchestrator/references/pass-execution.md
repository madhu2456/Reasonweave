# Pass Execution

A pass is one coordinated batch of independent strands.

## Rules

- Every delegated workflow starts with a Router Packet.
- Run at most 4 parallel strands in one pass.
- No two build strands may own the same file in the same pass.
- Every pass ends with main-thread integration review.
- A failed pass gets one debug pass before replanning.
- Do not wait idly if another non-overlapping task can proceed.
- Do not duplicate work across strands.
- Stop and replan if packets conflict on facts, ownership, or expected behavior.
- Stop and replan if an agent needs a tool outside its access tier.
- Do not accept a packet unless confidence is high, grounding risk is low, and access violations are none.

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
- logical_agent - platform_agent_type - model/reasoning - access_tier - owner/files - output packet
Dependencies:
Proof Gates:
Escalation:
- trigger - logical_agent - model/reasoning
Integration notes:
```
