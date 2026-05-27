# Global Codex Agent Instructions

## Default Workflow

- Use `reasonweave-orchestrator` as the default workflow for non-trivial work, including planning, audits, reviews, debugging, implementation, multi-step changes, verification, route decisions, proof gates, or any task that may benefit from orchestration.
- When ReasonWeave applies, start with its Router-first workflow: create a Router Packet, classify task type/risk/effort, select model/reasoning/access, and then dispatch or proceed according to the routing policy.
- In ordinary Codex/subagent subscription work, show clean advisory routing before substantive work: `ReasonWeave: logical_agent=<agent>; intended_model=<model>; intended_reasoning=<effort>; access=<tier>; mode=codex_subscription`.
- In API-verified ReasonWeave runner work, show the full runtime route line from `runtime-metadata.md` and accept verified execution claims only when trusted metadata or a signed receipt proves the selected model and reasoning.
- Subscription work may proceed through normal proof gates, but it must not claim verified model execution, signed reviewer pass, API-verified review, approval, or issue-free review without trusted API/platform proof.
- Keep structured API/MCP verification failures explicit; do not surface unverified runtime-status fields in ordinary subscription prose.
- Use ReasonWeave-native references for design, planning, TDD, debugging, review, verification, workspace safety, branch finishing, and release workflows.
- Use ReasonWeave-native references for memory/context, growth intelligence, web audit, web verification, and web build workflows.
- Do not force ReasonWeave onto trivial one-line answers where no orchestration is useful; if in doubt, use ReasonWeave.
- User instructions, project `AGENTS.md`, and direct requests still take priority over ReasonWeave workflow guidance.
