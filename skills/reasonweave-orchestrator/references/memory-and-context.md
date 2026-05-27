# Memory And Context

Use this module for durable project context, recall, archival, retention, and privacy cleanup.

## Routes

- `memory-read`: inspect relevant stored context without editing it; use `memory-reader` with `A2`.
- `memory-write`: record approved durable context; use `memory-manager` with `A4`.
- `memory-cleanup`: redact, remove, or archive sensitive context only with explicit user confirmation; use `memory-cleaner` with `A6` and a `critic` check.

## Rules

- Remember only facts likely to help later work: decisions, constraints, known risks, active tasks, and validated preferences.
- Separate stable project facts from temporary working notes and stale conclusions.
- Do not store secrets, tokens, credentials, private identifiers, or unnecessary personal data.
- For a write, state the scope, purpose, retention expectation, and any redaction before changing stored context.
- For privacy cleanup, identify the exact target and intended action before performing destructive or irreversible changes.
- If memory is missing, ambiguous, or contradicted by current source evidence, report the uncertainty instead of treating it as truth.

## Output Contract

Report the action type, context source or destination, sensitive-data handling, confirmation status for cleanup, evidence used, and remaining privacy or staleness risks.
