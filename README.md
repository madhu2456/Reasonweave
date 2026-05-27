# ReasonWeave Agent Suite

ReasonWeave is a Codex orchestration and token-efficiency skill system. It coordinates complex work through patterns, strands, passes, proof gates, and compressed packets.

## Repository Layout

```text
skills/reasonweave-orchestrator/   # Source copy of the installed global Codex skill
plugins/reasonweave-codex-plugin/  # Repo-native Codex plugin package
scripts/install-local.ps1          # Sync source skill into the local .agents runtime folder
scripts/sync-plugin.ps1            # Sync canonical skill into the plugin package
docs/                              # Future design notes for plugin and MCP work
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

## Plugin Development

The canonical skill source remains `skills/reasonweave-orchestrator`. Run this after changing the skill:

```powershell
.\scripts\sync-plugin.ps1
.\plugins\reasonweave-codex-plugin\scripts\validate-routing.ps1
```

The plugin copy is committed for distribution, but it must stay in sync with the canonical skill.
