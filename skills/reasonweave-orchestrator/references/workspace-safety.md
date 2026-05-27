# Workspace Safety

## Required Before Edits

- Confirm current directory.
- Check dirty tree if inside a git repo.
- Preserve user changes; identify them before editing.
- For large parallel work, prefer isolated worktrees.
- Assign file ownership per build strand.

## During Edits

- Never revert unrelated files.
- Never overwrite user work to simplify a merge.
- Review worker diffs before integration.
- Stop on unexpected destructive scope.
- Ask for explicit approval before destructive commands.

## Parallel Ownership

```text
Strand A owns: paths...
Strand B owns: paths...
Shared files: sequence manually, never parallel-edit.
```