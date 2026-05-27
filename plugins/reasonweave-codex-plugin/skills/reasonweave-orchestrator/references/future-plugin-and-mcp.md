# Plugin And MCP Architecture

ReasonWeave ships as a global skill and a repo-native Codex plugin. The plugin bundles an MCP runtime metadata server so future routed work can be verified by signed runner receipts instead of host-session self-report.

## Packages

- `reasonweave-agent-suite`: GitHub repo containing skills, plugin manifest, MCP specs, tests, and examples.
- `reasonweave-codex-plugin`: Codex plugin wrapper exposing ReasonWeave skills and the bundled runner MCP server.
- `reasonweave-runner`: stdio MCP server that executes Responses API requests, captures actual runtime metadata, signs receipts, stores run metadata, and verifies receipts.

## Implemented MCP Tools

- `reasonweave.get_runtime_capabilities`: reports strict mode, supported models/reasoning, key status, and ledger path without secrets.
- `reasonweave.get_subscription_observed_metadata`: reports local subscription configuration only as untrusted advisory observation.
- `reasonweave.run_verified_agent`: dispatches an exact model/reasoning request and returns `receipt_verified` only when actual response metadata matches and receipt signing succeeds.
- `reasonweave.verify_receipt`: verifies canonical hash, Ed25519 signature, bounded expiry, optional enforced replay, key id, route fields, and parent chain.
- `reasonweave.get_run_metadata`: reads stored metadata for a run id.
- `reasonweave.list_recent_runs`: lists recent ledger entries and reports corrupt rows.
- `reasonweave.self_test`: runs offline receipt, alias, and redaction checks without an API key.

## Scope Boundary

The MCP runner proves only work it directly executes or receipts it can verify. It does not prove the current host session model, platform sub-agent model, or any self-reported model claim unless the platform exposes trusted metadata or the run has a valid ReasonWeave receipt.

Sensitive-prompt execution suppresses returned and stored output text from runner metadata. Before dispatch and again before receipt acceptance, the runner checks local ledger integrity; enforced replay consumption also fails closed when integrity cannot be established.
