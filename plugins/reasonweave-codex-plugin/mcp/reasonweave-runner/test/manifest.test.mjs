import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const pluginRoot = path.resolve(fileURLToPath(new URL("../../..", import.meta.url)));

test("plugin manifest exposes bundled MCP server with an existing command target", () => {
  const pluginJson = JSON.parse(fs.readFileSync(path.join(pluginRoot, ".codex-plugin", "plugin.json"), "utf8"));
  assert.equal(pluginJson.mcpServers, "./.mcp.json");

  const mcpJson = JSON.parse(fs.readFileSync(path.join(pluginRoot, ".mcp.json"), "utf8"));
  const runner = mcpJson.mcpServers["reasonweave-runner"];
  assert.equal(runner.command, "node");
  assert.equal(runner.args[0], "./mcp/reasonweave-runner/server.mjs");
  assert.equal(fs.existsSync(path.join(pluginRoot, runner.args[0])), true);
  assert.ok(runner.env_vars.includes("OPENAI_API_KEY"));
  assert.ok(runner.env_vars.includes("REASONWEAVE_CODEX_CONFIG_PATH"));
  assert.ok(runner.env_vars.includes("REASONWEAVE_CODEX_AUTH_PATH"));
  assert.ok(runner.env_vars.includes("REASONWEAVE_RECEIPT_PRIVATE_KEY_PATH"));
});
