import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const scriptPath = path.resolve(fileURLToPath(new URL("../scripts/init-keys.mjs", import.meta.url)));

function keyPaths() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "reasonweave-keys-"));
  return {
    privateKeyPath: path.join(dir, "private", "key.pem"),
    publicKeysPath: path.join(dir, "public", "keys.json"),
  };
}

function runInitializer(paths, keyId = "test-key") {
  return spawnSync(process.execPath, [scriptPath], {
    encoding: "utf8",
    env: {
      ...process.env,
      REASONWEAVE_RECEIPT_KEY_ID: keyId,
      REASONWEAVE_RECEIPT_PRIVATE_KEY_PATH: paths.privateKeyPath,
      REASONWEAVE_RECEIPT_PUBLIC_KEYS_PATH: paths.publicKeysPath,
    },
  });
}

test("key initializer creates parent directories and matching key records", () => {
  const paths = keyPaths();
  const result = runInitializer(paths);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(paths.privateKeyPath), true);
  const publicKeys = JSON.parse(fs.readFileSync(paths.publicKeysPath, "utf8"));
  assert.ok(publicKeys["test-key"].public_key_pem.includes("PUBLIC KEY"));
});

test("key initializer does not overwrite an existing key id or leave an orphan private key", () => {
  const paths = keyPaths();
  fs.mkdirSync(path.dirname(paths.publicKeysPath), { recursive: true });
  fs.writeFileSync(paths.publicKeysPath, JSON.stringify({ "test-key": { public_key_pem: "existing" } }), "utf8");
  const result = runInitializer(paths);
  assert.notEqual(result.status, 0);
  assert.equal(fs.existsSync(paths.privateKeyPath), false);
});

test("key initializer fails on corrupt public-key storage without creating a private key", () => {
  const paths = keyPaths();
  fs.mkdirSync(path.dirname(paths.publicKeysPath), { recursive: true });
  fs.writeFileSync(paths.publicKeysPath, "{broken-json", "utf8");
  const result = runInitializer(paths);
  assert.notEqual(result.status, 0);
  assert.equal(fs.existsSync(paths.privateKeyPath), false);
});

test("key initializer recovers a stale public-key store lock", () => {
  const paths = keyPaths();
  fs.mkdirSync(path.dirname(paths.publicKeysPath), { recursive: true });
  const lockPath = `${paths.publicKeysPath}.lock`;
  fs.writeFileSync(lockPath, "stale", "utf8");
  const stale = new Date(Date.now() - 60000);
  fs.utimesSync(lockPath, stale, stale);

  const result = runInitializer(paths);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(paths.privateKeyPath), true);
  assert.equal(fs.existsSync(lockPath), false);
});
