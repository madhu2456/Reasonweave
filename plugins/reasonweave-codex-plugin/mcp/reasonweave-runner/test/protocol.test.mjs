import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const serverPath = path.resolve(fileURLToPath(new URL("../server.mjs", import.meta.url)));

function startServer() {
  const child = spawn(process.execPath, [serverPath], {
    stdio: ["pipe", "pipe", "pipe"],
    env: {
      ...process.env,
      OPENAI_API_KEY: "",
    },
  });
  const pending = [];
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    for (const line of chunk.split(/\r?\n/).filter(Boolean)) {
      const waiter = pending.shift();
      if (waiter) waiter(JSON.parse(line));
    }
  });
  return {
    child,
    request(message) {
      child.stdin.write(`${JSON.stringify(message)}\n`);
      return new Promise((resolve) => pending.push(resolve));
    },
    notify(message) {
      child.stdin.write(`${JSON.stringify(message)}\n`);
    },
    stop() {
      child.kill();
    },
  };
}

test("MCP server initializes and lists tools", async () => {
  const server = startServer();
  try {
    const init = await server.request({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "1" } },
    });
    assert.equal(init.result.serverInfo.name, "reasonweave-runner");
    assert.ok(init.result.instructions.includes("fail-closed"));
    server.notify({ jsonrpc: "2.0", method: "notifications/initialized" });
    const tools = await server.request({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
    const names = tools.result.tools.map((tool) => tool.name);
    assert.ok(names.includes("reasonweave.get_subscription_observed_metadata"));
    assert.ok(names.includes("reasonweave.run_verified_agent"));
    assert.ok(names.includes("reasonweave.self_test"));

    server.notify({ jsonrpc: "2.0", method: "tools/list", params: {} });
    const ping = await server.request({ jsonrpc: "2.0", id: 3, method: "ping" });
    assert.deepEqual(ping.result, {});
  } finally {
    server.stop();
  }
});

test("MCP self_test returns structuredContent and unknown tool is protocol error", async () => {
  const server = startServer();
  try {
    await server.request({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
    server.notify({ jsonrpc: "2.0", method: "notifications/initialized" });
    const selfTest = await server.request({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "reasonweave.self_test", arguments: {} },
    });
    assert.equal(selfTest.result.isError, false);
    assert.equal(selfTest.result.structuredContent.passed, true);

    const unknown = await server.request({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "reasonweave.unknown", arguments: {} },
    });
    assert.equal(unknown.error.code, -32602);
  } finally {
    server.stop();
  }
});

test("MCP rejects non-object tool arguments as invalid params", async () => {
  const server = startServer();
  try {
    await server.request({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
    server.notify({ jsonrpc: "2.0", method: "notifications/initialized" });
    const response = await server.request({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "reasonweave.get_runtime_capabilities", arguments: "not-an-object" },
    });
    assert.equal(response.error.code, -32602);
    assert.match(response.error.message, /Tool arguments must be an object/);
  } finally {
    server.stop();
  }
});

test("MCP rejects initialized notification sent as a request", async () => {
  const server = startServer();
  try {
    await server.request({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
    const response = await server.request({ jsonrpc: "2.0", id: 2, method: "notifications/initialized" });
    assert.equal(response.error.code, -32600);
    assert.match(response.error.message, /must not include id/);
  } finally {
    server.stop();
  }
});

test("MCP negotiates its supported version and blocks operations until initialized notification", async () => {
  const server = startServer();
  try {
    const beforeInitialize = await server.request({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} });
    assert.equal(beforeInitialize.error.code, -32002);

    const init = await server.request({
      jsonrpc: "2.0",
      id: 2,
      method: "initialize",
      params: { protocolVersion: "1900-01-01", capabilities: {}, clientInfo: { name: "test", version: "1" } },
    });
    assert.equal(init.result.protocolVersion, "2025-06-18");

    const beforeNotification = await server.request({ jsonrpc: "2.0", id: 3, method: "tools/list", params: {} });
    assert.equal(beforeNotification.error.code, -32002);

    server.notify({ jsonrpc: "2.0", method: "notifications/initialized" });
    const afterNotification = await server.request({ jsonrpc: "2.0", id: 4, method: "tools/list", params: {} });
    assert.ok(Array.isArray(afterNotification.result.tools));
  } finally {
    server.stop();
  }
});

test("MCP rejects non-JSON-RPC requests", async () => {
  const server = startServer();
  try {
    const response = await server.request({ id: 1, method: "initialize", params: {} });
    assert.equal(response.error.code, -32600);
  } finally {
    server.stop();
  }
});

test("MCP malformed JSON returns parse error", async () => {
  const server = startServer();
  try {
    server.child.stdin.write("{bad-json}\n");
    const response = await new Promise((resolve) => {
      server.child.stdout.once("data", (chunk) => resolve(JSON.parse(chunk.trim())));
    });
    assert.equal(response.error.code, -32700);
  } finally {
    server.stop();
  }
});
