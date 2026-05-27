# Review And Release

Use this reference for code reviews, review feedback, branch finishing, PRs, merges, release checks, and production-facing handoffs.

## Review Requests

Review strands must receive the actual diff or exact file scope, requirements, and verification evidence. Review findings lead with bugs, regressions, safety issues, and missing tests. Review strands must not review their own build work.

For API-verified routed work, a review is accepted as API-verified only when its packet passes the Runtime Verification Gate. In Codex subscription work, perform advisory review where useful but do not claim a signed reviewer pass, API-verified review, approval, or issue-free verification without proof.

## Receiving Review Feedback

When feedback arrives:

- read all items before changing code,
- clarify unclear items before partial implementation,
- verify each suggestion against the codebase,
- push back with evidence when a suggestion is incorrect or violates scope,
- implement accepted items one at a time and run focused verification after each.

Avoid performative agreement. State the technical requirement, action, and evidence.

## Branch Finishing

Before merge, PR, release, or cleanup:

- verify touched-area tests and relevant build checks,
- inspect branch/worktree state,
- identify base branch,
- present merge, PR, keep-as-is, or discard choices when user direction is not explicit,
- require explicit confirmation before discarding work,
- never remove a harness-owned or unknown-provenance worktree.

Route readiness and workspace inspection as `release-check` or `ops-check`. For production or release mutations, route as `release-run` or `ops-run`, through `release-checker` or `ops-checker` before any `release-runner` or `ops-runner` action.
