# ReasonWeave Roadmap

## V1

- Maintain `reasonweave-orchestrator` as a global Codex skill.
- Keep orchestration, dense output, packets, proof gates, and workspace safety stable.
- Keep design, planning, TDD, debugging, review, branch finishing, and release workflows native to ReasonWeave.
- Package ReasonWeave as `reasonweave-codex-plugin`.
- Add routing/access/runtime validation and golden route evals.
- Enforce trusted runtime metadata contracts for API-backed execution while allowing clean advisory subscription routing without verified-execution claims.
- Bundle `reasonweave-runner` as a stdio MCP server for runtime metadata, signed receipts, ledger lookup, and offline self-tests.
- Support subscription-observed Codex config reporting as transparent, untrusted structured metadata while suppressing noisy unverified fields from normal subscription prose.
- Consolidate memory/context, growth intelligence, web audit, web verification, and web build guidance into native ReasonWeave modules.
- Provide local plugin install, runtime key initialization, MCP tests, and plugin validation.

## Future

- Publish as `reasonweave-agent-suite` GitHub repo.
- Track external Codex/OpenAI platform changes and update the runner only when upstream metadata or plugin loading contracts change.
