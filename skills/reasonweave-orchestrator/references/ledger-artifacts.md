# Ledger Artifacts

A ledger artifact is durable evidence for a decision, handoff, audit, or completion claim.

## Required Fields

- Goal.
- Evidence.
- Target files or systems.
- Actions taken or proposed.
- Commands and results.
- Risks.
- Next step.

## Artifact Types

### Implementation Plan
Use goal, architecture, target files, tasks, tests, acceptance criteria, assumptions.

### Audit Report
Use findings ordered by severity, evidence, impact, recommendation, validation, residual risk.

### Review Report
Use findings first, then assumptions, tests checked, summary.

### Verification Summary
Use commands, exit status, important output, and what remains unverified.

### Handoff Packet
Use current state, decisions made, open knots, next exact action.

### Commit Message
Use Conventional Commits. Keep the subject at or below 50 characters when possible. Add a body only when the reason for the change is not obvious from the subject.

Required fields:
- type and scope when useful
- concise subject
- optional why-body
- no fake test claims
