import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const SERVER_VERSION = "0.1.0";
export const PROTOCOL_VERSION = "2025-06-18";
export const RECEIPT_VERSION = "1";
export const RECEIPT_HASH_DOMAIN = "reasonweave-runtime-receipt:v1\n";

export function pluginRoot() {
  return path.resolve(fileURLToPath(new URL("../../..", import.meta.url)));
}

export function loadRoutingPolicy(root = pluginRoot()) {
  const routingPath = path.join(root, "skills", "reasonweave-orchestrator", "references", "model-routing.yaml");
  return JSON.parse(fs.readFileSync(routingPath, "utf8"));
}

export function defaultDataDir(env = process.env) {
  if (env.REASONWEAVE_LEDGER_DIR) {
    return path.resolve(env.REASONWEAVE_LEDGER_DIR);
  }
  if (env.PLUGIN_DATA) {
    return path.resolve(env.PLUGIN_DATA, "runtime");
  }
  return path.join(os.homedir(), ".agents", "reasonweave", "runtime");
}

export function defaultKeyDir() {
  return path.join(os.homedir(), ".agents", "reasonweave", "keys");
}

export function runtimeConfig(env = process.env) {
  const keyDir = defaultKeyDir();
  return {
    openaiApiKey: env.OPENAI_API_KEY || "",
    openaiOrgId: env.OPENAI_ORG_ID || "",
    openaiProjectId: env.OPENAI_PROJECT_ID || "",
    receiptKeyId: env.REASONWEAVE_RECEIPT_KEY_ID || "local-dev",
    privateKeyPath: env.REASONWEAVE_RECEIPT_PRIVATE_KEY_PATH || path.join(keyDir, "reasonweave-ed25519-private.pem"),
    publicKeysPath: env.REASONWEAVE_RECEIPT_PUBLIC_KEYS_PATH || path.join(keyDir, "public-keys.json"),
    ledgerDir: defaultDataDir(env),
    clockSkewMs: Number.parseInt(env.REASONWEAVE_CLOCK_SKEW_MS || "300000", 10),
  };
}

export function allowedReasoning(policy = loadRoutingPolicy()) {
  return policy.reasoning_efforts || ["low", "medium", "high", "xhigh"];
}

export function isAllowedModel(policy, model) {
  return Boolean(model && (policy.models || []).includes(model));
}

export function modelAliasMatches(policy, intendedModel, resolvedModel) {
  if (!intendedModel || !resolvedModel || resolvedModel === "none" || resolvedModel === "current-host-runtime") {
    return false;
  }
  const matchedFamilies = (policy.models || [])
    .filter((model) => resolvedModel === model || resolvedModel.startsWith(`${model}-`))
    .sort((left, right) => right.length - left.length);
  if (matchedFamilies.length > 0 && matchedFamilies[0] !== intendedModel) {
    return false;
  }
  const aliases = policy.model_aliases?.[intendedModel] || [];
  return aliases.some((alias) => {
    if (alias.endsWith("-*")) {
      return resolvedModel.startsWith(alias.slice(0, -1));
    }
    return resolvedModel === alias;
  });
}

export function reasoningMatches(intendedReasoning, executionReasoning) {
  return Boolean(intendedReasoning && executionReasoning && intendedReasoning === executionReasoning);
}

export function getLogicalAgent(policy, logicalAgent) {
  return (policy.logical_agents || []).find((agent) => agent.name === logicalAgent) || null;
}

export function allowedRouteSelections(agent, policy = null) {
  if (!agent) return [];
  const selections = [
    { model: agent.default_model, reasoning: agent.default_reasoning },
    { model: agent.escalated_model, reasoning: agent.escalated_reasoning },
  ];
  if (agent.top_tier_reasoning) {
    selections.push({
      model: agent.escalated_model || agent.default_model,
      reasoning: agent.top_tier_reasoning,
    });
  }
  if (policy?.policy?.terminal_route?.applies_to_all_logical_agents === true) {
    selections.push({
      model: policy.policy.terminal_route.model,
      reasoning: policy.policy.terminal_route.reasoning_effort,
    });
  }
  return selections.filter((selection, index, all) => all.findIndex(
    (candidate) => candidate.model === selection.model && candidate.reasoning === selection.reasoning,
  ) === index);
}

export function routeSelectionMatches(policy, selection, options = {}) {
  const agent = getLogicalAgent(policy, selection.logical_agent);
  if (!agent) return false;
  if (agent.platform_agent_type !== selection.platform_agent_type) return false;
  if (options.requireAccess !== false && agent.access_tier !== selection.access) return false;
  return allowedRouteSelections(agent, policy).some(
    (route) => route.model === selection.intended_model && route.reasoning === selection.intended_reasoning,
  );
}

export function taskSelectionMatches(policy, selection) {
  if (!selection.primary_task_type || !(policy.task_types || []).includes(selection.primary_task_type)) {
    return false;
  }
  if (selection.logical_agent === "router") {
    return true;
  }
  return Boolean((policy.task_routes?.[selection.primary_task_type] || []).includes(selection.logical_agent));
}

export function riskSelectionMatches(policy, selection) {
  if (!Array.isArray(selection.risk_flags)
      || selection.risk_flags.some((flag) => !(policy.risk_overlays || []).includes(flag))) {
    return false;
  }
  const sensitive = selection.risk_flags.some((flag) => (policy.sensitive_overlays || []).includes(flag));
  if (!sensitive) return true;
  return selection.intended_model === "gpt-5.5" && ["high", "xhigh"].includes(selection.intended_reasoning);
}
