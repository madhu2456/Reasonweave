import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { RuntimeLedger } from "../lib/ledger.mjs";
import { generateKeyPairPem } from "../lib/receipt.mjs";
import { loadRoutingPolicy } from "../lib/config.mjs";
import {
  getRunMetadata,
  listRecentRuns,
  runVerifiedAgent,
  verifyReceipt as verifyReceiptTool,
} from "../lib/tools.mjs";

function tempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function baseArgs(overrides = {}) {
  return {
    logical_agent: "implementer",
    primary_task_type: "implement",
    risk_flags: [],
    platform_agent_type: "worker",
    intended_model: "gpt-5.3-codex",
    intended_reasoning: "medium",
    access: "A4",
    prompt: "Return a concise mock implementation note.",
    ...overrides,
  };
}

function configWithKeys() {
  const { publicKeyPem, privateKeyPem } = generateKeyPairPem();
  const dir = tempDir("reasonweave-provider-");
  const privateKeyPath = path.join(dir, "private.pem");
  const publicKeysPath = path.join(dir, "public.json");
  fs.writeFileSync(privateKeyPath, privateKeyPem, "utf8");
  fs.writeFileSync(publicKeysPath, JSON.stringify({ "test-key": { public_key_pem: publicKeyPem } }), "utf8");
  return {
    config: {
      openaiApiKey: "sk-test",
      receiptKeyId: "test-key",
      privateKeyPath,
      publicKeysPath,
      ledgerDir: path.join(dir, "ledger"),
      clockSkewMs: 300000,
    },
    privateKeyPem,
    publicKeyPem,
  };
}

function successfulProvider(responseOverrides = {}) {
  return async () => ({
    ok: true,
    headers: {
      "x-request-id": "req_test",
      "openai-processing-ms": "42",
    },
    response: {
      id: "resp_test",
      status: "completed",
      model: "gpt-5.3-codex",
      reasoning: { effort: "medium" },
      usage: { output_tokens_details: { reasoning_tokens: 10 } },
      output_text: "mock output",
      ...responseOverrides,
    },
  });
}

test("runVerifiedAgent returns receipt_verified only from actual matching metadata", async () => {
  const { config } = configWithKeys();
  const result = await runVerifiedAgent(baseArgs(), {
    config,
    ledger: new RuntimeLedger(config.ledgerDir),
    provider: successfulProvider(),
  });
  assert.equal(result.isError, false);
  assert.equal(result.structuredContent.execution_status, "receipt_verified");
  assert.equal(result.structuredContent.execution_model, "gpt-5.3-codex");
  assert.equal(result.structuredContent.execution_reasoning, "medium");
  assert.equal(result.structuredContent.provider_metadata.http_request_id, "req_test");
  assert.ok(result.structuredContent.receipt.receipt_signature);
});

test("runVerifiedAgent uses the policy receipt lifetime", async () => {
  const { config } = configWithKeys();
  const policy = JSON.parse(JSON.stringify(loadRoutingPolicy()));
  policy.runtime_receipt.max_lifetime_ms = 120000;
  const result = await runVerifiedAgent(baseArgs(), {
    config,
    policy,
    ledger: new RuntimeLedger(config.ledgerDir),
    provider: successfulProvider(),
  });
  const issuedAt = new Date(result.structuredContent.receipt.issued_at).getTime();
  const expiresAt = new Date(result.structuredContent.receipt.expires_at).getTime();
  assert.equal(expiresAt - issuedAt, 120000);
});

test("runVerifiedAgent passes policy runner defaults to the provider", async () => {
  const { config } = configWithKeys();
  const policy = JSON.parse(JSON.stringify(loadRoutingPolicy()));
  policy.runner_limits.tool_timeout_ms = 45000;
  policy.runner_limits.max_output_tokens = 1234;
  let capturedArgs;
  const result = await runVerifiedAgent(baseArgs(), {
    config,
    policy,
    ledger: new RuntimeLedger(config.ledgerDir),
    provider: async (args) => {
      capturedArgs = args;
      return successfulProvider()(args);
    },
  });
  assert.equal(result.isError, false);
  assert.equal(capturedArgs.timeout_ms, 45000);
  assert.equal(capturedArgs.max_output_tokens, 1234);
});

