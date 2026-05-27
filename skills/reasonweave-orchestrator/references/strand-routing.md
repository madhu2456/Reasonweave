# Strand Routing

## Effort Tiers

- `S`: answer, tiny fix, or one-file inspection. Stay single-threaded.
- `M`: bounded task. Optional research or review strand.
- `L`: multi-file feature. Use a pass plan and at least one review strand.
- `XL`: cross-system work. Use a pattern map, multiple passes, critic strand, and staged verification.

## Task Types

- `answer`: explain or advise.
- `plan`: create an implementation plan.
- `audit`: inspect and produce findings.
- `debug`: reproduce, isolate, fix, verify.
- `implement`: change files.
- `review`: inspect diff or code for risks.
- `research`: gather external or local facts.
- `ops`: deploy, configure, or run infrastructure checks.
- `docs`: create durable written artifacts.

## Delegation Rules

- Main thread owns the critical path and final integration.
- Delegate only independent work that can proceed without blocking the next local step.
- Do not spawn agents only because a task asks for depth or thoroughness.
- Build strands must have disjoint file ownership.
- Review strands must not review their own build work.
- If the next action depends on a fact, gather that fact locally instead of waiting on a strand.