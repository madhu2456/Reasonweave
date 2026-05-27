#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { defaultKeyDir, runtimeConfig } from "../lib/config.mjs";
import { generateKeyPairPem } from "../lib/receipt.mjs";

const LOCK_WAIT_MS = 2500;
const LOCK_STALE_MS = 30000;

const config = runtimeConfig();
const keyDir = path.dirname(config.privateKeyPath) || defaultKeyDir();
fs.mkdirSync(keyDir, { recursive: true });
fs.mkdirSync(path.dirname(config.publicKeysPath), { recursive: true });

const lockPath = `${config.publicKeysPath}.lock`;

withFileLock(lockPath, () => {
  if (fs.existsSync(config.privateKeyPath)) {
    throw new Error(`Refusing to overwrite existing private key: ${config.privateKeyPath}`);
  }

  let publicKeys = {};
  if (fs.existsSync(config.publicKeysPath)) {
    publicKeys = JSON.parse(fs.readFileSync(config.publicKeysPath, "utf8"));
  }
  if (!publicKeys || typeof publicKeys !== "object" || Array.isArray(publicKeys)) {
    throw new Error(`Public key store must contain an object: ${config.publicKeysPath}`);
  }
  if (Object.prototype.hasOwnProperty.call(publicKeys, config.receiptKeyId)) {
    throw new Error(`Refusing to replace existing public key id: ${config.receiptKeyId}`);
  }

  const { publicKeyPem, privateKeyPem } = generateKeyPairPem();
  publicKeys[config.receiptKeyId] = {
    public_key_pem: publicKeyPem,
    created_at: new Date().toISOString(),
    status: "active",
  };

  const publicTmpPath = `${config.publicKeysPath}.${process.pid}.tmp`;
  let privateKeyWritten = false;
  try {
    fs.writeFileSync(config.privateKeyPath, privateKeyPem, { encoding: "utf8", mode: 0o600, flag: "wx" });
    privateKeyWritten = true;
    fs.writeFileSync(publicTmpPath, JSON.stringify(publicKeys, null, 2), "utf8");
    fs.renameSync(publicTmpPath, config.publicKeysPath);
  } catch (error) {
    fs.rmSync(publicTmpPath, { force: true });
    if (privateKeyWritten) {
      fs.rmSync(config.privateKeyPath, { force: true });
    }
    throw error;
  }
});

process.stdout.write(JSON.stringify({
  key_id: config.receiptKeyId,
  private_key_path: config.privateKeyPath,
  public_keys_path: config.publicKeysPath,
}, null, 2));
process.stdout.write("\n");

function withFileLock(lockPath, callback) {
  const started = Date.now();
  while (true) {
    let fd;
    try {
      fd = fs.openSync(lockPath, "wx");
    } catch (error) {
      if (error.code !== "EEXIST" || Date.now() - started > LOCK_WAIT_MS) {
        throw new Error(`key_store_lock_unavailable: ${error.message}`);
      }
      try {
        const stat = fs.statSync(lockPath);
        if (Date.now() - stat.mtimeMs > LOCK_STALE_MS) {
          fs.rmSync(lockPath, { force: true });
          continue;
        }
      } catch {
        continue;
      }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25);
      continue;
    }
    try {
      return callback();
    } finally {
      fs.closeSync(fd);
      fs.rmSync(lockPath, { force: true });
    }
  }
}
