# Strand Routing

Use `model-routing.yaml` as the source of truth for exact logical agents, models, reasoning efforts, access tiers, task routes, and fallback rules.

## Effort Tiers

- `S`: answer, tiny fix, or one-file inspection. Stay single-threaded.
- `M`: bounded task. Optional research or review strand.
- `L`: multi-file feature. Use a pass plan and at least one review strand.
- `XL`: cross-system work. Use a pattern map, multiple passes, critic strand, and staged verification.

## Task Types

- `answer`: explain or advise.
- `plan`: create an implementation plan.
- `research`: gather external or local facts.
- `map`: inventory files, ownership, entrypoints, modules, and dependencies.
- `audit`: inspect and produce findings.
- `review`: inspect diff or code for risks.
- `implement`: change files.
- `refactor`: restructure without intended behavior change.
- `debug`: reproduce, isolate, fix, verify.
- `test`: add, repair, or run verification coverage.
- `docs`: create durable written artifacts.
- `ui`: frontend, visual, browser, accessibility, or responsive work.
- `data`: schema, migration, parsing, exports, or persistence work.
- `ops`: deploy, configure, automate, or run infrastructure checks.
- `release`: final integration, changelog, PR, publish, or rollout work.

## Risk Overlays

- `security`
- `privacy`
- `billing`
- `admin`
- `destructive`
- `production`
- `migration`
- `long_context`
- `conflicting_packets`

Risk overlays override task defaults. Sensitive overlays cannot be silently downgraded to weaker models.

## Logical Agent Rules

- `router` is the only logical agent that may use platform `default`.
- Read-only roles use `explorer`.
- Editing, verification, ops, release, and command-running roles use `worker`.
- `planner` is read-only but accuracy-critical: use `explorer`, `gpt-5.5`, `high`; escalate to `xhigh`.
- Workers must have explicit ownership scope before dispatch.

## Delegation Rules

- Main thread owns the critical path and final integration.
- Delegate only independent work that can proceed without blocking the next local step.
- Do not spawn agents only because a task asks for depth or thoroughness.
- Build strands must have disjoint file ownership.
- Review strands must not review their own build work.
- If the next action depends on a fact, gather that fact locally instead of waiting on a strand.
- If route confidence is not high, escalate router before dispatch.
- If grounding risk is not low, run an evidence pass before model escalation.
- If an agent needs a forbidden tool, it returns `DECISION: escalate` with `next_safe_action`.
