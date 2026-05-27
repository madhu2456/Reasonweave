# Workspace Safety

## Required Before Edits

- Confirm current directory.
- Check dirty tree if inside a git repo.
- Preserve user changes; identify them before editing.
- For large parallel work, prefer isolated worktrees.
- Detect whether the workspace is already isolated before creating or requesting another worktree.
- Prefer platform-native worktree/workspace mechanisms when available; use git worktrees only as a fallback.
- Verify project-local worktree folders are ignored before creating them.
- Assign file ownership per build strand.
- Confirm the strand has an access tier that allows edits.
- Confirm the Router Packet names the exact write scope before dispatching a worker.
- For API-verified routed execution, confirm the Runtime Verification Gate passes before accepting runtime verification claims.

## During Edits

- Never revert unrelated files.
- Never overwrite user work to simplify a merge.
- Never create nested worktrees or remove worktrees owned by the harness or an unknown tool.
- Never discard branches, commits, generated work, or worktrees without explicit confirmation.
- Review worker diffs before integration.
- Stop on unexpected destructive scope.
- Ask for explicit approval before destructive commands.
- Stop on access-tier violations and re-route the strand.
- In API mode, stop on runtime verification failures, receipt failures, or model/reasoning mismatches.
- Do not let explorers edit files or run mutating commands.
- Do not let router perform worker tasks.
- Do not let the host session perform substantive routed work when API-verified delegated execution is required.
- In subscription mode, describe review as advisory inspection only; do not claim API-verified review or approval.

## Parallel Ownership

```text
Strand A owns: paths...
Strand B owns: paths...
Shared files: sequence manually, never parallel-edit.
```

## Baseline Safety

Before substantial implementation, identify setup and baseline verification commands. If baseline checks already fail, report the failure and ask whether to investigate or proceed with known risk.
