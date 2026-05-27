# Pass Execution

A pass is one coordinated batch of independent strands.

## Rules

- Run at most 4 parallel strands in one pass.
- No two build strands may own the same file in the same pass.
- Every pass ends with main-thread integration review.
- A failed pass gets one debug pass before replanning.
- Do not wait idly if another non-overlapping task can proceed.
- Do not duplicate work across strands.
- Stop and replan if packets conflict on facts, ownership, or expected behavior.

## Pass Template

```text
PASS N
Goal:
Strands:
- name - owner/files - output packet
Dependencies:
Proof Gates:
Integration notes:
```