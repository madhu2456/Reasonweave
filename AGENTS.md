# Global Codex Agent Instructions

## Default Workflow

- Use `reasonweave-orchestrator` as the default workflow for non-trivial work, including planning, audits, reviews, debugging, implementation, multi-step changes, verification, route decisions, proof gates, or any task that may benefit from orchestration.
- When ReasonWeave applies, start with its Router-first workflow: create a Router Packet, classify task type/risk/effort, select model/reasoning/access, and then dispatch or proceed according to the routing policy.
- Superpowers skills are secondary. Use them only when they add a specific workflow benefit, when the user requests them, or when an external instruction explicitly requires them.
- Do not force ReasonWeave onto trivial one-line answers where no orchestration is useful; if in doubt, use ReasonWeave.
- User instructions, project `AGENTS.md`, and direct requests still take priority over ReasonWeave and Superpowers workflow guidance.
