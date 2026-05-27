import { redact } from "./redaction.mjs";

const DEFAULT_MAX_OUTPUT_TOKENS = 32768;

export async function createOpenAIResponse(args, config, fetchImpl = globalThis.fetch) {
  if (!config.openaiApiKey) {
    return {
      ok: false,
      failure_state: "missing_api_key",
      error: "OPENAI_API_KEY is not configured.",
      headers: {},
      response: null,
    };
  }
  if (typeof fetchImpl !== "function") {
    return {
      ok: false,
      failure_state: "unsupported_runtime",
      error: "This Node runtime does not provide fetch().",
      headers: {},
      response: null,
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), args.timeout_ms || 120000);
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.openaiApiKey}`,
    "X-Client-Request-Id": args.client_request_id,
  };
  if (config.openaiOrgId) headers["OpenAI-Organization"] = config.openaiOrgId;
  if (config.openaiProjectId) headers["OpenAI-Project"] = config.openaiProjectId;

  const body = {
    model: args.intended_model,
    input: args.prompt,
    reasoning: {
      effort: args.intended_reasoning,
    },
    store: false,
    metadata: {
      reasonweave_run_id: args.run_id,
      reasonweave_logical_agent: args.logical_agent,
      reasonweave_parent_run_id: args.parent_run_id || "",
    },
    max_output_tokens: args.max_output_tokens || DEFAULT_MAX_OUTPUT_TOKENS,
  };

  try {
    const httpResponse = await fetchImpl("https://api.openai.com/v1/responses", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const responseHeaders = headersToObject(httpResponse.headers);
    const text = await httpResponse.text();
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = { raw_text: text };
    }
    if (!httpResponse.ok) {
      return {
        ok: false,
        failure_state: classifyHttpFailure(httpResponse.status, payload),
        error: payload?.error?.message || `OpenAI API returned HTTP ${httpResponse.status}.`,
        headers: responseHeaders,
        response: redact(payload),
      };
    }
    return {
      ok: true,
      headers: responseHeaders,
      response: payload,
    };
  } catch (error) {
    const message = error?.message || String(error);
    return {
      ok: false,
      failure_state: error.name === "AbortError" ? "timeout" : "network_failure",
      error: message,
      headers: {},
      response: null,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function headersToObject(headers) {
  const output = {};
  if (!headers) return output;
  if (typeof headers.forEach === "function") {
    headers.forEach((value, key) => {
      output[key.toLowerCase()] = value;
    });
    return output;
  }
  for (const [key, value] of Object.entries(headers)) {
    output[key.toLowerCase()] = value;
  }
  return output;
}

export function classifyHttpFailure(status, payload = {}) {
  const code = payload?.error?.code || payload?.error?.type || "";
  if (status === 401) return "invalid_api_key";
  if (status === 403) return "bad_key_permissions";
  if (status === 404 || code === "model_not_found") return "model_unavailable";
  if (status === 408 || status === 504) return "timeout";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "provider_error";
  return "invalid_request";
}
