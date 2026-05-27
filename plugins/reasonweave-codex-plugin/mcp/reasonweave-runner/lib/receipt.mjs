import crypto from "node:crypto";
import fs from "node:fs";
import {
  RECEIPT_HASH_DOMAIN,
  RECEIPT_VERSION,
  allowedReasoning,
  isAllowedModel,
  loadRoutingPolicy,
  modelAliasMatches,
  reasoningMatches,
  riskSelectionMatches,
  routeSelectionMatches,
  taskSelectionMatches,
} from "./config.mjs";

const HASH_EXCLUDED_FIELDS = new Set(["receipt_hash", "receipt_signature"]);
const REQUIRED_FIELDS = [
  "receipt_version",
  "run_id",
  "nonce",
  "delegated_agent_id",
  "parent_run_id",
  "logical_agent",
  "primary_task_type",
  "risk_flags",
  "platform_agent_type",
  "access",
  "intended_model",
  "resolved_model",
  "execution_model",
  "intended_reasoning",
  "execution_reasoning",
  "verification_source",
  "model_match",
  "reasoning_match",
  "dispatch_authorized",
  "issued_at",
  "expires_at",
  "key_id",
  "receipt_hash",
  "receipt_signature",
];

export function canonicalJson(value) {
  return JSON.stringify(sortValue(value));
}

function sortValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => sortValue(item));
  }
  if (value && typeof value === "object" && !(value instanceof Date)) {
    const output = {};
    for (const key of Object.keys(value).sort()) {
      output[key] = sortValue(value[key]);
    }
    return output;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
}

export function receiptHashInput(receipt) {
  const body = {};
  for (const [key, value] of Object.entries(receipt)) {
    if (!HASH_EXCLUDED_FIELDS.has(key)) {
      body[key] = value;
    }
  }
  return RECEIPT_HASH_DOMAIN + canonicalJson(body);
}

export function computeReceiptHash(receipt) {
  return crypto.createHash("sha256").update(receiptHashInput(receipt), "utf8").digest("hex");
}

export function signReceipt(unsignedReceipt, privateKeyPem) {
  const receipt = {
    ...unsignedReceipt,
    receipt_version: unsignedReceipt.receipt_version || RECEIPT_VERSION,
    receipt_hash: "",
    receipt_signature: "",
  };
  receipt.receipt_hash = computeReceiptHash(receipt);
  receipt.receipt_signature = crypto.sign(null, Buffer.from(receiptHashInput(receipt), "utf8"), privateKeyPem).toString("base64");
  return receipt;
}

export function loadPrivateKey(privateKeyPath) {
  return fs.readFileSync(privateKeyPath, "utf8");
}

export function loadPublicKeys(publicKeysPath) {
  const payload = JSON.parse(fs.readFileSync(publicKeysPath, "utf8"));
  const keys = {};
  for (const [keyId, value] of Object.entries(payload)) {
    if (typeof value === "string") {
      keys[keyId] = value;
    } else if (value && typeof value.public_key_pem === "string") {
      keys[keyId] = value.public_key_pem;
    }
  }
  return keys;
}

export function generateKeyPairPem() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  return {
    publicKeyPem: publicKey.export({ type: "spki", format: "pem" }),
    privateKeyPem: privateKey.export({ type: "pkcs8", format: "pem" }),
  };
}

