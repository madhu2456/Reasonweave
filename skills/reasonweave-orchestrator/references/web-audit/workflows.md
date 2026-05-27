# Web Audit Workflows

Use this module for evidence-backed website or web-app audits. Route broad diagnosis as `web-audit` through `mapper`, `web-auditor`, and `critic`; route browser/build/Lighthouse verification separately as `web-verify`.

## Evidence And Scoring

- Start with repository status, framework boundaries, route inventory, runtime availability, and validation limits.
- Confirm issues from source, runtime, tests, or named external evidence; otherwise mark them as hypotheses needing validation.
- Use `Critical`, `High`, `Medium`, or `Low` severity and `high`, `medium`, or `low` confidence.
- Keep stable issue IDs so remediation and later verification can point to the same finding.
- Do not claim Search Console, analytics, CrUX, Lighthouse, production, security, or crawler results unless actually inspected.

## Audit Phases

### Discovery And Runtime

- Inspect public/private routes, redirects, headers, robots, sitemap, canonical behavior, and representative unauthenticated behavior.
- Record unavailable credentials, field data, analytics, crawler access, or production configuration.

### SEO, GEO, And AEO

- Check titles, descriptions, canonical and robots directives, hreflang when relevant, sitemap coverage, structured-data truthfulness, headings, answer clarity, entities, crawler directives, internal links, breadcrumbs, crawl depth, and intent match.

### Architecture And Performance

- Examine framework rendering boundaries, hydration/bundle risk, third-party scripts, metadata generation, image/font strategy, caching, worker behavior, timeouts, resource cleanup, deployment ordering, and Core Web Vitals risks.

### Security And Accessibility

- Inspect auth/cookie/callback safety, CORS and redirects, SSRF boundaries, API scoping, sanitized errors, security headers, keyboard operation, labels, landmarks, focus, reduced motion, and contrast.

### Remediation

- Produce linked issue IDs, owner type, affected locations, fix outline, acceptance criteria, validation commands, rollout or rollback risk, and external validation requirements.

## Focused Modules

- Technical SEO: discovered, crawlable, indexable, canonical, sitemap, blocked, private, or noindex URLs.
- On-page SEO and content quality: intent alignment, headings, content usefulness, attribution, trust, and stale or unsupported claims.
- Web quality and Lighthouse: only report measurements that were actually run; otherwise define the verification pass.
- Authority and trust: avoid manufactured authority metrics; report visible trust signals and evidence gaps.

## Output Contract

For each finding report ID, severity, confidence, source evidence, runtime evidence if available, impact, recommended remediation, validation steps, and external data needed. A critic must challenge unsupported conclusions before completion.
