# Tool Access

ReasonWeave routes with least privilege. The router creates an access plan before dispatching any specialist.

## Access Tiers

| Tier | Name | Allowed | Forbidden |
|---|---|---|---|
| `A1` | route-only | classify, route, emit Router Packet | file edits, tests, mutating shell, git mutation, deploys |
| `A2` | read-only local | read/search files, inspect diffs/logs/status | edits, tests/builds, network, git mutation |
| `A3` | read + research | A2 plus approved read-only source/web research | edits, tests/builds, git mutation |
| `A4` | write-owned-files | edit assigned files, run focused checks | unrelated edits, destructive commands, git push/reset |
| `A5` | verification | run tests/builds/browser checks for owned scope | deploys, secrets, destructive commands |
| `A6` | authorized sensitive/ops/release | approved sensitive cleanup, deploy, release, or git operations | unapproved sensitive, production, or destructive actions |
| `A7` | blocked/destructive | no execution until explicit approval | all action before approval |

## Rules

- Router may only route. It must not edit, run tests, commit, push, deploy, or perform worker tasks.
- Explorers are read-only unless explicitly defined as `A3` for web/docs research.
- Workers may edit only their assigned ownership scope.
- Memory cleanup, ops, and release runners require explicit approval before sensitive cleanup, production, destructive, credential, or release action.
- A packet with access violations cannot be accepted even if confidence is high.

## Packet Fields

Router packets include:

```text
ACCESS_PLAN:
- logical_agent | access_tier | allowed_tools | forbidden_tools | write_scope | command_scope | approval_required
```

Delegated packets include:

```text
ACCESS_USED:
- tools_used:
- files_read:
- files_written:
- commands_run:
- network_used:
- approvals_used:
- access_violations: none | details
```