test("runVerifiedAgent blocks missing response model", async () => {
  const { config } = configWithKeys();
  const result = await runVerifiedAgent(baseArgs(), {
    config,
    ledger: new RuntimeLedger(config.ledgerDir),
    provider: successfulProvider({ model: undefined }),
  });
  assert.equal(result.isError, true);
  assert.equal(result.structuredContent.execution_status, "blocked_unverified");
  assert.equal(result.structuredContent.failure_state, "missing_runtime_metadata");
});

test("runVerifiedAgent blocks missing provider response id", async () => {
  const { config } = configWithKeys();
  const result = await runVerifiedAgent(baseArgs(), {
    config,
    ledger: new RuntimeLedger(config.ledgerDir),
    provider: successfulProvider({ id: undefined }),
  });
  assert.equal(result.isError, true);
  assert.equal(result.structuredContent.failure_state, "missing_runtime_metadata");
});

test("runVerifiedAgent blocks null response reasoning", async () => {
  const { config } = configWithKeys();
  const result = await runVerifiedAgent(baseArgs(), {
    config,
    ledger: new RuntimeLedger(config.ledgerDir),
    provider: successfulProvider({ reasoning: { effort: null } }),
  });
  assert.equal(result.isError, true);
  assert.equal(result.structuredContent.failure_state, "missing_runtime_metadata");
});

test("runVerifiedAgent blocks model and reasoning mismatch", async () => {
  const { config } = configWithKeys();
  const result = await runVerifiedAgent(baseArgs(), {
    config,
    ledger: new RuntimeLedger(config.ledgerDir),
    provider: successfulProvider({ model: "gpt-5.4", reasoning: { effort: "high" } }),
  });
  assert.equal(result.isError, true);
  assert.equal(result.structuredContent.model_match, false);
  assert.equal(result.structuredContent.reasoning_match, false);
});

test("runVerifiedAgent rejects a named sibling model as a version alias", async () => {
  const { config } = configWithKeys();
  const result = await runVerifiedAgent(baseArgs({
    logical_agent: "web-auditor",
    primary_task_type: "web-audit",
    platform_agent_type: "explorer",
    intended_model: "gpt-5.4",
    intended_reasoning: "high",
    access: "A3",
  }), {
    config,
    ledger: new RuntimeLedger(config.ledgerDir),
    provider: successfulProvider({ model: "gpt-5.4-mini", reasoning: { effort: "high" } }),
  });
  assert.equal(result.isError, true);
  assert.equal(result.structuredContent.model_match, false);
  assert.equal(result.structuredContent.failure_state, "model_mismatch");
});

test("runVerifiedAgent rejects unauthorized routing before provider dispatch", async () => {
  const { config } = configWithKeys();
  let providerCalled = false;
  const result = await runVerifiedAgent(baseArgs({ access: "A5" }), {
    config,
    ledger: new RuntimeLedger(config.ledgerDir),
    provider: async () => {
      providerCalled = true;
      return successfulProvider()();
    },
  });
  assert.equal(providerCalled, false);
  assert.equal(result.isError, true);
  assert.equal(result.structuredContent.failure_state, "route_not_authorized");
});

test("runVerifiedAgent rejects an agent that is outside the declared task route", async () => {
  const { config } = configWithKeys();
  let providerCalled = false;
  const result = await runVerifiedAgent(baseArgs({ primary_task_type: "web-build" }), {
    config,
    ledger: new RuntimeLedger(config.ledgerDir),
    provider: async () => {
      providerCalled = true;
      return successfulProvider()();
    },
  });
  assert.equal(providerCalled, false);
  assert.equal(result.structuredContent.failure_state, "route_not_authorized");
});

test("runVerifiedAgent rejects an unknown task type even for the router", async () => {
  const { config } = configWithKeys();
  let providerCalled = false;
  const result = await runVerifiedAgent(baseArgs({
    logical_agent: "router",
    primary_task_type: "invented-task",
    platform_agent_type: "default",
    intended_model: "gpt-5.5",
    access: "A1",
  }), {
    config,
    ledger: new RuntimeLedger(config.ledgerDir),
    provider: async () => {
      providerCalled = true;
      return successfulProvider()();
    },
  });
  assert.equal(providerCalled, false);
  assert.equal(result.structuredContent.failure_state, "route_not_authorized");
});

test("runVerifiedAgent requires escalation for declared sensitive risk", async () => {
  const { config } = configWithKeys();
  let providerCalled = false;
  const result = await runVerifiedAgent(baseArgs({ risk_flags: ["security"] }), {
    config,
    ledger: new RuntimeLedger(config.ledgerDir),
    provider: async () => {
      providerCalled = true;
      return successfulProvider()();
    },
  });
  assert.equal(providerCalled, false);
  assert.equal(result.structuredContent.failure_state, "route_not_authorized");
});

