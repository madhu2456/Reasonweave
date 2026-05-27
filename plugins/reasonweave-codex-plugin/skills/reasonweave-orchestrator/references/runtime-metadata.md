# Runtime Metadata

Trusted runtime metadata proves that API-routed work used the intended model and reasoning. Codex subscription routing is advisory and may proceed without a runtime-verification claim.

ReasonWeave accepts two trusted proof sources:

- `platform_metadata`: metadata returned directly by a trusted runtime/delegation backend.
- `runner_receipt`: a signed receipt emitted by the bundled `reasonweave-runner` MCP server after it directly executes a Responses API request and verifies actual response metadata.

Never treat intended request values, prompt text, spawn requests, or agent self-report as execution proof.

## Subscription Observed Metadata

ChatGPT/Codex subscription configuration may be observed locally, but it is not trusted execution proof. A subscription-observed record may include:

- `configured_model` from Codex config `model`.
- `configured_reasoning` from Codex config `model_reasoning_effort`.
- `auth_mode` when it can be read safely from Codex auth JSON.
- `openai_api_key_present` as a boolean only.

Never expose, reuse, forward, or treat ChatGPT auth tokens as ReasonWeave credentials. Never mark subscription-observed metadata as `runtime_verified` or `receipt_verified`.
If configured model or reasoning values are missing or outside the allowlist, return an explicit `codex_config_invalid` tool error; a valid observation still remains untrusted.

Subscription-observed structured metadata must fail closed:

```text
execution_model=none
resolved_model=none
execution_reasoning=none
execution_status=blocked_unverified
model_match=false
reasoning_match=unknown
verification_source=none
receipt_valid=false
failure_state=subscription_metadata_untrusted
trusted_runtime_proof=false
decision=block
```

## User-Facing Route Lines

Use the full line only in API mode:

```text
Route: logical_agent=<agent>; intended_model=<model>; intended_reasoning=<effort>; execution_model=<model|none>; resolved_model=<model|none>; execution_reasoning=<effort|none>; execution_status=<runtime_verified|receipt_verified|spawn_request_only|blocked_unverified|failed>; model_match=<true|false>; reasoning_match=<true|false|unknown>; verification_source=<platform_metadata|runner_receipt|spawn_request|none>; access=<tier>
```

Use this clean advisory line in Codex subscription mode:

```text
ReasonWeave: logical_agent=<agent>; intended_model=<model>; intended_reasoning=<effort>; access=<tier>; mode=codex_subscription
```

Do not surface unverified execution-status fields in ordinary subscription prose. Do not turn that omission into an execution-verification or verified-review claim.

## Runtime Verification Gate

Pass only when all are true:

```text
execution_status in [runtime_verified, receipt_verified]
model_match=true
reasoning_match=true
receipt_valid=true
```

Apply this gate to API-verified acceptance. Block an API-verified claim when runtime metadata is missing, only spawn-request proof exists, model or reasoning mismatches, reasoning is unknown, an alias is unknown, a receipt is stale/replayed/tampered, a signature is invalid, or the model claim comes from agent self-report.

## MCP Runner Metadata

The bundled `reasonweave-runner` MCP server must populate route fields only from actual provider results:

- Send the exact `model`, exact `reasoning.effort`, and a unique `X-Client-Request-Id`.
- Generate `run_id` and `X-Client-Request-Id` inside the runner; callers cannot supply them.
- Authorize the requested logical agent, platform type, access tier, model, and reasoning against the routing policy before contacting the provider.
- Bind declared primary task type, risk flags, and access tier into the signed receipt; sensitive declared risks require a `gpt-5.5` `high` or `xhigh` route.
- Send `store: false`; local receipt/ledger storage is sufficient for ReasonWeave verification and avoids opting into provider-side response storage.
- If `sensitive_prompt=true`, do not persist or return the provider output text in runner metadata; retain only the redacted sensitive-output marker and verification metadata.
- Bound caller-specified provider timeout to the MCP tool timeout (`120000ms`), cap `max_output_tokens` at `32768`, and truncate non-sensitive returned/stored output metadata at `100000` characters with an explicit truncation indicator.
- Capture HTTP headers including `x-request-id`, `openai-processing-ms`, and rate-limit headers when present.
- Require actual response fields `id`, `status`, `model`, and `reasoning.effort`; capture `usage`, `error`, `incomplete_details`, `created_at`, `completed_at`, and reasoning-token details when present. A missing provider response ID cannot be receipted.
- Set `execution_model` and `resolved_model` from the response `model`, not the request model.
- Set `execution_reasoning` from response `reasoning.effort`, not the request reasoning.
- Return `blocked_unverified` or `failed` if model, reasoning, status, receipt signing proof, or a refusal-free output is missing or mismatched.
- Require a parent run, when provided, to identify an already accepted ledger record whose signed receipt chain is re-verified before dispatching a child; stored status booleans alone are not proof.

