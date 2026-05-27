# Packet Compression

Compression must reduce noise without losing operational truth.

## Pipeline

1. Redact secrets first.
2. Skip binary or unreadable content.
3. Strip ANSI and control noise.
4. Collapse repeated logs.
5. Summarize diffs by file, function, and change.
6. Convert JSON and tables into key facts.
7. Shorten repeated path prefixes only when unambiguous.
8. Deduplicate repeated facts across packets.
9. Preserve exact commands, errors, URLs, file paths, code identifiers, and line numbers.
10. If compression harms clarity, return original or switch to `safe-clear`.

## Never Compress Away

- Stack trace error names.
- Security warnings.
- Destructive command targets.
- Migration names.
- Billing amounts or plan names.
- File paths and line numbers used for fixes.