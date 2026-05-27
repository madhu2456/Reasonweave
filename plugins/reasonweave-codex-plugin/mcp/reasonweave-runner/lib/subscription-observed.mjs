import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { allowedReasoning, isAllowedModel, loadRoutingPolicy } from "./config.mjs";

const CONFIG_FIELDS = ["model", "model_reasoning_effort"];

export function observeSubscriptionMetadata(_args = {}, deps = {}) {
  const policy = deps.policy || loadRoutingPolicy();
  const env = deps.env || process.env;
  const fsImpl = deps.fs || fs;
  const configPath = firstExisting(codexConfigCandidates(env), fsImpl);

  if (!configPath) {
    return {
      ok: false,
      payload: blockedObservation({
        failure_state: "codex_config_missing",
        block_reason: "Codex config was not found; subscription model configuration cannot be observed.",
      }),
    };
  }

  let parsedConfig;
  try {
    parsedConfig = parseRootTomlStringFields(fsImpl.readFileSync(configPath, "utf8"), CONFIG_FIELDS);
  } catch (error) {
    return {
      ok: false,
      payload: blockedObservation({
        codex_config_path: configPath,
        failure_state: "codex_config_invalid",
        block_reason: `Codex config could not be parsed safely: ${error.message}`,
      }),
    };
  }

  const configuredModel = parsedConfig.model || "none";
  const configuredReasoning = parsedConfig.model_reasoning_effort || "none";
  const modelAllowed = isAllowedModel(policy, configuredModel);
  const reasoningAllowed = allowedReasoning(policy).includes(configuredReasoning);
  const validationErrors = [];

  if (configuredModel === "none") {
    validationErrors.push("configured_model is missing");
  } else if (!modelAllowed) {
    validationErrors.push("configured_model is not in the ReasonWeave allowlist");
  }

  if (configuredReasoning === "none") {
    validationErrors.push("configured_reasoning is missing");
  } else if (!reasoningAllowed) {
    validationErrors.push("configured_reasoning is not in the ReasonWeave allowlist");
  }

  const authObservation = observeAuthMode(env, fsImpl);
  if (validationErrors.length > 0) {
    return {
      ok: false,
      payload: blockedObservation({
        codex_config_path: configPath,
        configured_model: configuredModel,
        configured_reasoning: configuredReasoning,
        auth_mode: authObservation.auth_mode,
        openai_api_key_present: authObservation.openai_api_key_present,
        codex_auth_observed: authObservation.codex_auth_observed,
        codex_auth_error: authObservation.codex_auth_error,
        model_allowed: modelAllowed,
        reasoning_allowed: reasoningAllowed,
        validation_errors: validationErrors,
        failure_state: "codex_config_invalid",
        block_reason: "Codex config does not contain an allowed ReasonWeave model and reasoning combination.",
      }),
    };
  }
  return {
    ok: true,
    payload: blockedObservation({
      codex_config_path: configPath,
      configured_model: configuredModel,
      configured_reasoning: configuredReasoning,
      auth_mode: authObservation.auth_mode,
      openai_api_key_present: authObservation.openai_api_key_present,
      codex_auth_observed: authObservation.codex_auth_observed,
      codex_auth_error: authObservation.codex_auth_error,
      model_allowed: modelAllowed,
      reasoning_allowed: reasoningAllowed,
      validation_errors: validationErrors,
      failure_state: "subscription_metadata_untrusted",
      block_reason: "Subscription Codex configuration is observed configuration, not trusted runtime execution metadata.",
    }),
  };
}

export function codexConfigCandidates(env = process.env) {
  if (env.REASONWEAVE_CODEX_CONFIG_PATH) {
    return uniquePaths([env.REASONWEAVE_CODEX_CONFIG_PATH]);
  }
  return uniquePaths([
    env.CODEX_HOME ? path.join(env.CODEX_HOME, "config.toml") : "",
    env.USERPROFILE ? path.join(env.USERPROFILE, ".codex", "config.toml") : "",
    env.HOME ? path.join(env.HOME, ".codex", "config.toml") : "",
    path.join(os.homedir(), ".codex", "config.toml"),
  ]);
}

export function codexAuthCandidates(env = process.env) {
  if (env.REASONWEAVE_CODEX_AUTH_PATH) {
    return uniquePaths([env.REASONWEAVE_CODEX_AUTH_PATH]);
  }
  return uniquePaths([
    env.CODEX_HOME ? path.join(env.CODEX_HOME, "auth.json") : "",
    env.USERPROFILE ? path.join(env.USERPROFILE, ".codex", "auth.json") : "",
    env.HOME ? path.join(env.HOME, ".codex", "auth.json") : "",
    path.join(os.homedir(), ".codex", "auth.json"),
  ]);
}

