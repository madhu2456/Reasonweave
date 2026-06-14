# ReasonWeave Agent Suite

ReasonWeave is a Codex orchestration and token-efficiency skill system. It coordinates complex work through native design, planning, TDD, debugging, review, release, workspace safety, patterns, strands, passes, proof gates, runtime verification, and compressed packets.

## Repository Layout

```text
skills/reasonweave-orchestrator/   # Source copy of the installed global Codex skill
plugins/reasonweave-codex-plugin/  # Repo-native Codex plugin package
scripts/install-local.ps1          # Sync source skill into the local .agents runtime folder
scripts/archive-merged-global-skills.ps1 # Archive standalone skills absorbed into ReasonWeave
scripts/install-plugin-local.ps1   # Copy the plugin into the personal Codex plugin marketplace
scripts/install-codex-cli-local.sh # Install the plugin, MCP bundle, and custom agents for Codex CLI on Linux/macOS
scripts/init-reasonweave-runtime.ps1 # Generate local Ed25519 receipt keys outside the repo
scripts/sync-plugin.ps1            # Sync canonical skill into the plugin package
docs/                              # Roadmap and validation notes
```

## Local Install

Run from this repository root:

```powershell
.\scripts\install-local.ps1
```

This copies `skills/reasonweave-orchestrator` to:

```text
C:\Users\madhu\.agents\skills\reasonweave-orchestrator
```

Restart Codex after installing so skill metadata refreshes.

### Codex CLI Linux/macOS Install

Run from this repository root:

```bash
bash scripts/install-codex-cli-local.sh
```

This installs the repo-native Codex plugin into a local marketplace under:

```text
~/.codex/reasonweave-marketplace
```

It also copies the ReasonWeave custom-agent templates to:

```text
~/.codex/agents
```

The installer adds a minimal `[agents]` block to `~/.codex/config.toml` only when one does not already exist. It preserves unrelated custom agents and creates a timestamped config backup before editing.

Verify after restarting Codex or opening a new thread:

```bash
codex plugin marketplace list
codex plugin list
codex mcp list
codex doctor --summary --ascii
```

After a verified installation of the native memory/growth/web modules, archive the superseded standalone skills:

```powershell
.\scripts\archive-merged-global-skills.ps1
.\scripts\archive-merged-global-skills.ps1 -CheckOnly
```

This moves only the four absorbed skill folders into a timestamped archive and leaves connector skills such as `reddit` and `twitter` active.

## Plugin Development

The canonical skill source remains `skills/reasonweave-orchestrator`. Run this after changing the skill:

```powershell
.\scripts\sync-plugin.ps1
.\plugins\reasonweave-codex-plugin\scripts\validate-routing.ps1
.\plugins\reasonweave-codex-plugin\scripts\test-mcp.ps1
```

The plugin copy is committed for distribution, but it must stay in sync with the canonical skill.

ReasonWeave has two execution surfaces. Ordinary Codex subscription work uses clean advisory routing and normal proof gates without claiming verified model/reasoning execution. API-backed runner work fails closed: verified execution claims require trusted runtime metadata or a signed runner receipt.

## MCP Runtime Metadata

The plugin bundles `reasonweave-runner`, a stdio MCP server configured by `plugins/reasonweave-codex-plugin/.mcp.json`. It exposes:

- `reasonweave.get_runtime_capabilities`
- `reasonweave.get_subscription_observed_metadata`
- `reasonweave.run_verified_agent`
- `reasonweave.verify_receipt`
- `reasonweave.get_run_metadata`
- `reasonweave.list_recent_runs`
- `reasonweave.self_test`

Generate local receipt keys before live verified runs:

```powershell
.\scripts\init-reasonweave-runtime.ps1
```

Install the plugin into the personal Codex marketplace:

```powershell
.\scripts\install-plugin-local.ps1
```

Restart Codex or start a new thread after installing so the bundled MCP server is loaded. Offline MCP self-tests do not require an API key; live `run_verified_agent` calls require `OPENAI_API_KEY`.

### API vs Subscription Metadata

`OPENAI_API_KEY` is required only for live `receipt_verified` runner execution through the Responses API. In that mode, ReasonWeave authorizes the configured route and preflights ledger integrity before dispatch, sends provider response storage disabled, requires an actual response ID/model/reasoning match, bounds receipt lifetime and output size, and returns a signed receipt only after the local ledger records the result safely. Sensitive-prompt runs suppress output text in runner metadata, and corrupt replay history fails closed.

ChatGPT/Codex subscription mode can be observed with `reasonweave.get_subscription_observed_metadata`. It reads safe local Codex configuration such as configured model/reasoning and auth mode. Its structured tool record remains explicitly untrusted and never satisfies the Runtime Verification Gate, while ordinary assistant prose uses the clean advisory route format without exposing unverified status fields.

## Native Modules

ReasonWeave includes native workflows for memory/context handling, growth intelligence, web audits, web verification, and web implementation. Standalone `memory-management` and `world-class-*` skills can be archived after global installation verification; `reddit` and `twitter` remain separate connector skills.
