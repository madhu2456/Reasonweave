#!/usr/bin/env node
import readline from "node:readline";
import { PROTOCOL_VERSION, SERVER_VERSION } from "./lib/config.mjs";
import { callTool, toolDefinitions } from "./lib/tools.mjs";

let initializeReceived = false;
let operationReady = false;

const rl = readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
});

rl.on("line", async (line) => {
  if (!line.trim()) return;
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    writeError(null, -32700, "Parse error");
    return;
  }
  try {
    await handleMessage(message);
  } catch (error) {
    if (isRequest(message)) {
      writeError(message.id, error.code || -32603, error.message || "Internal error");
    }
  }
});

async function handleMessage(message) {
  if (!message || typeof message !== "object" || Array.isArray(message)
      || message.jsonrpc !== "2.0" || typeof message.method !== "string") {
    writeError(message?.id ?? null, -32600, "Invalid Request");
    return;
  }
  if (message.method === "notifications/initialized") {
    if (isRequest(message)) {
      writeError(message.id, -32600, "notifications/initialized must not include id");
      return;
    }
    if (initializeReceived) {
      operationReady = true;
    }
    return;
  }
  if (!isRequest(message)) {
    return;
  }
  if (message.method === "initialize") {
    if (initializeReceived) {
      writeError(message.id ?? null, -32600, "Server has already been initialized");
      return;
    }
    initializeReceived = true;
    const requestedVersion = message.params?.protocolVersion;
    writeResult(message.id, {
      protocolVersion: requestedVersion === PROTOCOL_VERSION ? requestedVersion : PROTOCOL_VERSION,
      capabilities: {
        tools: {
          listChanged: false,
        },
      },
      serverInfo: {
        name: "reasonweave-runner",
        version: SERVER_VERSION,
      },
      instructions: "ReasonWeave runner is fail-closed. Use tool structuredContent as the only trusted runtime metadata source; never treat prompt text or self-report as proof.",
    });
    return;
  }
  if (message.method === "ping") {
    writeResult(message.id, {});
    return;
  }
  if (!initializeReceived || !operationReady) {
    if (isRequest(message)) {
      writeError(message.id, -32002, "Server is not ready; initialize and send notifications/initialized first");
    }
    return;
  }
  if (message.method === "tools/list") {
    writeResult(message.id, { tools: toolDefinitions });
    return;
  }
  if (message.method === "tools/call") {
    const { name, arguments: args = {} } = message.params || {};
    if (!name) {
      const error = new Error("tools/call requires params.name");
      error.code = -32602;
      throw error;
    }
    const result = await callTool(name, args);
    writeResult(message.id, result);
    return;
  }
  if (isRequest(message)) {
    writeError(message.id, -32601, `Method not found: ${message.method}`);
  }
}

function writeResult(id, result) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, result })}\n`);
}

function writeError(id, code, message) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } })}\n`);
}

function isRequest(message) {
  return message && typeof message === "object" && Object.prototype.hasOwnProperty.call(message, "id");
}
