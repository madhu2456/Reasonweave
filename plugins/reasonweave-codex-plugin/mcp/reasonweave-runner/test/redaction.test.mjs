import assert from "node:assert/strict";
import test from "node:test";
import { redact } from "../lib/redaction.mjs";

test("redaction preserves safe presence indicators while hiding scalar secret fields", () => {
  const result = redact({
    openai_api_key_present: true,
    receipt_private_key_present: false,
    password: 123456,
    token: true,
  });

  assert.equal(result.openai_api_key_present, true);
  assert.equal(result.receipt_private_key_present, false);
  assert.equal(result.password, "[REDACTED]");
  assert.equal(result.token, "[REDACTED]");
});