## Runtime Receipt

Required receipt shape:

```json
{
  "receipt_version": "1",
  "run_id": "<id>",
  "nonce": "<random>",
  "delegated_agent_id": "<id>",
  "parent_run_id": "<id|null>",
  "logical_agent": "<agent>",
  "primary_task_type": "<task-type>",
  "risk_flags": ["<risk-overlay>"],
  "platform_agent_type": "<default|explorer|worker>",
  "access": "<tier>",
  "intended_model": "<model>",
  "resolved_model": "<model>",
  "execution_model": "<model>",
  "intended_reasoning": "<low|medium|high|xhigh>",
  "execution_reasoning": "<low|medium|high|xhigh>",
  "verification_source": "platform_metadata|runner_receipt",
  "model_match": true,
  "reasoning_match": true,
  "dispatch_authorized": true,
  "issued_at": "<iso8601>",
  "expires_at": "<iso8601>",
  "key_id": "<trusted-key-id>",
  "receipt_hash": "<sha256>",
  "receipt_signature": "<ed25519_signature>"
}
```

## Receipt Verification

- Compute `receipt_hash` from canonical JSON of all receipt fields except `receipt_hash` and `receipt_signature`.
- Canonical JSON uses UTF-8, sorted keys, no extra whitespace, and normalized ISO timestamps.
- Hash input is `sha256("reasonweave-runtime-receipt:v1\n" + canonical_json)`.
- Verify Ed25519 signatures with the configured trusted public key matching `key_id`.
- Recompute model/reasoning match and route authorization while verifying; never trust signed boolean flags alone.
- Reject expired receipts, invalid or overlong receipt lifetimes, malformed required fields, unknown key ids, missing public keys, invalid hashes, invalid signatures, unauthorized routes, and parent/child chain mismatches. Runner receipts expire no more than 10 minutes after issuance.
- Treat `reasonweave.verify_receipt` as read-only signature/chain inspection. Apply replay rejection when accepting or consuming a receipt for a new ledger action; a newly issued receipt may be inspected after its issuance record has already been stored.
- Preflight local ledger integrity before provider dispatch and fail closed with `ledger_integrity_failure` if corrupted history prevents a complete replay check for a newly accepted or consumed receipt; re-check on acceptance to catch mid-run changes.
- Trust `platform_metadata` only when it is returned directly by the trusted delegation/runtime backend.
- Never trust agent self-report, prompt text, or spawn request alone as runtime proof.

## Model And Reasoning Match

Normalize only these explicit aliases:

```text
gpt-5.5       => gpt-5.5, gpt-5.5-*
gpt-5.4       => gpt-5.4, gpt-5.4-*
gpt-5.4-mini  => gpt-5.4-mini, gpt-5.4-mini-*
gpt-5.3-codex => gpt-5.3-codex, gpt-5.3-codex-*
gpt-5.2       => gpt-5.2, gpt-5.2-*
```

Unknown aliases and broad family matches like `gpt-5` block. Named sibling families also block: `gpt-5.4-mini` cannot satisfy an intended `gpt-5.4` request through the `gpt-5.4-*` version rule. Reasoning must match exactly: `low`, `medium`, `high`, or `xhigh`.

Fallback models are allowed only when the router updates the intended model before dispatch and the new execution is verified.

## Failure States

Use `execution_status=failed` or `blocked_unverified` with a named failure state for missing API key, invalid key, insufficient permissions, network failure, rate limit, invalid request, unauthorized route, unsupported runtime, provider refusal, provider error, model unavailable, tool spawn failure, timeout, missing runtime metadata, incomplete response, model mismatch, reasoning mismatch, missing signing key, receipt verification failure, ledger write failure, ledger integrity failure, ledger read failure, unauthorized fallback attempt, or parent/child chain mismatch.

For subscription-observed mode, use `subscription_metadata_untrusted`, `codex_config_missing`, or `codex_config_invalid`. These states never pass the Runtime Verification Gate.
