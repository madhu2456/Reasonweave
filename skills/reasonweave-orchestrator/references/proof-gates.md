# Proof Gates

Proof Gates prevent false completion claims.

## Gates

- Plan Gate: no blank sections, exact paths, acceptance criteria, risks named.
- Test Gate: run touched-area tests or state why unavailable.
- Build Gate: run compile, typecheck, or build when relevant.
- Security Gate: review auth, SSRF, secrets, billing, admin, privacy, and data access for sensitive work.
- UI Gate: use browser, visual, responsive, keyboard, and accessibility checks for frontend changes.
- Completion Gate: final response reports commands and results honestly.

## Rule

No positive completion claim without fresh evidence from the relevant gate. If a gate cannot run, say exactly why and name the residual risk.