test("runVerifiedAgent accepts an authorized sensitive escalation", async () => {
  const { config } = configWithKeys();
  const result = await runVerifiedAgent(baseArgs({
    risk_flags: ["security"],
    intended_model: "gpt-5.5",
    intended_reasoning: "high",
  }), {
    config,
    ledger: new RuntimeLedger(config.ledgerDir),
    provider: successfulProvider({ model: "gpt-5.5", reasoning: { effort: "high" } }),
  });
  assert.equal(result.isError, false);
  assert.deepEqual(result.structuredContent.receipt.risk_flags, ["security"]);
});

test("runVerifiedAgent never exposes or stores output text for a sensitive prompt", async () => {
  const { config } = configWithKeys();
  const ledger = new RuntimeLedger(config.ledgerDir);
  const result = await runVerifiedAgent(baseArgs({ sensitive_prompt: true }), {
    config,
    ledger,
    provider: successfulProvider({ output_text: "customer address is confidential-value" }),
  });
  assert.equal(result.isError, false);
  assert.equal(result.structuredContent.output_text, "[REDACTED: sensitive output]");
  assert.equal(fs.readFileSync(ledger.runsPath, "utf8").includes("confidential-value"), false);
});

test("runVerifiedAgent rejects non-boolean sensitive_prompt before provider dispatch", async () => {
  const { config } = configWithKeys();
  let providerCalled = false;
  const result = await runVerifiedAgent(baseArgs({ sensitive_prompt: "true" }), {
    config,
    ledger: new RuntimeLedger(config.ledgerDir),
    provider: async () => {
      providerCalled = true;
      return successfulProvider()();
    },
  });
  assert.equal(providerCalled, false);
  assert.equal(result.isError, true);
  assert.equal(result.structuredContent.failure_state, "invalid_request");
  assert.ok(result.structuredContent.block_reason.includes("sensitive_prompt must be a boolean"));
});

test("runVerifiedAgent truncates excessive output before returning or persisting it", async () => {
  const { config } = configWithKeys();
  const ledger = new RuntimeLedger(config.ledgerDir);
  const result = await runVerifiedAgent(baseArgs(), {
    config,
    ledger,
    provider: successfulProvider({ output_text: "x".repeat(100001) }),
  });
  assert.equal(result.isError, false);
  assert.equal(result.structuredContent.output_truncated, true);
  assert.equal(result.structuredContent.output_text.length, 100000);
  assert.equal(JSON.parse(fs.readFileSync(ledger.runsPath, "utf8").trim()).output_text.length, 100000);
});

test("runVerifiedAgent tolerates malformed provider output containers without throwing", async () => {
  const { config } = configWithKeys();
  const result = await runVerifiedAgent(baseArgs(), {
    config,
    ledger: new RuntimeLedger(config.ledgerDir),
    provider: successfulProvider({ output_text: undefined, output: { content: "not-an-array" } }),
  });
  assert.equal(result.isError, false);
  assert.equal(result.structuredContent.execution_status, "receipt_verified");
  assert.equal(result.structuredContent.output_text, "");
});

test("runVerifiedAgent rejects timeouts that exceed the MCP tool timeout before dispatch", async () => {
  const { config } = configWithKeys();
  let providerCalled = false;
  const result = await runVerifiedAgent(baseArgs({ timeout_ms: 120001 }), {
    config,
    ledger: new RuntimeLedger(config.ledgerDir),
    provider: async () => {
      providerCalled = true;
      return successfulProvider()();
    },
  });
  assert.equal(providerCalled, false);
  assert.equal(result.structuredContent.failure_state, "invalid_request");
});

test("runVerifiedAgent rejects output limits beyond the local persistence bound before dispatch", async () => {
  const { config } = configWithKeys();
  let providerCalled = false;
  const result = await runVerifiedAgent(baseArgs({ max_output_tokens: 32769 }), {
    config,
    ledger: new RuntimeLedger(config.ledgerDir),
    provider: async () => {
      providerCalled = true;
      return successfulProvider()();
    },
  });
  assert.equal(providerCalled, false);
  assert.equal(result.structuredContent.failure_state, "invalid_request");
});