export function verifyReceipt(receipt, publicKeys, options = {}) {
  const now = options.now ? new Date(options.now) : new Date();
  const clockSkewMs = Number.isFinite(options.clockSkewMs) ? options.clockSkewMs : 300000;
  const policy = options.policy || loadRoutingPolicy();
  const maxReceiptLifetimeMs = Number.isFinite(options.maxReceiptLifetimeMs)
    ? options.maxReceiptLifetimeMs
    : policy.runtime_receipt?.max_lifetime_ms || 600000;
  const errors = [];

  if (!receipt || typeof receipt !== "object") {
    return { valid: false, errors: ["invalid_receipt_object"] };
  }
  for (const field of REQUIRED_FIELDS) {
    if (!(field in receipt)) {
      errors.push(`missing_${field}`);
    }
  }
  if (errors.length > 0) {
    return { valid: false, errors };
  }
  validateReceiptFieldTypes(receipt, errors);
  if (receipt.receipt_version !== RECEIPT_VERSION) {
    errors.push("unsupported_receipt_version");
  }

  const recomputedHash = computeReceiptHash(receipt);
  if (receipt.receipt_hash !== recomputedHash) {
    errors.push("invalid_hash");
  }

  const publicKey = publicKeys?.[receipt.key_id];
  if (!receipt.key_id) {
    errors.push("unknown_key_id");
  } else if (!publicKey) {
    errors.push("missing_public_key");
  } else {
    try {
      const signatureOk = crypto.verify(
        null,
        Buffer.from(receiptHashInput(receipt), "utf8"),
        publicKey,
        Buffer.from(receipt.receipt_signature, "base64"),
      );
      if (!signatureOk) {
        errors.push("invalid_signature");
      }
    } catch {
      errors.push("invalid_signature");
    }
  }

  const expiresAt = new Date(receipt.expires_at);
  const issuedAt = new Date(receipt.issued_at);
  if (Number.isNaN(expiresAt.getTime())) {
    errors.push("invalid_expires_at");
  } else if (expiresAt.getTime() + clockSkewMs < now.getTime()) {
    errors.push("expired");
  }
  if (Number.isNaN(issuedAt.getTime())) {
    errors.push("invalid_issued_at");
  } else if (issuedAt.getTime() - clockSkewMs > now.getTime()) {
    errors.push("issued_in_future");
  }
  if (!Number.isNaN(expiresAt.getTime()) && !Number.isNaN(issuedAt.getTime())) {
    const receiptLifetimeMs = expiresAt.getTime() - issuedAt.getTime();
    if (receiptLifetimeMs <= 0) {
      errors.push("invalid_receipt_lifetime");
    } else if (receiptLifetimeMs > maxReceiptLifetimeMs) {
      errors.push("receipt_lifetime_exceeded");
    }
  }

  if (receipt.verification_source !== "runner_receipt" && receipt.verification_source !== "platform_metadata") {
    errors.push("invalid_verification_source");
  }
  const modelsMatch = isAllowedModel(policy, receipt.intended_model)
    && receipt.execution_model === receipt.resolved_model
    && modelAliasMatches(policy, receipt.intended_model, receipt.execution_model)
    && modelAliasMatches(policy, receipt.intended_model, receipt.resolved_model);
  if (receipt.model_match !== true || !modelsMatch) {
    errors.push("model_mismatch");
  }
  const reasoningMatchesReceipt = allowedReasoning(policy).includes(receipt.intended_reasoning)
    && allowedReasoning(policy).includes(receipt.execution_reasoning)
    && reasoningMatches(receipt.intended_reasoning, receipt.execution_reasoning);
  if (receipt.reasoning_match !== true || !reasoningMatchesReceipt) {
    errors.push("reasoning_mismatch");
  }
  if (receipt.dispatch_authorized !== true) {
    errors.push("dispatch_not_authorized");
  }
  if (!routeSelectionMatches(policy, {
    logical_agent: receipt.logical_agent,
    platform_agent_type: receipt.platform_agent_type,
    access: receipt.access,
    intended_model: receipt.intended_model,
    intended_reasoning: receipt.intended_reasoning,
  })) {
    errors.push("route_not_authorized");
  }
  if (!taskSelectionMatches(policy, receipt) || !riskSelectionMatches(policy, receipt)) {
    errors.push("route_not_authorized");
  }

  if (options.seenReplayKeys?.has(replayKey(receipt)) && options.allowSeen !== true) {
    errors.push("replayed_run_id_nonce");
  }
  const parentValid = options.parentIsValid;
  if (receipt.parent_run_id) {
    if (typeof parentValid !== "function") {
      errors.push("parent_chain_verification_unavailable");
    } else if (!parentValid(receipt.parent_run_id)) {
      errors.push("parent_child_chain_mismatch");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    recomputed_hash: recomputedHash,
  };
}

export function replayKey(receipt) {
  return `${receipt.run_id}:${receipt.nonce}`;
}

function validateReceiptFieldTypes(receipt, errors) {
  for (const field of [
    "run_id",
    "nonce",
    "delegated_agent_id",
    "logical_agent",
    "primary_task_type",
    "platform_agent_type",
    "access",
    "intended_model",
    "resolved_model",
    "execution_model",
    "intended_reasoning",
    "execution_reasoning",
    "verification_source",
    "issued_at",
    "expires_at",
    "key_id",
    "receipt_hash",
    "receipt_signature",
  ]) {
    if (typeof receipt[field] !== "string" || !receipt[field].trim()) {
      errors.push(`invalid_${field}`);
    }
  }
  if (receipt.parent_run_id !== null
      && (typeof receipt.parent_run_id !== "string" || !receipt.parent_run_id.trim())) {
    errors.push("invalid_parent_run_id");
  }
  if (!Array.isArray(receipt.risk_flags)
      || receipt.risk_flags.some((flag) => typeof flag !== "string" || !flag.trim())) {
    errors.push("invalid_risk_flags");
  }
  for (const field of ["model_match", "reasoning_match", "dispatch_authorized"]) {
    if (typeof receipt[field] !== "boolean") {
      errors.push(`invalid_${field}`);
    }
  }
}
