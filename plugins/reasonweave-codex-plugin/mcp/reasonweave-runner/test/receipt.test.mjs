import assert from "node:assert/strict";
import test from "node:test";
import {
  computeReceiptHash,
  generateKeyPairPem,
  signReceipt,
  verifyReceipt,
} from "../lib/receipt.mjs";
import { loadRoutingPolicy, modelAliasMatches, reasoningMatches } from "../lib/config.mjs";

function baseReceipt(overrides = {}) {
  const issuedAt = new Date();
  return {
    receipt_version: "1",
    run_id: "run-receipt-test",
    nonce: "nonce-receipt-test",
    delegated_agent_id: "agent-receipt-test",
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
    key_id: "test-key",
    ...overrides,
  };
}

test("signs and verifies a valid receipt", () => {
  const { publicKeyPem, privateKeyPem } = generateKeyPairPem();
  const receipt = signReceipt(baseReceipt(), privateKeyPem);
  const result = verifyReceipt(receipt, { "test-key": publicKeyPem });
  assert.equal(result.valid, true);
  assert.equal(receipt.receipt_hash, computeReceiptHash(receipt));
});

test("rejects tampered receipt content", () => {
  const { publicKeyPem, privateKeyPem } = generateKeyPairPem();
  const receipt = signReceipt(baseReceipt(), privateKeyPem);
  receipt.execution_model = "gpt-5.4";
  const result = verifyReceipt(receipt, { "test-key": publicKeyPem });
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes("invalid_hash"));
});

test("rejects unknown public key id", () => {
  const { privateKeyPem } = generateKeyPairPem();
  const receipt = signReceipt(baseReceipt(), privateKeyPem);
  const result = verifyReceipt(receipt, {});
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes("missing_public_key"));
});

test("rejects expired and replayed receipts", () => {
  const { publicKeyPem, privateKeyPem } = generateKeyPairPem();
  const receipt = signReceipt(baseReceipt({
    expires_at: new Date(Date.now() - 1200000).toISOString(),
  }), privateKeyPem);
  const result = verifyReceipt(receipt, { "test-key": publicKeyPem }, {
    seenReplayKeys: new Set(["run-receipt-test:nonce-receipt-test"]),
    clockSkewMs: 0,
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes("expired"));
  assert.ok(result.errors.includes("replayed_run_id_nonce"));
});

test("rejects reversed and overlong receipt lifetimes", () => {
  const { publicKeyPem, privateKeyPem } = generateKeyPairPem();
  const issuedAt = new Date();
  const reversed = signReceipt(baseReceipt({
    issued_at: issuedAt.toISOString(),
    expires_at: new Date(issuedAt.getTime() - 1).toISOString(),
  }), privateKeyPem);
  const overlong = signReceipt(baseReceipt({
    issued_at: issuedAt.toISOString(),
    expires_at: new Date(issuedAt.getTime() + 600001).toISOString(),
  }), privateKeyPem);
  assert.ok(verifyReceipt(reversed, { "test-key": publicKeyPem }).errors.includes("invalid_receipt_lifetime"));
  assert.ok(verifyReceipt(overlong, { "test-key": publicKeyPem }).errors.includes("receipt_lifetime_exceeded"));
});

test("rejects malformed required receipt identifiers even when signed", () => {
  const { publicKeyPem, privateKeyPem } = generateKeyPairPem();
  const receipt = signReceipt(baseReceipt({ run_id: "", nonce: "" }), privateKeyPem);
  const result = verifyReceipt(receipt, { "test-key": publicKeyPem });
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes("invalid_run_id"));
  assert.ok(result.errors.includes("invalid_nonce"));
});

