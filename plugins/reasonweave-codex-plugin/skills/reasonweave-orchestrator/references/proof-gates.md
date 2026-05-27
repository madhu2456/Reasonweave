# Proof Gates

Proof Gates prevent false completion claims.

## Gates

- Route Gate: router is the only `default` agent, every strand has model/reasoning/access metadata, and no strand inherits the current session model.
- Access Gate: every delegated packet reports tools, files, commands, network, approvals, and `access_violations: none`.
- Grounding Gate: every accepted packet has `confidence: high`, `grounding_risk: low`, and direct evidence or clearly named assumptions.
- Plan Gate: no blank sections, exact paths, acceptance criteria, risks named.
- Test Gate: run touched-area tests or state why unavailable.
- Build Gate: run compile, typecheck, or build when relevant.
- Security Gate: review auth, SSRF, secrets, billing, admin, privacy, and data access for sensitive work.
- UI Gate: use browser, visual, responsive, keyboard, and accessibility checks for frontend changes.
- Completion Gate: final response reports commands and results honestly.

## Rule

No positive completion claim without fresh evidence from the relevant gate. If a gate cannot run, say exactly why and name the residual risk.

If confidence is not high because reasoning is hard, escalate model/reasoning. If grounding risk is not low because evidence is missing, gather evidence before escalating. If top-tier resolution still cannot pass the gates, block.
