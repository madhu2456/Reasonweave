# Workspace Safety

## Required Before Edits

- Confirm current directory.
- Check dirty tree if inside a git repo.
- Preserve user changes; identify them before editing.
- For large parallel work, prefer isolated worktrees.
- Assign file ownership per build strand.
- Confirm the strand has an access tier that allows edits.
- Confirm the Router Packet names the exact write scope before dispatching a worker.

## During Edits

- Never revert unrelated files.
- Never overwrite user work to simplify a merge.
- Review worker diffs before integration.
- Stop on unexpected destructive scope.
- Ask for explicit approval before destructive commands.
- Stop on access-tier violations and re-route the strand.
- Do not let explorers edit files or run mutating commands.
- Do not let router perform worker tasks.

## Parallel Ownership

```text
Strand A owns: paths...
Strand B owns: paths...
Shared files: sequence manually, never parallel-edit.
```
