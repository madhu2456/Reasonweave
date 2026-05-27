import crypto from "node:crypto";
import fs from "node:fs";
import {
  SERVER_VERSION,
  allowedReasoning,
  isAllowedModel,
  loadRoutingPolicy,
  modelAliasMatches,
  reasoningMatches,
  riskSelectionMatches,
  routeSelectionMatches,
  runtimeConfig,
  taskSelectionMatches,
} from "./config.mjs";
import { RuntimeLedger } from "./ledger.mjs";
import { createOpenAIResponse } from "./openai-client.mjs";
import {
  generateKeyPairPem,
  loadPrivateKey,
  loadPublicKeys,
  signReceipt,
  verifyReceipt as verifyReceiptCore,
} from "./receipt.mjs";
import { promptRecord, redact } from "./redaction.mjs";
import { observeSubscriptionMetadata } from "./subscription-observed.mjs";

const DEFAULT_MCP_TOOL_TIMEOUT_MS = 120000;
const DEFAULT_MAX_OUTPUT_TOKENS = 32768;
const DEFAULT_MAX_OUTPUT_TEXT_CHARS = 100000;

export const toolDefinitions = [
  {
    name: "reasonweave.get_runtime_capabilities",
    title: "ReasonWeave Runtime Capabilities",
    description: "Report ReasonWeave runner configuration and verification capability without revealing secrets.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "reasonweave.get_subscription_observed_metadata",
    title: "ReasonWeave Subscription Observed Metadata",
    description: "Read safe local Codex subscription configuration and report it as observed, untrusted metadata that never passes runtime verification.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "reasonweave.run_verified_agent",
    title: "Run Verified ReasonWeave Agent",
    description: "Run a routed agent through the Responses API and return trusted metadata plus a signed receipt when verification passes.",
    inputSchema: {
      type: "object",
      properties: {
        logical_agent: { type: "string" },
        primary_task_type: { type: "string" },
        risk_flags: { type: "array", items: { type: "string" } },
        platform_agent_type: { type: "string", enum: ["default", "explorer", "worker"] },
        intended_model: { type: "string" },
        intended_reasoning: { type: "string", enum: ["low", "medium", "high", "xhigh"] },
        access: { type: "string" },
        prompt: { type: "string" },
        parent_run_id: { type: ["string", "null"] },
        delegated_agent_id: { type: "string" },
        sensitive_prompt: { type: "boolean" },
        timeout_ms: { type: "number", minimum: 1000, maximum: DEFAULT_MCP_TOOL_TIMEOUT_MS },
        max_output_tokens: { type: "number", minimum: 1, maximum: DEFAULT_MAX_OUTPUT_TOKENS },
      },
      required: ["logical_agent", "primary_task_type", "risk_flags", "platform_agent_type", "intended_model", "intended_reasoning", "access", "prompt"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },
  {
    name: "reasonweave.verify_receipt",
    title: "Verify ReasonWeave Receipt",
    description: "Verify a ReasonWeave runtime receipt against trusted public keys and replay/parent rules.",
    inputSchema: {
      type: "object",
      properties: {
        receipt: { type: "object" },
        enforce_replay: { type: "boolean" },
      },
      required: ["receipt"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "reasonweave.get_run_metadata",
    title: "Get ReasonWeave Run Metadata",
    description: "Fetch stored metadata for a prior ReasonWeave run id.",
    inputSchema: {
      type: "object",
      properties: {
        run_id: { type: "string" },
      },
      required: ["run_id"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "reasonweave.list_recent_runs",
    title: "List Recent ReasonWeave Runs",
    description: "List recent stored ReasonWeave runtime metadata records.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number" },
      },
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "reasonweave.self_test",
    title: "ReasonWeave Runner Self-Test",
    description: "Run offline MCP, receipt, alias, and redaction checks without an OpenAI API key.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
];

export async function callTool(name, args = {}, deps = {}) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    const error = new Error("Tool arguments must be an object");
    error.code = -32602;
    throw error;
  }
  if (name === "reasonweave.get_runtime_capabilities") return getRuntimeCapabilities(args, deps);
  if (name === "reasonweave.get_subscription_observed_metadata") return getSubscriptionObservedMetadata(args, deps);
  if (name === "reasonweave.run_verified_agent") return runVerifiedAgent(args, deps);
  if (name === "reasonweave.verify_receipt") return verifyReceipt(args, deps);
  if (name === "reasonweave.get_run_metadata") return getRunMetadata(args, deps);
  if (name === "reasonweave.list_recent_runs") return listRecentRuns(args, deps);
  if (name === "reasonweave.self_test") return selfTest(args, deps);
  const error = new Error(`Unknown tool: ${name}`);
  error.code = -32602;
  throw error;
}

export function getRuntimeCapabilities(_args = {}, deps = {}) {
  const policy = deps.policy || loadRoutingPolicy();
  const config = deps.config || runtimeConfig();
  const publicKeys = tryLoadPublicKeys(config.publicKeysPath);
  const executionSurfaces = policy.execution_surfaces || {};
  return okResult({
    server_version: SERVER_VERSION,
    strict_mode: true,
    api_strict_mode: true,
    subscription_mode: executionSurfaces.codex_subscription?.mode || "advisory",
    supported_models: policy.models,
    supported_reasoning: allowedReasoning(policy),
    acceptance_execution_statuses: policy.policy.acceptance.execution_status,
    openai_api_key_present: Boolean(config.openaiApiKey),
    receipt_private_key_present: safeExists(config.privateKeyPath),
    receipt_public_keys_present: Object.keys(publicKeys).length,
    receipt_key_id: config.receiptKeyId,
    ledger_dir: config.ledgerDir,
    subscription_observation_supported: true,
    subscription_observation_trusted: false,
    api_receipts_require_openai_api_key: true,
    trusted_runtime_sources: ["platform_metadata", "runner_receipt"],
    metadata_rule: "Use actual provider response fields and HTTP headers only; never intended request fields as proof.",
    runner_limits: policy.runner_limits || null,
    execution_surfaces: Object.keys(executionSurfaces),
    user_facing_output_policy: {
      api: {
        mode: executionSurfaces.api?.mode || "strict_verified",
        report_execution_status: executionSurfaces.api?.report_execution_status !== false,
        route_format: executionSurfaces.api?.user_facing_route_format || null,
      },
      codex_subscription: {
        mode: executionSurfaces.codex_subscription?.mode || "advisory",
        report_execution_status: executionSurfaces.codex_subscription?.report_execution_status === true,
        route_format: executionSurfaces.codex_subscription?.user_facing_route_format || null,
        suppressed_user_facing_fields: executionSurfaces.codex_subscription?.suppressed_user_facing_fields || [],
      },
    },
  });
}

export function getSubscriptionObservedMetadata(args = {}, deps = {}) {
  const result = observeSubscriptionMetadata(args, deps);
  return result.ok ? okResult(result.payload) : toolError(result.payload);
}

export async function runVerifiedAgent(args = {}, deps = {}) {
  const policy = deps.policy || loadRoutingPolicy();
  const limits = runnerLimits(policy);
  const config = deps.config || runtimeConfig();
  const ledger = deps.ledger || new RuntimeLedger(config.ledgerDir);
  const validation = validateRunArgs(args, policy);
  const runId = crypto.randomUUID();
  const nonce = crypto.randomBytes(16).toString("hex");
  const clientRequestId = crypto.randomUUID();
  const startedAt = new Date();

  if (!validation.valid) {
    return toolError(routeFailure({
      run_id: runId,
      logical_agent: args.logical_agent || "unknown",
      primary_task_type: args.primary_task_type || "none",
      risk_flags: Array.isArray(args.risk_flags) ? args.risk_flags : [],
      access: args.access || "none",
      failure_state: validation.routeAuthorized === false ? "route_not_authorized" : "invalid_request",
      message: validation.errors.join("; "),
      intended_model: args.intended_model || "none",
      intended_reasoning: args.intended_reasoning || "none",
    }));
  }

  if (args.parent_run_id && !storedParentChainIsVerified(args.parent_run_id, ledger, config, policy)) {
    const blocked = routeFailure({
      run_id: runId,
      logical_agent: args.logical_agent,
      primary_task_type: args.primary_task_type,
      risk_flags: args.risk_flags,
      access: args.access,
      failure_state: "parent_child_chain_mismatch",
      message: "Parent run id was supplied but it does not identify an accepted verified parent.",
      intended_model: args.intended_model,
      intended_reasoning: args.intended_reasoning,
    });
    safeAppend(ledger, blocked);
    return toolError(blocked);
  }

  if (typeof ledger.assertReceiptAcceptanceReady === "function") {
    try {
      ledger.assertReceiptAcceptanceReady();
    } catch (error) {
      const ledgerError = String(error?.message || error);
      const failureState = ledgerError.includes("corrupt_") ? "ledger_integrity_failure" : "ledger_write_failure";
      return toolError(routeFailure({
        run_id: runId,
        logical_agent: args.logical_agent,
        primary_task_type: args.primary_task_type,
        risk_flags: args.risk_flags,
        access: args.access,
        failure_state: failureState,
        message: `Receipt storage is not ready before dispatch: ${ledgerError}`,
        intended_model: args.intended_model,
        intended_reasoning: args.intended_reasoning,
      }));
    }
  }

  const providerResult = await (deps.provider || createOpenAIResponse)({
    ...args,
    timeout_ms: args.timeout_ms || limits.toolTimeoutMs,
    max_output_tokens: args.max_output_tokens || limits.maxOutputTokens,
    run_id: runId,
    client_request_id: clientRequestId,
  }, config, deps.fetch);
  const endedAt = new Date();
  const providerMetadata = extractProviderMetadata(providerResult, clientRequestId);

  if (!providerResult.ok) {
    const failure = routeFailure({
      run_id: runId,
      logical_agent: args.logical_agent,
      primary_task_type: args.primary_task_type,
      risk_flags: args.risk_flags,
      access: args.access,
      failure_state: providerResult.failure_state,
      message: providerResult.error,
      intended_model: args.intended_model,
      intended_reasoning: args.intended_reasoning,
      provider_metadata: providerMetadata,
    });
    safeAppend(ledger, failure);
    return toolError(failure);
  }

  const response = providerResult.response || {};
  const executionModel = response.model || "none";
  const executionReasoning = response.reasoning?.effort || "none";
  const modelMatch = modelAliasMatches(policy, args.intended_model, executionModel);
  const reasoningMatch = reasoningMatches(args.intended_reasoning, executionReasoning);
  const statusCompleted = response.status === "completed";
  const metadataComplete = typeof response.id === "string" && response.id.trim().length > 0
    && executionModel !== "none" && executionReasoning !== "none";

  const baseRecord = {
    metadata_version: "1",
    run_id: runId,
    logical_agent: args.logical_agent,
    primary_task_type: args.primary_task_type,
    risk_flags: args.risk_flags,
    platform_agent_type: args.platform_agent_type,
    access: args.access,
    parent_run_id: args.parent_run_id || null,
    delegated_agent_id: args.delegated_agent_id || `${args.logical_agent}:${runId}`,
    intended_model: args.intended_model,
    intended_reasoning: args.intended_reasoning,
    execution_model: executionModel,
    resolved_model: executionModel,
    execution_reasoning: executionReasoning,
    model_match: modelMatch,
    reasoning_match: reasoningMatch,
    dispatch_authorized: true,
    provider_metadata: {
      ...providerMetadata,
      response_id: response.id || null,
      status: response.status || null,
      error: redact(response.error || null),
      incomplete_details: redact(response.incomplete_details || null),
      usage: redact(response.usage || null),
      created_at: response.created_at || null,
      completed_at: response.completed_at || null,
    },
    prompt: promptRecord(args.prompt, args.sensitive_prompt === true),
    started_at: startedAt.toISOString(),
    ended_at: endedAt.toISOString(),
    latency_ms: endedAt.getTime() - startedAt.getTime(),
  };

  if (containsRefusal(response)) {
    const refused = {
      ...baseRecord,
      execution_status: "failed",
      verification_source: "none",
      receipt_valid: false,
      failure_state: "provider_refusal",
      decision: "block",
      block_reason: "Provider returned a refusal instead of routed work output.",
    };
    safeAppend(ledger, refused);
    return toolError(refused);
  }

  if (!statusCompleted || !metadataComplete || !modelMatch || !reasoningMatch) {
    const blocked = {
      ...baseRecord,
      execution_status: "blocked_unverified",
      verification_source: "none",
      receipt_valid: false,
      failure_state: classifyMetadataFailure({ statusCompleted, metadataComplete, modelMatch, reasoningMatch }),
      decision: "block",
      block_reason: "Runtime metadata did not satisfy ReasonWeave verification gate.",
    };
    safeAppend(ledger, blocked);
    return toolError(blocked);
  }

  let privateKey;
  try {
    privateKey = deps.privateKeyPem || loadPrivateKey(config.privateKeyPath);
  } catch {
    const blocked = {
      ...baseRecord,
      execution_status: "blocked_unverified",
      verification_source: "none",
      receipt_valid: false,
      failure_state: "missing_signing_key",
      decision: "block",
      block_reason: "Runtime metadata matched, but no signing key is configured for runner receipt.",
    };
    safeAppend(ledger, blocked);
    return toolError(blocked);
  }

  const issuedAt = new Date();
  const receiptLifetimeMs = Number.isFinite(policy.runtime_receipt?.max_lifetime_ms)
    ? policy.runtime_receipt.max_lifetime_ms
    : 10 * 60 * 1000;
  const receipt = signReceipt({
    receipt_version: "1",
    run_id: runId,
    nonce,
    delegated_agent_id: baseRecord.delegated_agent_id,
    parent_run_id: baseRecord.parent_run_id,
    logical_agent: args.logical_agent,
    primary_task_type: args.primary_task_type,
    risk_flags: args.risk_flags,
    platform_agent_type: args.platform_agent_type,
    access: args.access,
    intended_model: args.intended_model,
    resolved_model: executionModel,
    execution_model: executionModel,
    intended_reasoning: args.intended_reasoning,
    execution_reasoning: executionReasoning,
    verification_source: "runner_receipt",
    model_match: true,
    reasoning_match: true,
    dispatch_authorized: true,
    issued_at: issuedAt.toISOString(),
    expires_at: new Date(issuedAt.getTime() + receiptLifetimeMs).toISOString(),
    key_id: config.receiptKeyId,
    provider_response_id: response.id || null,
    http_request_id: providerMetadata.http_request_id,
    client_request_id: clientRequestId,
  }, privateKey);

  const rawOutputText = typeof response.output_text === "string"
    ? response.output_text
    : extractOutputText(response);
  const record = {
    ...baseRecord,
    execution_status: "receipt_verified",
    verification_source: "runner_receipt",
    receipt_valid: true,
    failure_state: null,
    decision: "accept",
    block_reason: "none",
    receipt,
    output_text: args.sensitive_prompt === true
      ? "[REDACTED: sensitive output]"
      : rawOutputText.slice(0, limits.maxOutputTextChars),
    output_truncated: args.sensitive_prompt !== true && rawOutputText.length > limits.maxOutputTextChars,
  };

  try {
    const stored = ledger.appendRun(record);
    return okResult(stored);
  } catch (error) {
    const ledgerError = String(error?.message || error);
    return toolError({
      ...baseRecord,
      execution_status: "failed",
      verification_source: "none",
      receipt_valid: false,
      failure_state: ledgerError.includes("corrupt_runs_ledger") ? "ledger_integrity_failure" : "ledger_write_failure",
      decision: "block",
      block_reason: `Verified response could not be recorded safely: ${ledgerError}`,
    });
  }
}

export function verifyReceipt(args = {}, deps = {}) {
  const config = deps.config || runtimeConfig();
  const ledger = deps.ledger || new RuntimeLedger(config.ledgerDir);
  const publicKeys = deps.publicKeys || tryLoadPublicKeys(config.publicKeysPath);
  if (!args.receipt || typeof args.receipt !== "object" || Array.isArray(args.receipt)) {
    return toolError({ receipt_valid: false, errors: ["invalid_receipt_object"], failure_state: "invalid_request" });
  }
  if (args.enforce_replay !== undefined && typeof args.enforce_replay !== "boolean") {
    return toolError({ receipt_valid: false, errors: ["enforce_replay_must_be_boolean"], failure_state: "invalid_request" });
  }
  const enforceReplay = args.enforce_replay === true;
  let seenReplayKeys = new Set();
  try {
    if (enforceReplay) {
      seenReplayKeys = ledger.seenReplayKeys({ requireIntegrity: true });
    }
  } catch {
    return toolError({
      receipt_valid: false,
      replay_check_applied: true,
      errors: ["ledger_integrity_unavailable"],
      failure_state: "ledger_integrity_failure",
    });
  }
  const result = verifyReceiptCore(args.receipt, publicKeys, {
    policy: deps.policy || loadRoutingPolicy(),
    clockSkewMs: config.clockSkewMs,
    seenReplayKeys,
    parentIsValid: (runId) => storedParentChainIsVerified(runId, ledger, config, deps.policy || loadRoutingPolicy(), publicKeys),
  });
  const payload = { receipt_valid: result.valid, replay_check_applied: enforceReplay, ...result };
  return result.valid ? okResult(payload) : toolError(payload);
}

export function getRunMetadata(args = {}, deps = {}) {
  if (typeof args.run_id !== "string" || !args.run_id.trim()) {
    return toolError({ error: "run_id is required", failure_state: "invalid_request" });
  }
  const config = deps.config || runtimeConfig();
  const ledger = deps.ledger || new RuntimeLedger(config.ledgerDir);
  let result;
  try {
    result = ledger.getRun(args.run_id);
  } catch (error) {
    return toolError({
      error: "ledger_read_failure",
      run_id: args.run_id,
      failure_state: "ledger_read_failure",
      block_reason: String(error?.message || error),
    });
  }
  if (!result.run) {
    return toolError({ error: "run_not_found", run_id: args.run_id, corrupt_rows: result.corrupt_rows });
  }
  return okResult(result);
}

export function listRecentRuns(args = {}, deps = {}) {
  const config = deps.config || runtimeConfig();
  const ledger = deps.ledger || new RuntimeLedger(config.ledgerDir);
  if (args.limit !== undefined && (!Number.isInteger(args.limit) || args.limit < 1 || args.limit > 100)) {
    return toolError({ error: "limit must be an integer between 1 and 100", failure_state: "invalid_request" });
  }
  try {
    return okResult(ledger.listRuns(args.limit || 20));
  } catch (error) {
    return toolError({
      error: "ledger_read_failure",
      failure_state: "ledger_read_failure",
      block_reason: String(error?.message || error),
    });
  }
}

export function selfTest(_args = {}, deps = {}) {
  const policy = deps.policy || loadRoutingPolicy();
  const { publicKeyPem, privateKeyPem } = generateKeyPairPem();
  const issuedAt = new Date();
  const receipt = signReceipt({
    receipt_version: "1",
    run_id: crypto.randomUUID(),
    nonce: crypto.randomBytes(16).toString("hex"),
    delegated_agent_id: "self-test",
    parent_run_id: null,
    logical_agent: "tester",
    primary_task_type: "test",
    risk_flags: [],
    platform_agent_type: "worker",
    access: "A5",
    intended_model: "gpt-5.3-codex",
    resolved_model: "gpt-5.3-codex",
    execution_model: "gpt-5.3-codex",
    intended_reasoning: "medium",
    execution_reasoning: "medium",
    verification_source: "runner_receipt",
    model_match: true,
    reasoning_match: true,
    dispatch_authorized: true,
    issued_at: issuedAt.toISOString(),
    expires_at: new Date(issuedAt.getTime() + 600000).toISOString(),
    key_id: "self-test",
  }, privateKeyPem);
  const verification = verifyReceiptCore(receipt, { "self-test": publicKeyPem });
  const checks = {
    receipt_signature_valid: verification.valid,
    alias_exact_valid: modelAliasMatches(policy, "gpt-5.3-codex", "gpt-5.3-codex"),
    alias_snapshot_valid: modelAliasMatches(policy, "gpt-5.5", "gpt-5.5-2026-04-23"),
    broad_alias_rejected: !modelAliasMatches(policy, "gpt-5.5", "gpt-5"),
    sibling_alias_rejected: !modelAliasMatches(policy, "gpt-5.4", "gpt-5.4-mini"),
    reasoning_exact_valid: reasoningMatches("high", "high"),
    reasoning_mismatch_rejected: !reasoningMatches("high", "medium"),
    subscription_observation_is_not_trusted: observeSubscriptionMetadata({}, {
      policy,
      env: { REASONWEAVE_CODEX_CONFIG_PATH: "__missing_config_for_self_test__" },
    }).payload.trusted_runtime_proof === false,
    subscription_output_is_advisory: policy.execution_surfaces?.codex_subscription?.mode === "advisory"
      && policy.execution_surfaces.codex_subscription.report_execution_status === false,
    api_output_is_strict: policy.execution_surfaces?.api?.mode === "strict_verified"
      && policy.execution_surfaces.api.report_execution_status === true,
    redaction_valid: !JSON.stringify(redact({ Authorization: "Bearer sk-testsecret" })).includes("sk-testsecret"),
  };
  const passed = Object.values(checks).every(Boolean);
  const payload = { passed, checks, verification_errors: verification.errors };
  return passed ? okResult(payload) : toolError(payload);
}

function validateRunArgs(args, policy) {
  const errors = [];
  let routeAuthorized = null;
  const limits = runnerLimits(policy);
  for (const field of ["logical_agent", "primary_task_type", "platform_agent_type", "intended_model", "intended_reasoning", "access", "prompt"]) {
    if (typeof args[field] !== "string" || !args[field].trim()) errors.push(`${field} is required and must be a non-empty string`);
  }
  if (args.platform_agent_type && !["default", "explorer", "worker"].includes(args.platform_agent_type)) {
    errors.push("platform_agent_type is invalid");
  }
  if (args.intended_model && !isAllowedModel(policy, args.intended_model)) {
    errors.push(`intended_model is not allowed: ${args.intended_model}`);
  }
  if (args.intended_reasoning && !allowedReasoning(policy).includes(args.intended_reasoning)) {
    errors.push(`intended_reasoning is not allowed: ${args.intended_reasoning}`);
  }
  if (!Array.isArray(args.risk_flags) || args.risk_flags.some((flag) => typeof flag !== "string")) {
    errors.push("risk_flags is required and must be an array of strings");
  }
  if (args.timeout_ms !== undefined && (!Number.isInteger(args.timeout_ms) || args.timeout_ms < 1000 || args.timeout_ms > limits.toolTimeoutMs)) {
    errors.push(`timeout_ms must be between 1000 and ${limits.toolTimeoutMs} to fit the MCP tool timeout`);
  }
  if (args.max_output_tokens !== undefined && (!Number.isInteger(args.max_output_tokens) || args.max_output_tokens < 1 || args.max_output_tokens > limits.maxOutputTokens)) {
    errors.push(`max_output_tokens must be an integer between 1 and ${limits.maxOutputTokens}`);
  }
  if (args.parent_run_id !== undefined && args.parent_run_id !== null
      && (typeof args.parent_run_id !== "string" || !args.parent_run_id.trim())) {
    errors.push("parent_run_id must be null or a non-empty string");
  }
  if (args.delegated_agent_id !== undefined
      && (typeof args.delegated_agent_id !== "string" || !args.delegated_agent_id.trim())) {
    errors.push("delegated_agent_id must be a non-empty string");
  }
  if (args.sensitive_prompt !== undefined && typeof args.sensitive_prompt !== "boolean") {
    errors.push("sensitive_prompt must be a boolean when supplied");
  }
  if ("run_id" in args || "client_request_id" in args) {
    errors.push("run_id and client_request_id are runner-generated and cannot be supplied by callers");
  }
  if (errors.length === 0) {
    routeAuthorized = routeSelectionMatches(policy, {
      logical_agent: args.logical_agent,
      platform_agent_type: args.platform_agent_type,
      access: args.access,
      intended_model: args.intended_model,
      intended_reasoning: args.intended_reasoning,
    });
    if (!routeAuthorized) {
      errors.push("requested model/reasoning/access is not an authorized route for logical_agent");
    }
    if (!taskSelectionMatches(policy, args)) {
      routeAuthorized = false;
      errors.push("logical_agent is not selected by primary_task_type");
    }
    if (!riskSelectionMatches(policy, args)) {
      routeAuthorized = false;
      errors.push("risk flags are invalid or require a gpt-5.5 high/xhigh route");
    }
  }
  return { valid: errors.length === 0, errors, routeAuthorized };
}

function extractProviderMetadata(providerResult, clientRequestId) {
  const headers = providerResult.headers || {};
  return {
    http_request_id: headers["x-request-id"] || null,
    client_request_id: clientRequestId,
    openai_processing_ms: headers["openai-processing-ms"] || null,
    rate_limit: {
      limit_requests: headers["x-ratelimit-limit-requests"] || null,
      limit_tokens: headers["x-ratelimit-limit-tokens"] || null,
      remaining_requests: headers["x-ratelimit-remaining-requests"] || null,
      remaining_tokens: headers["x-ratelimit-remaining-tokens"] || null,
      reset_requests: headers["x-ratelimit-reset-requests"] || null,
      reset_tokens: headers["x-ratelimit-reset-tokens"] || null,
    },
  };
}

function classifyMetadataFailure({ statusCompleted, metadataComplete, modelMatch, reasoningMatch }) {
  if (!statusCompleted) return "incomplete_response";
  if (!metadataComplete) return "missing_runtime_metadata";
  if (!modelMatch) return "model_mismatch";
  if (!reasoningMatch) return "reasoning_mismatch";
  return "receipt_verification_failure";
}

function routeFailure({
  run_id,
  logical_agent = "unknown",
  primary_task_type = "none",
  risk_flags = [],
  access = "none",
  failure_state,
  message,
  intended_model,
  intended_reasoning,
  provider_metadata = {},
}) {
  return {
    metadata_version: "1",
    run_id,
    logical_agent,
    primary_task_type,
    risk_flags,
    access,
    intended_model,
    intended_reasoning,
    execution_model: "none",
    resolved_model: "none",
    execution_reasoning: "none",
    execution_status: "failed",
    model_match: false,
    reasoning_match: false,
    receipt_valid: false,
    dispatch_authorized: false,
    verification_source: "none",
    failure_state,
    decision: "block",
    block_reason: message,
    provider_metadata,
  };
}

function safeAppend(ledger, record) {
  try {
    ledger.appendRun(record);
  } catch {
    // Tool output remains authoritative even if metadata persistence fails.
  }
}

function extractOutputText(response) {
  const chunks = [];
  const output = Array.isArray(response.output) ? response.output : [];
  for (const item of output) {
    const contents = Array.isArray(item?.content) ? item.content : [];
    for (const content of contents) {
      if (content.type === "output_text" && typeof content.text === "string") {
        chunks.push(content.text);
      }
    }
  }
  return chunks.join("");
}

function containsRefusal(response) {
  const output = Array.isArray(response.output) ? response.output : [];
  for (const item of output) {
    const contents = Array.isArray(item?.content) ? item.content : [];
    for (const content of contents) {
      if (content.type === "refusal") {
        return true;
      }
    }
  }
  return false;
}

function tryLoadPublicKeys(publicKeysPath) {
  try {
    return loadPublicKeys(publicKeysPath);
  } catch {
    return {};
  }
}

function safeExists(filePath) {
  try {
    return typeof filePath === "string" && filePath.length > 0 && fs.existsSync(filePath);
  } catch {
    return false;
  }
}

function storedParentChainIsVerified(runId, ledger, config, policy, suppliedPublicKeys, seen = new Set()) {
  if (!runId || seen.has(runId) || typeof ledger.getRun !== "function") {
    return false;
  }
  seen.add(runId);
  let record;
  try {
    record = ledger.getRun(runId).run;
  } catch {
    return false;
  }
  if (!record || record.run_id !== runId || record.decision !== "accept"
      || record.receipt_valid !== true || !["runtime_verified", "receipt_verified"].includes(record.execution_status)
      || !["platform_metadata", "runner_receipt"].includes(record.verification_source) || !record.receipt) {
    return false;
  }
  const publicKeys = suppliedPublicKeys || tryLoadPublicKeys(config.publicKeysPath);
  const verification = verifyReceiptCore(record.receipt, publicKeys, {
    policy,
    clockSkewMs: config.clockSkewMs,
    allowSeen: true,
    parentIsValid: (parentRunId) => storedParentChainIsVerified(parentRunId, ledger, config, policy, publicKeys, seen),
  });
  return verification.valid && record.receipt.run_id === runId;
}

function runnerLimits(policy) {
  return {
    toolTimeoutMs: Number.isInteger(policy.runner_limits?.tool_timeout_ms)
      ? policy.runner_limits.tool_timeout_ms
      : DEFAULT_MCP_TOOL_TIMEOUT_MS,
    maxOutputTokens: Number.isInteger(policy.runner_limits?.max_output_tokens)
      ? policy.runner_limits.max_output_tokens
      : DEFAULT_MAX_OUTPUT_TOKENS,
    maxOutputTextChars: Number.isInteger(policy.runner_limits?.max_output_text_chars)
      ? policy.runner_limits.max_output_text_chars
      : DEFAULT_MAX_OUTPUT_TEXT_CHARS,
  };
}

function okResult(payload) {
  const structuredContent = redact(payload);
  return {
    isError: false,
    content: [{ type: "text", text: JSON.stringify(structuredContent, null, 2) }],
    structuredContent,
  };
}

function toolError(payload) {
  const structuredContent = redact(payload);
  return {
    isError: true,
    content: [{ type: "text", text: JSON.stringify(structuredContent, null, 2) }],
    structuredContent,
  };
}