test("runVerifiedAgent generates protected request identifiers internally", async () => {
  const { config } = configWithKeys();
  let providerCalled = false;
  const result = await runVerifiedAgent(baseArgs({ run_id: "caller-run", client_request_id: "caller-request" }), {
    config,
    ledger: new RuntimeLedger(config.ledgerDir),
    provider: async () => {
      providerCalled = true;
      return successfulProvider()();
    },
  });
  assert.equal(providerCalled, false);
  assert.equal(result.isError, true);
  assert.equal(result.structuredContent.failure_state, "invalid_request");
});

test("runVerifiedAgent blocks an unverified parent before provider dispatch", async () => {
  const { config } = configWithKeys();
  const ledger = new RuntimeLedger(config.ledgerDir);
  ledger.appendRun({ run_id: "blocked-parent", decision: "block", receipt_valid: false });
  let providerCalled = false;
  const result = await runVerifiedAgent(baseArgs({ parent_run_id: "blocked-parent" }), {
    config,
    ledger,
    provider: async () => {
      providerCalled = true;
      return successfulProvider()();
    },
  });
  assert.equal(providerCalled, false);
  assert.equal(result.isError, true);
  assert.equal(result.structuredContent.failure_state, "parent_child_chain_mismatch");
});

test("runVerifiedAgent blocks parent-chain ledger read errors before provider dispatch", async () => {
  const { config } = configWithKeys();
  let providerCalled = false;
  const ledger = {
    getRun() {
      throw new Error("read denied");
    },
    appendRun() {},
  };
  const result = await runVerifiedAgent(baseArgs({ parent_run_id: "parent-run" }), {
    config,
    ledger,
    provider: async () => {
      providerCalled = true;
      return successfulProvider()();
    },
  });
  assert.equal(providerCalled, false);
  assert.equal(result.isError, true);
  assert.equal(result.structuredContent.failure_state, "parent_child_chain_mismatch");
});

test("runVerifiedAgent accepts a child only after re-verifying a signed parent chain", async () => {
  const { config } = configWithKeys();
  const ledger = new RuntimeLedger(config.ledgerDir);
  const parent = await runVerifiedAgent(baseArgs(), { config, ledger, provider: successfulProvider() });
  const child = await runVerifiedAgent(baseArgs({ parent_run_id: parent.structuredContent.run_id }), {
    config,
    ledger,
    provider: successfulProvider(),
  });
  assert.equal(child.isError, false);
  assert.equal(child.structuredContent.receipt.parent_run_id, parent.structuredContent.run_id);
});

test("runVerifiedAgent rejects a child when a stored parent receipt is tampered", async () => {
  const { config } = configWithKeys();
  const ledger = new RuntimeLedger(config.ledgerDir);
  const parent = await runVerifiedAgent(baseArgs(), { config, ledger, provider: successfulProvider() });
  const row = JSON.parse(fs.readFileSync(ledger.runsPath, "utf8").trim());
  row.receipt.execution_model = "gpt-5.5";
  fs.writeFileSync(ledger.runsPath, `${JSON.stringify(row)}\n`, "utf8");
  let providerCalled = false;
  const child = await runVerifiedAgent(baseArgs({ parent_run_id: parent.structuredContent.run_id }), {
    config,
    ledger,
    provider: async () => {
      providerCalled = true;
      return successfulProvider()();
    },
  });
  assert.equal(providerCalled, false);
  assert.equal(child.isError, true);
  assert.equal(child.structuredContent.failure_state, "parent_child_chain_mismatch");
});

test("runVerifiedAgent reports provider failure without a receipt", async () => {
  const { config } = configWithKeys();
  const result = await runVerifiedAgent(baseArgs(), {
    config,
    ledger: new RuntimeLedger(config.ledgerDir),
    provider: async () => ({
      ok: false,
      failure_state: "rate_limited",
      error: "rate limited",
      headers: { "x-request-id": "req_rate" },
      response: null,
    }),
  });
  assert.equal(result.isError, true);
  assert.equal(result.structuredContent.execution_status, "failed");
  assert.equal(result.structuredContent.failure_state, "rate_limited");
  assert.equal(result.structuredContent.receipt_valid, false);
});

test("runVerifiedAgent never signs an explicit provider refusal", async () => {
  const { config } = configWithKeys();
  const result = await runVerifiedAgent(baseArgs(), {
    config,
    ledger: new RuntimeLedger(config.ledgerDir),
    provider: successfulProvider({
      output: [{ content: [{ type: "refusal", refusal: "Cannot comply." }] }],
    }),
  });
  assert.equal(result.isError, true);
  assert.equal(result.structuredContent.execution_status, "failed");
  assert.equal(result.structuredContent.failure_state, "provider_refusal");
  assert.equal(result.structuredContent.receipt_valid, false);
  assert.equal("receipt" in result.structuredContent, false);
});

