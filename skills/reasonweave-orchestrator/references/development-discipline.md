# Development Discipline

Use this reference when implementing, debugging, testing, executing a plan, or making any behavior change.

## Test-First Rule

For feature or bugfix work, prefer a failing test or executable eval before implementation. If a test-first path is not practical, state why and name the alternative proof.

Minimum cycle:

1. Add or identify the failing check.
2. Run it and confirm the expected failure.
3. Implement the smallest scoped change.
4. Run the focused check again.
5. Run broader touched-area verification.

Do not claim a regression is fixed unless the original symptom is covered by fresh evidence.

## Systematic Debugging

Before changing code for a failure:

- read the complete error and stack trace,
- reproduce or explain why reproduction is unavailable,
- inspect recent diffs/config/environment,
- trace the bad value or failing state to its source,
- compare against a working local pattern,
- state one hypothesis and test one variable at a time.

After three failed fix attempts, stop and replan; repeated misses usually mean the abstraction, assumptions, or reproduction are wrong.

## Plan Execution

Execute implementation plans task by task. Keep ownership explicit, run the check attached to each task, and do not move to the next task while a blocking verification or review issue remains unresolved.

If a plan is incomplete, return to planning rather than filling product decisions during implementation.

## Verification Before Completion

No positive completion claim without fresh command output, browser output, rendered artifact, or explicit explanation that a gate is unavailable. A passing linter is not a build; a passing unit test is not a full release proof.
