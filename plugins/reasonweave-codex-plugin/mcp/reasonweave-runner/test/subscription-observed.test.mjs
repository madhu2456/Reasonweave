import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { callTool, toolDefinitions } from "../lib/tools.mjs";

function tempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeCodexFiles({ configText, authObject = null }) {
  const dir = tempDir("reasonweave-subscription-");
  const configPath = path.join(dir, "config.toml");
  const authPath = path.join(dir, "auth.json");
  if (configText !== null) {
    fs.writeFileSync(configPath, configText, "utf8");
  }
  if (authObject !== null) {
    fs.writeFileSync(authPath, JSON.stringify(authObject), "utf8");
  }
  return { dir, configPath, authPath };
}

test("tool list exposes subscription-observed metadata lookup", () => {
  const names = toolDefinitions.map((tool) => tool.name);
  assert.ok(names.includes("reasonweave.get_subscription_observed_metadata"));
});

test("runtime capabilities expose API strict output and clean subscription advisory output", async () => {
  const result = await callTool("reasonweave.get_runtime_capabilities", {}, {
    config: {
      openaiApiKey: "",
      privateKeyPath: "__missing_private_key__",
      publicKeysPath: "__missing_public_keys__",
      receiptKeyId: "test",
      ledgerDir: "__missing_ledger__",
    },
  });

  assert.equal(result.isError, false);
  assert.ok(result.structuredContent.execution_surfaces.includes("api"));
  assert.ok(result.structuredContent.execution_surfaces.includes("codex_subscription"));
  assert.equal(result.structuredContent.user_facing_output_policy.api.report_execution_status, true);
  assert.equal(result.structuredContent.user_facing_output_policy.codex_subscription.report_execution_status, false);
  assert.ok(result.structuredContent.user_facing_output_policy.codex_subscription.route_format.includes("mode=codex_subscription"));
  assert.ok(result.structuredContent.user_facing_output_policy.codex_subscription.suppressed_user_facing_fields.includes("execution_status"));
  assert.equal(result.structuredContent.runner_limits.require_provider_response_id, true);
  assert.equal(result.structuredContent.runner_limits.max_output_text_chars, 100000);
  assert.equal(result.structuredContent.planner_two_pass_policy.enabled, true);
  assert.equal(result.structuredContent.planner_two_pass_policy.planner_pass.reasoning_effort, "high");
  assert.equal(result.structuredContent.planner_two_pass_policy.execution_detail_pass.reasoning_effort, "xhigh");
  assert.equal(result.structuredContent.planner_two_pass_policy.execution_detail_pass.api_parent_child_receipt_required, true);
});

test("runtime capabilities tolerate partial config objects", async () => {
  const result = await callTool("reasonweave.get_runtime_capabilities", {}, {
    config: {
      openaiApiKey: "",
      receiptKeyId: "test",
      ledgerDir: "__missing_ledger__",
    },
  });

  assert.equal(result.isError, false);
  assert.equal(result.structuredContent.receipt_private_key_present, false);
  assert.equal(result.structuredContent.receipt_public_keys_present, 0);
});

test("subscription observation reports configured model without treating it as trusted proof", async () => {
  const { configPath, authPath } = writeCodexFiles({
    configText: 'model = "gpt-5.5"\nmodel_reasoning_effort = "xhigh"\n',
    authObject: {
      auth_mode: "chatgpt",
      OPENAI_API_KEY: null,
      tokens: {
        access_token: "secret-access-token",
        refresh_token: "secret-refresh-token",
      },
    },
  });

  const result = await callTool("reasonweave.get_subscription_observed_metadata", {}, {
    env: {
      REASONWEAVE_CODEX_CONFIG_PATH: configPath,
      REASONWEAVE_CODEX_AUTH_PATH: authPath,
    },
  });

  assert.equal(result.isError, false);
  assert.equal(result.structuredContent.configured_model, "gpt-5.5");
  assert.equal(result.structuredContent.configured_reasoning, "xhigh");
  assert.equal(result.structuredContent.auth_mode, "chatgpt");
  assert.equal(result.structuredContent.openai_api_key_present, false);
  assert.equal(result.structuredContent.model_allowed, true);
  assert.equal(result.structuredContent.reasoning_allowed, true);
  assert.equal(result.structuredContent.trusted_runtime_proof, false);
  assert.equal(result.structuredContent.execution_status, "blocked_unverified");
  assert.equal(result.structuredContent.verification_source, "none");
  assert.equal(result.structuredContent.failure_state, "subscription_metadata_untrusted");
  assert.equal(result.structuredContent.decision, "block");
  assert.equal(JSON.stringify(result.structuredContent).includes("secret-refresh-token"), false);
});

test("subscription observation rejects broad configured model aliases", async () => {
  const { configPath } = writeCodexFiles({
    configText: 'model = "gpt-5"\nmodel_reasoning_effort = "high"\n',
  });

  const result = await callTool("reasonweave.get_subscription_observed_metadata", {}, {
    env: { REASONWEAVE_CODEX_CONFIG_PATH: configPath },
  });

  assert.equal(result.isError, true);
  assert.equal(result.structuredContent.configured_model, "gpt-5");
  assert.equal(result.structuredContent.model_allowed, false);
  assert.ok(result.structuredContent.validation_errors.includes("configured_model is not in the ReasonWeave allowlist"));
  assert.equal(result.structuredContent.execution_status, "blocked_unverified");
  assert.equal(result.structuredContent.failure_state, "codex_config_invalid");
  assert.equal(result.structuredContent.decision, "block");
});

test("subscription observation reads only root TOML model settings", async () => {
  const { configPath } = writeCodexFiles({
    configText: 'model = "gpt-5.5"\nmodel_reasoning_effort = "high"\n[plugins.example]\nmodel = "gpt-5"\nmodel_reasoning_effort = "low"\n',
  });

  const result = await callTool("reasonweave.get_subscription_observed_metadata", {}, {
    env: { REASONWEAVE_CODEX_CONFIG_PATH: configPath },
  });

  assert.equal(result.isError, false);
  assert.equal(result.structuredContent.configured_model, "gpt-5.5");
  assert.equal(result.structuredContent.configured_reasoning, "high");
});

test("subscription observation fails closed when Codex config is missing", async () => {
  const { configPath } = writeCodexFiles({ configText: null });

  const result = await callTool("reasonweave.get_subscription_observed_metadata", {}, {
    env: { REASONWEAVE_CODEX_CONFIG_PATH: configPath },
  });

  assert.equal(result.isError, true);
  assert.equal(result.structuredContent.failure_state, "codex_config_missing");
  assert.equal(result.structuredContent.execution_status, "blocked_unverified");
  assert.equal(result.structuredContent.trusted_runtime_proof, false);
});

test("subscription observation fails closed when Codex config values are invalid", async () => {
  const { configPath } = writeCodexFiles({
    configText: 'model = "gpt-5.5"\nmodel_reasoning_effort = \n',
  });

  const result = await callTool("reasonweave.get_subscription_observed_metadata", {}, {
    env: { REASONWEAVE_CODEX_CONFIG_PATH: configPath },
  });

  assert.equal(result.isError, true);
  assert.equal(result.structuredContent.failure_state, "codex_config_invalid");
  assert.equal(result.structuredContent.execution_status, "blocked_unverified");
  assert.equal(result.structuredContent.decision, "block");
});