test("runVerifiedAgent fails closed without signing key", async () => {
  const dir = tempDir("reasonweave-nosign-");
  const result = await runVerifiedAgent(baseArgs(), {
    config: {
      openaiApiKey: "sk-test",
      receiptKeyId: "missing",
      privateKeyPath: path.join(dir, "missing.pem"),
      publicKeysPath: path.join(dir, "public.json"),
      ledgerDir: path.join(dir, "ledger"),
      clockSkewMs: 300000,
    },
    ledger: new RuntimeLedger(path.join(dir, "ledger")),
    provider: successfulProvider(),
  });
  assert.equal(result.isError, true);
  assert.equal(result.structuredContent.failure_state, "missing_signing_key");
});

test("issued receipts remain inspectable while replay enforcement blocks reuse", async () => {
  const { config } = configWithKeys();
  const ledger = new RuntimeLedger(config.ledgerDir);
  const result = await runVerifiedAgent(baseArgs(), {
    config,
    ledger,
    provider: successfulProvider(),
  });
  const inspection = verifyReceiptTool({ receipt: result.structuredContent.receipt }, { config, ledger });
  assert.equal(inspection.isError, false);
  assert.equal(inspection.structuredContent.replay_check_applied, false);

  const reuse = verifyReceiptTool({ receipt: result.structuredContent.receipt, enforce_replay: true }, { config, ledger });
  assert.equal(reuse.isError, true);
  assert.ok(reuse.structuredContent.errors.includes("replayed_run_id_nonce"));
});

test("verified response fails closed when its ledger record cannot be persisted", async () => {
  const { config } = configWithKeys();
  const ledger = {
    appendRun() {
      throw new Error("disk full");
    },
  };
  const result = await runVerifiedAgent(baseArgs(), {
    config,
    ledger,
    provider: successfulProvider(),
  });
  assert.equal(result.isError, true);
  assert.equal(result.structuredContent.execution_status, "failed");
  assert.equal(result.structuredContent.failure_state, "ledger_write_failure");
  assert.equal(result.structuredContent.receipt_valid, false);
});

test("verified response fails closed when corrupt ledger history prevents replay proof", async () => {
  const { config } = configWithKeys();
  const ledger = new RuntimeLedger(config.ledgerDir);
  ledger.ensureDir();
  fs.writeFileSync(ledger.runsPath, "{not-json}\n", "utf8");
  let providerCalled = false;
  const result = await runVerifiedAgent(baseArgs(), {
    config,
    ledger,
    provider: async () => {
      providerCalled = true;
      return successfulProvider()();
    },
  });
  assert.equal(providerCalled, false);
  assert.equal(result.isError, true);
  assert.equal(result.structuredContent.failure_state, "ledger_integrity_failure");
  assert.equal(result.structuredContent.receipt_valid, false);
});

test("receipt replay enforcement fails closed when ledger history is corrupt", async () => {
  const { config } = configWithKeys();
  const ledger = new RuntimeLedger(config.ledgerDir);
  const issued = await runVerifiedAgent(baseArgs(), {
    config,
    ledger,
    provider: successfulProvider(),
  });
  fs.appendFileSync(ledger.runsPath, "{not-json}\n", "utf8");
  const result = verifyReceiptTool({ receipt: issued.structuredContent.receipt, enforce_replay: true }, { config, ledger });
  assert.equal(result.isError, true);
  assert.equal(result.structuredContent.failure_state, "ledger_integrity_failure");
});

test("metadata lookup tools return structured ledger read failures", () => {
  const ledger = {
    getRun() {
      throw new Error("read denied");
    },
    listRuns() {
      throw new Error("read denied");
    },
  };
  const config = { ledgerDir: "__unused__" };
  const lookup = getRunMetadata({ run_id: "run-missing" }, { config, ledger });
  const recent = listRecentRuns({}, { config, ledger });
  assert.equal(lookup.isError, true);
  assert.equal(lookup.structuredContent.failure_state, "ledger_read_failure");
  assert.equal(recent.isError, true);
  assert.equal(recent.structuredContent.failure_state, "ledger_read_failure");
});
