# Web Builder Workflows

Use this module for implementation after the requested improvement or audit finding is known. Route changes as `web-build` through `web-builder`, `web-verifier`, and `reviewer`.

## Build Rules

- Build from evidence and existing project conventions; if no audit exists, inspect source and relevant runtime behavior first.
- Keep claims truthful. Never fabricate rankings, citations, traffic, backlinks, testimonials, ratings, awards, prices, conversions, authority, or customer results.
- Keep metadata, canonical URLs, sitemap entries, internal navigation, and structured data consistent.
- Run focused validation for changed behavior and identify field-data checks that remain external.

## Implementation Modules

### Metadata, Schema, SEO, GEO, And AEO

- Implement accurate titles, descriptions, canonical rules, Open Graph metadata, robots behavior, and absolute media URLs.
- Generate JSON-LD from visible, truthful data with stable entity IDs; do not add unsupported reviews, ratings, offers, FAQs, awards, or credentials.
- Fix indexability or rendering blockers before content polish; make key content readable in rendered HTML.
- Add answer-ready content only when it matches real intent and visible evidence.

### Content, CRO, And Comparison Pages

- Use useful, concrete copy aligned to user intent, product reality, and sourced proof.
- Match calls to action to the real next step and reduce demonstrable form or navigation friction.
- Keep competitor comparisons fair, specific, and sourced; avoid unverifiable or defamatory claims.

### Architecture And Programmatic Pages

- Build stable, readable URL structure, redirects, breadcrumbs, internal links, navigation, sitemap coverage, and canonical logic.
- Generate scaled pages only with unique user value, controlled indexability, reliable source data, and explicit empty/duplicate handling.

### Performance, Accessibility, And Security

- Address LCP, INP/TBT, and CLS using measurement or clearly named hypotheses; preserve stable dimensions and sensible loading behavior.
- Meet applicable WCAG 2.2 AA expectations for semantics, labels, keyboard, focus, contrast, reduced motion, target size, and error handling.
- Apply security improvements only within scope and verify headers, cookies, dependencies, error handling, or source-map policy when changed.

## Validation And Output Contract

Run appropriate tests, typecheck/build, and targeted browser checks for the owned scope. Report changed files, behavior before/after, checks and results, evidence-supported impact, rollback or residual risk, and any Search Console, analytics, CrUX, external validator, or production verification still needed.
