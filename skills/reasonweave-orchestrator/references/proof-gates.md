# Proof Gates

Proof Gates prevent false completion claims.

## Gates

- Route Gate: router is the only `default` agent, every strand has model/reasoning/access metadata, and no strand inherits the current session model.
- Runtime Verification Gate: API-verified routed work has trusted platform metadata or a signed runner receipt proving the intended model and reasoning actually executed.
- Access Gate: every delegated packet reports tools, files, commands, network, approvals, and `access_violations: none`.
- Grounding Gate: every accepted packet has `confidence: high`, `grounding_risk: low`, and direct evidence or clearly named assumptions.
- Review Reporting Gate: API routes that select `reviewer`, `docs-reviewer`, or `critic` report verified, blocked, or failed status; subscription routes do not imply an API-verified review.
- Plan Gate: no blank sections, exact paths, acceptance criteria, risks named, and non-trivial plans include planner `gpt-5.5/high` plus planner `gpt-5.5/xhigh` execution detail.
- Design Gate: new or ambiguous work has enough intent, constraints, alternatives, and assumptions to avoid hidden product decisions during implementation.
- TDD Gate: behavior-changing code has a failing test, route eval, or named alternative proof before the fix is accepted.
- Debug Gate: bugfix work reports reproduction status, root-cause evidence, hypothesis, fix, and verification.
- Plan Execution Gate: implementation plans are executed task-by-task with ownership, checks, and unresolved blockers reported.
- Test Gate: run touched-area tests or state why unavailable.
- Build Gate: run compile, typecheck, or build when relevant.
- Security Gate: review auth, SSRF, secrets, billing, admin, privacy, and data access for sensitive work.
- UI Gate: use browser, visual, responsive, keyboard, and accessibility checks for frontend changes.
- Review Reception Gate: review feedback is understood, verified against the codebase, then accepted or rejected with technical evidence.
- Completion Gate: final response reports commands, results, residual risk, and API runtime/review status only when that surface is used.

## Rule

No positive completion claim without fresh evidence from the relevant gate. If a gate cannot run, say exactly why and name the residual risk.

If confidence is not high because reasoning is hard, escalate model/reasoning. If grounding risk is not low because evidence is missing, gather evidence before escalating. If top-tier resolution still cannot pass the gates, block.

## Runtime Verification Rule

Pass only when all are true:

```text
execution_status in [runtime_verified, receipt_verified]
model_match=true
reasoning_match=true
receipt_valid=true
```

For API-verified acceptance, block missing metadata, spawn-request-only proof, model mismatch, reasoning mismatch or unknown reasoning, unknown aliases, stale or replayed receipts, invalid hashes or signatures, parent/child chain mismatches, self-reported model claims, and fallback attempts that were not rerouted before dispatch.

Use `execution_status=failed` with a named failure state for provider refusal, model unavailable, tool spawn failure, timeout, receipt verification failure, or unauthorized fallback attempt.

For API planner two-pass work, the xhigh execution detail pass must reference the accepted high planner pass with a valid parent/child receipt chain. Missing, stale, tampered, or mismatched parent evidence blocks the execution detail pass.

## Review Reporting Rule

For API routes that include `reviewer`, `docs-reviewer`, or `critic`, the final answer must include a status for that strand. If runtime verification is unavailable, report:

```text
Reviewer: required by route policy; execution_status=blocked_unverified; verification_source=none; review_verified=false
```

For subscription work, omit unverified reviewer status labels and do not claim API-verified review, approval, or issue-free verification. Ordinary inspection may be described accurately as an advisory check.

## Native Workflow Rules

- Design/planning: use `design-and-planning.md`; block if high-impact ambiguity remains.
- Non-trivial planning: run the planner high pass, then the planner xhigh execution detail pass; return `needs_clarification` if another agent would still need to make product or architecture decisions.
- Implementation/testing/debugging: use `development-discipline.md`; block completion claims without fresh evidence.
- Review/release/branch finishing: use `review-and-release.md`; block destructive or production actions without approval and verified routing.
