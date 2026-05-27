# Strand Contracts

Use packets so subagent outputs stay compact and easy to integrate.

## Research Packet

```text
RESEARCH PACKET
FOUND:
- path:line - symbol - fact
UNKNOWN:
- question
RISK:
- concise risk
```

## Build Packet

```text
BUILD PACKET
CHANGED:
- path - change
TESTS:
- command - result
NOTES:
- constraint/risk
```

## Review Packet

```text
REVIEW PACKET
FINDINGS:
- severity - path:line - issue - fix
TOTALS:
- critical/high/medium/low
```

## Critic Packet

```text
CRITIC PACKET
RISKS:
- assumption - failure mode - mitigation
DECISION:
- accept/rework/block
```

## Debug Packet

```text
DEBUG PACKET
ROOT_CAUSE:
EVIDENCE:
FIX:
VERIFY:
```

## Packet Rules

- Prefer path, line, symbol, fact.
- Avoid long narrative unless clarity requires it.
- Preserve exact errors, commands, file paths, identifiers, and URLs.
- Mark unknowns explicitly instead of guessing.