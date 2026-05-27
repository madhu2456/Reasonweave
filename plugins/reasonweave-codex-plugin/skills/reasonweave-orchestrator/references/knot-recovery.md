# Knot Recovery

A knot is a blocker, conflict, stale assumption, or coordination failure.

## Recovery Rules

- Too many strands: pause delegation, merge facts, reduce to the critical path.
- Duplicate investigations: keep the packet with stronger evidence and stop the duplicate strand.
- Conflicting edits: stop integration, compare ownership, choose one owner, reapply manually.
- Stale context: reread source files before changing them.
- Over-compression hides warning: switch to `safe-clear` and restate exact risk.
- Fake verification: rerun the proof command or mark unverified.
- Packet lacks evidence: ask for path, line, command, or source before trusting it.
- Packet confidence is not high: role-escalate when reasoning is hard; gather evidence when facts are missing.
- Packet grounding risk is medium or high: run an evidence pass before model escalation.
- Access violation appears: stop integration, discard or quarantine the packet, and re-route with correct access.
- Top-tier resolver cannot pass gates: block and report missing evidence, ambiguity, failed verification, or unsafe downgrade.
- Infinite planning: identify smallest safe executable slice.
- Build strand touched unowned files: review those diffs manually before merging or discard with care.
