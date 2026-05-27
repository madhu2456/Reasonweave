# Future Plugin And MCP Architecture

ReasonWeave v1 is only a global skill. It should be written so it can later move into a public repo, plugin, and MCP suite without renaming.

## Future Packages

- `reasonweave-agent-suite`: GitHub repo containing skills, plugin manifest, MCP specs, tests, and examples.
- `reasonweave-codex-plugin`: Codex plugin wrapper exposing ReasonWeave skills and optional MCP servers.
- `reasonweave-context-mcp`: persistent context summaries, project memory, and ledgers.
- `reasonweave-compress-mcp`: deterministic packet compression, deduplication, and redaction.
- `reasonweave-runner-mcp`: safe worker/session orchestration.
- `reasonweave-proof-mcp`: verification evidence collection and report generation.

## V1 Scope

- Implement global skill files only.
- Do not build plugin code yet.
- Do not build MCP servers yet.
- Keep names, contracts, and references portable for future extraction.