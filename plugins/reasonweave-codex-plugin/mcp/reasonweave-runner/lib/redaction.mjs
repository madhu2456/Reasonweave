const SECRET_KEY_PATTERN = /authorization|api[_-]?key|token|secret|private[_-]?key|password|cookie/i;
const SECRET_VALUE_PATTERNS = [
  /Bearer\s+[A-Za-z0-9._~+/-]+=*/gi,
  /sk-[A-Za-z0-9_-]{10,}/g,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
];
const LABELED_SECRET_PATTERN = /(\b(?:api[_-]?key|access[_-]?token|refresh[_-]?token|token|secret|password|cookie|authorization)\b["']?\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;}\]]+)/gi;

export function redactString(value) {
  const base = SECRET_VALUE_PATTERNS.reduce((text, pattern) => text.replace(pattern, "[REDACTED]"), value);
  return base.replace(LABELED_SECRET_PATTERN, '$1"[REDACTED]"');
}

export function redact(value) {
  if (typeof value === "string") {
    return redactString(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => redact(item));
  }
  if (value && typeof value === "object") {
    const output = {};
    for (const [key, child] of Object.entries(value)) {
      if (SECRET_KEY_PATTERN.test(key) && !isSafeSecretIndicator(key, child)) {
        output[key] = "[REDACTED]";
      } else {
        output[key] = redact(child);
      }
    }
    return output;
  }
  return value;
}

function isSafeSecretIndicator(key, value) {
  if (value === null) return true;
  if (typeof value !== "boolean" && typeof value !== "number") return false;
  return /(?:^|[_-])(?:present|observed|configured|enabled|allowed|valid|trusted|count|length)$/i.test(key)
    || /(?:^|[_-])has[_-]/i.test(key);
}

export function promptRecord(prompt, sensitivePrompt = false) {
  if (sensitivePrompt) {
    return {
      prompt_preview: "[REDACTED: sensitive prompt]",
      prompt_length: typeof prompt === "string" ? prompt.length : 0,
    };
  }
  const text = typeof prompt === "string" ? redactString(prompt) : "";
  return {
    prompt_preview: text.slice(0, 240),
    prompt_length: text.length,
  };
}