test("model aliases are explicit and reasoning matches exactly", () => {
  const policy = loadRoutingPolicy();
  assert.equal(modelAliasMatches(policy, "gpt-5.5", "gpt-5.5-2026-04-23"), true);
  assert.equal(modelAliasMatches(policy, "gpt-5.5", "gpt-5"), false);
  assert.equal(modelAliasMatches(policy, "gpt-5.4", "gpt-5.4-mini"), false);
  assert.equal(modelAliasMatches(policy, "gpt-5.4-mini", "gpt-5.4-mini-2026-05-27"), true);
  assert.equal(modelAliasMatches(policy, "gpt-5.3-codex", "gpt-5.3-codex"), true);
  assert.equal(reasoningMatches("high", "high"), true);
  assert.equal(reasoningMatches("high", "xhigh"), false);
});

test("rejects a signed receipt whose asserted model match hides a sibling-family downgrade", () => {
  const { publicKeyPem, privateKeyPem } = generateKeyPairPem();
  const receipt = signReceipt(baseReceipt({
    logical_agent: "web-auditor",
    primary_task_type: "web-audit",
    risk_flags: [],
    platform_agent_type: "explorer",
    access: "A3",
    intended_model: "gpt-5.4",
    resolved_model: "gpt-5.4-mini",
    execution_model: "gpt-5.4-mini",
    intended_reasoning: "high",
    execution_reasoning: "high",
    model_match: true,
  }), privateKeyPem);
  const result = verifyReceipt(receipt, { "test-key": publicKeyPem });
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes("model_mismatch"));
});

test("rejects a signed receipt whose model and reasoning are not authorized for its logical agent", () => {
  const { publicKeyPem, privateKeyPem } = generateKeyPairPem();
  const receipt = signReceipt(baseReceipt({
    logical_agent: "implementer",
    primary_task_type: "implement",
    access: "A4",
    intended_model: "gpt-5.4",
    resolved_model: "gpt-5.4",
    execution_model: "gpt-5.4",
    intended_reasoning: "medium",
    execution_reasoning: "medium",
  }), privateKeyPem);
  const result = verifyReceipt(receipt, { "test-key": publicKeyPem });
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes("route_not_authorized"));
});

test("rejects a signed router receipt for an undeclared task type", () => {
  const { publicKeyPem, privateKeyPem } = generateKeyPairPem();
  const receipt = signReceipt(baseReceipt({
    logical_agent: "router",
    primary_task_type: "invented-task",
    platform_agent_type: "default",
    access: "A1",
    intended_model: "gpt-5.5",
    resolved_model: "gpt-5.5",
    execution_model: "gpt-5.5",
    intended_reasoning: "medium",
    execution_reasoning: "medium",
  }), privateKeyPem);
  const result = verifyReceipt(receipt, { "test-key": publicKeyPem });
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes("route_not_authorized"));
});

test("rejects a signed non-escalated receipt with a declared sensitive risk", () => {
  const { publicKeyPem, privateKeyPem } = generateKeyPairPem();
  const receipt = signReceipt(baseReceipt({
    logical_agent: "implementer",
    primary_task_type: "implement",
    access: "A4",
    risk_flags: ["security"],
  }), privateKeyPem);
  const result = verifyReceipt(receipt, { "test-key": publicKeyPem });
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes("route_not_authorized"));
});

test("requires parent verification context for child receipts", () => {
  const { publicKeyPem, privateKeyPem } = generateKeyPairPem();
  const receipt = signReceipt(baseReceipt({ parent_run_id: "parent-receipt" }), privateKeyPem);
  const result = verifyReceipt(receipt, { "test-key": publicKeyPem });
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes("parent_chain_verification_unavailable"));
});

test("does not accept parent existence as parent-chain verification", () => {
  const { publicKeyPem, privateKeyPem } = generateKeyPairPem();
  const receipt = signReceipt(baseReceipt({ parent_run_id: "parent-receipt" }), privateKeyPem);
  const result = verifyReceipt(receipt, { "test-key": publicKeyPem }, {
    parentExists: () => true,
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes("parent_chain_verification_unavailable"));
});
