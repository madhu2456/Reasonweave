import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const pluginRoot = path.resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const agentsDir = path.join(pluginRoot, "agents", "codex");

const expectedAgents = [
  "weave-browser-tester",
  "weave-critic",
  "weave-debugger",
  "weave-designer-mobile",
  "weave-designer",
  "weave-devops",
  "weave-docs",
  "weave-implementer-mobile",
  "weave-implementer",
  "weave-mobile-tester",
  "weave-orchestrator",
  "weave-planner",
  "weave-researcher",
  "weave-reviewer-pro",
  "weave-reviewer",
  "weave-simplifier",
  "weave-skill-creator",
];

function getTomlString(content, key) {
  const match = content.match(new RegExp(`^${key}\\s*=\\s*"([^"]+)"`, "m"));
  return match?.[1] ?? null;
}

test("Codex custom agent templates are complete and named consistently", () => {
  const files = fs.readdirSync(agentsDir).filter((name) => name.endsWith(".toml")).sort();
  assert.deepEqual(files, expectedAgents.map((name) => `${name}.toml`).sort());

  for (const agent of expectedAgents) {
    const file = path.join(agentsDir, `${agent}.toml`);
    const content = fs.readFileSync(file, "utf8");

    assert.equal(getTomlString(content, "name"), agent);
    assert.ok(getTomlString(content, "description")?.length > 20, `${agent} description is too short`);
    assert.match(content, /^developer_instructions\s*=\s*"""/m, `${agent} is missing developer_instructions`);
    assert.match(content, /^model\s*=\s*"gpt-5\.(5|4-mini)"/m, `${agent} model must be a supported Codex model`);
    assert.match(content, /^model_reasoning_effort\s*=\s*"(medium|high|xhigh)"/m, `${agent} reasoning effort is invalid`);
    assert.match(content, /^sandbox_mode\s*=\s*"(read-only|workspace-write)"/m, `${agent} sandbox mode is invalid`);
  }
});
