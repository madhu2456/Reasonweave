# Dense Mode

Dense Mode saves tokens while preserving technical accuracy.

## Modes

- `clear`: default; readable prose.
- `brief`: shorter but complete.
- `dense`: terse, no filler, still readable.
- `ultra-dense`: only for packets or explicit user request.
- `safe-clear`: clarity-first mode for risk.

## Compatibility

- If the user asks for terse, compressed, token-saving, or minimal wording, use `dense` unless safety requires `safe-clear`.
- If the user asks to stop terse mode, return to `clear`.
- Do not expose archived skill names in normal responses.
- Keep code blocks, commands, error strings, API names, and identifiers exact.

## Auto-Clarity

Switch to `safe-clear` for security, irreversible actions, data deletion, migrations, production deploys, legal/billing decisions, and any instruction where compression could change order or meaning.