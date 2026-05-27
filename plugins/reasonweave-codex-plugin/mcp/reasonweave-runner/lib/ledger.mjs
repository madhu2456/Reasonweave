import fs from "node:fs";
import path from "node:path";
import { replayKey } from "./receipt.mjs";
import { redact } from "./redaction.mjs";

const LOCK_WAIT_MS = 2500;
const LOCK_STALE_MS = 30000;

export class RuntimeLedger {
  constructor(ledgerDir) {
    this.ledgerDir = ledgerDir;
    this.runsPath = path.join(ledgerDir, "runs.jsonl");
    this.replayPath = path.join(ledgerDir, "replay-index.json");
    this.lockPath = path.join(ledgerDir, ".lock");
  }

  ensureDir() {
    fs.mkdirSync(this.ledgerDir, { recursive: true });
  }

  withLock(callback) {
    this.ensureDir();
    const started = Date.now();
    while (true) {
      let fd;
      try {
        fd = fs.openSync(this.lockPath, "wx");
      } catch (error) {
        if (error.code !== "EEXIST" || Date.now() - started > LOCK_WAIT_MS) {
          throw new Error(`ledger_lock_unavailable: ${error.message}`);
        }
        try {
          const stat = fs.statSync(this.lockPath);
          if (Date.now() - stat.mtimeMs > LOCK_STALE_MS) {
            fs.rmSync(this.lockPath, { force: true });
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
        fs.rmSync(this.lockPath, { force: true });
      }
    }
  }

  loadReplayIndex() {
    if (!fs.existsSync(this.replayPath)) {
      return {};
    }
    try {
      return JSON.parse(fs.readFileSync(this.replayPath, "utf8"));
    } catch {
      return { _corrupt_replay_index: true };
    }
  }

  saveReplayIndex(index) {
    const tmp = `${this.replayPath}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(index, null, 2), "utf8");
    fs.renameSync(tmp, this.replayPath);
  }

  seenReplayKeys(options = {}) {
    const index = this.loadReplayIndex();
    if (options.requireIntegrity === true && index._corrupt_replay_index) {
      throw new Error("corrupt_replay_index");
    }
    const keys = new Set(Object.keys(index).filter((key) => key !== "_corrupt_replay_index"));
    for (const key of this.recordedReplayKeys(options)) {
      keys.add(key);
    }
    return keys;
  }

  recordedReplayKeys(options = {}) {
    if (!fs.existsSync(this.runsPath)) {
      return new Set();
    }
    const keys = new Set();
    let corruptRows = 0;
    const lines = fs.readFileSync(this.runsPath, "utf8").split(/\r?\n/).filter(Boolean);
    for (const line of lines) {
      try {
        const record = JSON.parse(line);
        if (record.receipt?.run_id && record.receipt?.nonce) {
          keys.add(replayKey(record.receipt));
        }
      } catch {
        corruptRows++;
      }
    }
    if (options.requireIntegrity === true && corruptRows > 0) {
      throw new Error("corrupt_runs_ledger");
    }
    return keys;
  }

  assertReceiptAcceptanceReady() {
    return this.withLock(() => {
      const index = this.loadReplayIndex();
      if (index._corrupt_replay_index) {
        throw new Error("corrupt_replay_index");
      }
      this.recordedReplayKeys({ requireIntegrity: true });
      return true;
    });
  }

  appendRun(record) {
    return this.withLock(() => {
      const index = this.loadReplayIndex();
      if (index._corrupt_replay_index) {
        throw new Error("corrupt_replay_index");
      }
      const key = record.receipt ? replayKey(record.receipt) : null;
      if (key && (index[key] || this.recordedReplayKeys({ requireIntegrity: true }).has(key))) {
        throw new Error("replayed_run_id_nonce");
      }
      const stored = redact(record);
      fs.appendFileSync(this.runsPath, `${JSON.stringify(stored)}\n`, "utf8");
      if (key) {
        index[key] = {
          run_id: record.run_id,
          issued_at: record.receipt.issued_at,
        };
        this.saveReplayIndex(index);
      }
      return stored;
    });
  }

  listRuns(limit = 20) {
    this.ensureDir();
    if (!fs.existsSync(this.runsPath)) {
      return { runs: [], corrupt_rows: 0 };
    }
    const lines = fs.readFileSync(this.runsPath, "utf8").split(/\r?\n/).filter(Boolean);
    const runs = [];
    let corruptRows = 0;
    for (const line of lines) {
      try {
        runs.push(JSON.parse(line));
      } catch {
        corruptRows++;
      }
    }
    return { runs: runs.slice(-limit).reverse(), corrupt_rows: corruptRows };
  }

  getRun(runId) {
    const { runs, corrupt_rows } = this.listRuns(Number.MAX_SAFE_INTEGER);
    const run = runs.find((item) => item.run_id === runId) || null;
    return { run, corrupt_rows };
  }
}
