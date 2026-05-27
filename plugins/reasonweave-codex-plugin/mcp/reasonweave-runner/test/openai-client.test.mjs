import assert from "node:assert/strict";
import test from "node:test";
import { classifyHttpFailure, createOpenAIResponse } from "../lib/openai-client.mjs";

test("createOpenAIResponse fails closed without API key", async () => {
  const result = await createOpenAIResponse({
    intended_model: "gpt-5.5",
    intended_reasoning: "high",
    prompt: "test",
    client_request_id: "client-test",
    run_id: "run-test",
  }, { openaiApiKey: "" }, async () => {
    throw new Error("fetch should not run");
  });
  assert.equal(result.ok, false);
  assert.equal(result.failure_state, "missing_api_key");
});

test("createOpenAIResponse sends exact model, reasoning, and client request id", async () => {
  let captured;
  const result = await createOpenAIResponse({
    intended_model: "gpt-5.5",
    intended_reasoning: "xhigh",
    prompt: "test prompt",
    client_request_id: "client-request-123",
    run_id: "run-request-123",
  }, { openaiApiKey: "sk-test", openaiOrgId: "org-test", openaiProjectId: "proj-test" }, async (_url, options) => {
    captured = {
      headers: options.headers,
      body: JSON.parse(options.body),
    };
    return {
      ok: true,
      headers: new Map([["x-request-id", "req_123"]]),
      async text() {
        return JSON.stringify({
          id: "resp_123",
          status: "completed",
          model: "gpt-5.5",
          reasoning: { effort: "xhigh" },
        });
      },
    };
  });
  assert.equal(result.ok, true);
  assert.equal(captured.body.model, "gpt-5.5");
  assert.equal(captured.body.reasoning.effort, "xhigh");
  assert.equal(captured.body.store, false);
  assert.equal(captured.body.max_output_tokens, 32768);
  assert.equal(captured.headers["X-Client-Request-Id"], "client-request-123");
  assert.equal(captured.headers["OpenAI-Organization"], "org-test");
  assert.equal(captured.headers["OpenAI-Project"], "proj-test");
  assert.equal(result.headers["x-request-id"], "req_123");
});

test("HTTP failures classify into explicit ReasonWeave states", () => {
  assert.equal(classifyHttpFailure(401), "invalid_api_key");
  assert.equal(classifyHttpFailure(403), "bad_key_permissions");
  assert.equal(classifyHttpFailure(404, { error: { code: "model_not_found" } }), "model_unavailable");
  assert.equal(classifyHttpFailure(429), "rate_limited");
  assert.equal(classifyHttpFailure(500), "provider_error");
  assert.equal(classifyHttpFailure(400), "invalid_request");
});

test("createOpenAIResponse preserves non-Error thrown values as readable failures", async () => {
  const result = await createOpenAIResponse({
    intended_model: "gpt-5.5",
    intended_reasoning: "high",
    prompt: "test",
    client_request_id: "client-test",
    run_id: "run-test",
  }, { openaiApiKey: "sk-test" }, async () => {
    throw "socket closed";
  });
  assert.equal(result.ok, false);
  assert.equal(result.failure_state, "network_failure");
  assert.equal(result.error, "socket closed");
});