export function parseRootTomlStringFields(text, fields = CONFIG_FIELDS) {
  const allowedFields = new Set(fields);
  const parsed = {};
  let inRootTable = true;
  for (const [index, rawLine] of String(text).split(/\r?\n/).entries()) {
    const line = stripTomlComment(rawLine).trim();
    if (!line) continue;
    if (/^\[\[?.+\]\]?$/.test(line)) {
      inRootTable = false;
      continue;
    }
    if (!inRootTable) continue;

    const match = /^([A-Za-z0-9_.-]+)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;

    const [, key, rawValue] = match;
    if (!allowedFields.has(key)) continue;
    parsed[key] = parseTomlStringValue(rawValue, key, index + 1);
  }
  return parsed;
}

function observeAuthMode(env, fsImpl) {
  const authPath = firstExisting(codexAuthCandidates(env), fsImpl);
  if (!authPath) {
    return {
      auth_mode: "unknown",
      openai_api_key_present: false,
      codex_auth_observed: false,
      codex_auth_error: null,
    };
  }

  try {
    const auth = JSON.parse(fsImpl.readFileSync(authPath, "utf8"));
    return {
      auth_mode: typeof auth.auth_mode === "string" ? auth.auth_mode : "unknown",
      openai_api_key_present: typeof auth.OPENAI_API_KEY === "string" && auth.OPENAI_API_KEY.length > 0,
      codex_auth_observed: true,
      codex_auth_error: null,
    };
  } catch {
    return {
      auth_mode: "unknown",
      openai_api_key_present: false,
      codex_auth_observed: false,
      codex_auth_error: "codex_auth_invalid",
    };
  }
}

function blockedObservation(overrides = {}) {
  return {
    metadata_version: "1",
    observation_source: "codex_subscription_config",
    configured_model: "none",
    configured_reasoning: "none",
    auth_mode: "unknown",
    openai_api_key_present: false,
    model_allowed: false,
    reasoning_allowed: false,
    validation_errors: [],
    trusted_runtime_proof: false,
    intended_model: overrides.configured_model || "none",
    intended_reasoning: overrides.configured_reasoning || "none",
    execution_model: "none",
    resolved_model: "none",
    execution_reasoning: "none",
    execution_status: "blocked_unverified",
    model_match: false,
    reasoning_match: "unknown",
    receipt_valid: false,
    dispatch_authorized: false,
    verification_source: "none",
    decision: "block",
    failure_state: "subscription_metadata_untrusted",
    block_reason: "Subscription Codex configuration is not trusted runtime execution metadata.",
    ...overrides,
    intended_model: overrides.configured_model || overrides.intended_model || "none",
    intended_reasoning: overrides.configured_reasoning || overrides.intended_reasoning || "none",
  };
}

function firstExisting(candidates, fsImpl) {
  for (const candidate of candidates) {
    try {
      if (candidate && fsImpl.existsSync(candidate)) return candidate;
    } catch {
      // Ignore unreadable candidate paths; they are not usable observations.
    }
  }
  return null;
}

function uniquePaths(paths) {
  const seen = new Set();
  const output = [];
  for (const item of paths) {
    if (!item) continue;
    const resolved = path.resolve(item);
    if (seen.has(resolved)) continue;
    seen.add(resolved);
    output.push(resolved);
  }
  return output;
}

function parseTomlStringValue(rawValue, key, lineNumber) {
  const value = rawValue.trim();
  if (!value) {
    throw new Error(`${key} on line ${lineNumber} must be a string`);
  }
  if (value.startsWith('"') && value.endsWith('"')) {
    try {
      return JSON.parse(value);
    } catch {
      throw new Error(`${key} on line ${lineNumber} contains an invalid string`);
    }
  }
  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1);
  }
  throw new Error(`${key} on line ${lineNumber} must be a string`);
}

function stripTomlComment(line) {
  let inBasicString = false;
  let inLiteralString = false;
  let escaped = false;

  for (let index = 0; index < line.length; index++) {
    const char = line[index];
    if (inBasicString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inBasicString = false;
      }
      continue;
    }
    if (inLiteralString) {
      if (char === "'") inLiteralString = false;
      continue;
    }
    if (char === '"') {
      inBasicString = true;
      continue;
    }
    if (char === "'") {
      inLiteralString = true;
      continue;
    }
    if (char === "#") {
      return line.slice(0, index);
    }
  }

  return line;
}
