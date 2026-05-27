# ReasonWeave Agent Suite

ReasonWeave is a Codex orchestration and token-efficiency skill system. It coordinates complex work through patterns, strands, passes, proof gates, and compressed packets.

## Repository Layout

```text
skills/reasonweave-orchestrator/   # Source copy of the installed global Codex skill
scripts/install-local.ps1          # Sync source skill into the local .agents runtime folder
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