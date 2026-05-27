# Strand Routing

Use `model-routing.yaml` as the source of truth for exact logical agents, models, reasoning efforts, access tiers, runtime verification rules, task routes, and fallback rules.

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
- `ops-check`: inspect deployment, automation, workspace, or infrastructure readiness without executing changes.
- `ops-run`: perform an approved deployment, configuration, automation, or infrastructure mutation.
- `release-check`: inspect branch finishing, changelog, PR, or release readiness without publishing.
- `release-run`: perform an approved merge, publish, rollout, or release mutation.
- `memory-read`: retrieve or inspect durable context.
- `memory-write`: store approved durable project context.
- `memory-cleanup`: redact, archive, or delete sensitive stored context with confirmation.
- `growth`: market, keyword, SERP, competitor, channel, measurement, or ASO intelligence.
- `web-audit`: website diagnosis and remediation findings.
- `web-verify`: browser, build, accessibility, Lighthouse, or runtime evidence pass.
- `web-build`: implement web, SEO, GEO, AEO, schema, CRO, performance, or accessibility changes.

## Native Workflow Triggers

- Design, brainstorm, requirements, or approach comparison: route as `plan`; use `design-and-planning.md`.
- Implementation plan or execute a plan: route as `implement` when files will change, otherwise `plan`; use `development-discipline.md`.
- TDD, regression test, or test-first prompt: route as `test` or `implement` depending on whether code changes are requested.
- Systematic debugging, failure, or unexpected behavior: route as `debug`.
- Request review, review feedback, or code quality check: route as `review`.
- Branch finishing, PR preparation, or release readiness: route as `release-check`; use `release-run` only for approved merge, publish, or rollout actions.
- Isolated workspace, dirty tree, worktree, or file ownership concern: route as `ops-check` and apply `workspace-safety.md` before dispatch; use `ops-run` only when an approved mutation is required.
- Remember, retrieve, archive, or privacy-clean project context: route as `memory-read`, `memory-write`, or `memory-cleanup`; use `memory-and-context.md`.
- Keyword, SERP, competitor, backlink, lifecycle, measurement, ASO, or market strategy: route as `growth`; use `growth-intelligence/workflows.md`.
- Website/SEO/performance/accessibility/security diagnosis: route as `web-audit`; use `web-audit/workflows.md`.
- Runtime/browser/Lighthouse verification of web findings: route as `web-verify`.
- Implement metadata, schema, SEO/GEO/AEO, content, CRO, architecture, performance, or accessibility work: route as `web-build`; use `web-builder/workflows.md`.

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
- API-verified routed work must have trusted runtime metadata or a signed ReasonWeave runner receipt before its execution claims can be accepted.
- Codex subscription routing is advisory and must use clean route prose without verified execution claims.

## Delegation Rules

- Main thread owns the critical path and final integration.
- Delegate only independent work that can proceed without blocking the next local step.
- Do not spawn agents only because a task asks for depth or thoroughness.
- Build strands must have disjoint file ownership.
- Review strands must not review their own build work.
- Review-required routes must keep reviewer, docs-reviewer, or critic visible through final completion reporting even when runtime verification blocks the strand.
- If the next action depends on a fact, gather that fact locally instead of waiting on a strand.
- If route confidence is not high, escalate router before dispatch.
- If grounding risk is not low, run an evidence pass before model escalation.
- If an agent needs a forbidden tool, it returns `DECISION: escalate` with `next_safe_action`.
- If runtime metadata is missing, spawn-request-only, mismatched, stale, replayed, tampered, self-reported, or host-runtime based, return `DECISION: block`.
- Fallback models require a new router decision before dispatch and verified execution after dispatch.
- If a required reviewer/docs-reviewer/critic strand blocks, report it as blocked instead of dropping it from the final answer.
